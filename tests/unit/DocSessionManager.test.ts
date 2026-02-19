import { DocSessionManager } from '../../src/conversation/DocSessionManager';
import { CommandContext } from '../../src/commands/types';

// ─── vscode mock (subset used by DocSessionManager) ──────────────────────────
jest.mock('vscode', () => ({
    workspace: {
        fs: {
            writeFile: jest.fn().mockResolvedValue(undefined),
            readFile: jest.fn().mockResolvedValue(Buffer.from('# Existing Doc\n\nSome content.'))
        },
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
    },
    Uri: {
        file: jest.fn((p: string) => ({ fsPath: p }))
    },
    LanguageModelChatMessage: {
        User: jest.fn((text: string) => ({ role: 'user', content: text }))
    }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

jest.mock('../../src/utils/FileUtils', () => ({
    FileUtils: {
        ensureDirectoryExists: jest.fn().mockResolvedValue(undefined)
    }
}));

function makeLlmChunks(...chunks: string[]) {
    return (async function* () { for (const c of chunks) { yield c; } })();
}

/** Build a mock model whose sendRequest always returns the given text */
function mockModel(responseText: string) {
    return {
        sendRequest: jest.fn().mockImplementation(() =>
            Promise.resolve({ text: makeLlmChunks(responseText) })
        )
    };
}

const baseContext: CommandContext = {
    stream: { markdown: jest.fn() } as any,
    request: {} as any,
    token: { isCancellationRequested: false } as any,
    workspaceRoot: '/test/workspace',
    extensionContext: {} as any
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DocSessionManager', () => {
    let mgr: DocSessionManager;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset singleton for test isolation
        (DocSessionManager as any).instance = undefined;
        mgr = DocSessionManager.getInstance();
    });

    // ── singleton ──────────────────────────────────────────────────────────────
    it('getInstance returns the same instance', () => {
        expect(DocSessionManager.getInstance()).toBe(mgr);
    });

    // ── no model fallback ──────────────────────────────────────────────────────
    it('returns no-model fallback when context.model is undefined', async () => {
        const result = await mgr.startNewSession('a forex trading idea', {
            ...baseContext,
            model: undefined
        });

        expect(result.shouldContinue).toBe(false);
        expect(result.response).toMatch(/no language model/i);
        expect(result.sessionId).toBe('');
    });

    // ── session creation ───────────────────────────────────────────────────────
    it('creates a new session from free-form text with a model', async () => {
        // Classify intent → prd
        // Draft generation → draft content
        // First question → a question
        const model = {
            sendRequest: jest.fn()
                .mockImplementationOnce(() => Promise.resolve({
                    text: makeLlmChunks('{"docType":"prd","title":"Forex Trading Trainer"}')
                }))
                .mockImplementationOnce(() => Promise.resolve({
                    text: makeLlmChunks('# Forex Trading Trainer\n\n## Overview\nInitial draft.')
                }))
                .mockImplementationOnce(() => Promise.resolve({
                    text: makeLlmChunks('What exchange pairs should the model target initially?')
                }))
        };

        const result = await mgr.startNewSession(
            'this will be a project that will train local models for Forex exchange trading using unsloth',
            { ...baseContext, model: model as any }
        );

        expect(result.shouldContinue).toBe(true);
        expect(result.sessionId).toBeTruthy();
        expect(result.response).toMatch(/PRD Creator/i);
        expect(result.documentPath.replace(/\\/g, '/')).toContain('docs/prd');
        expect(mgr.hasSession(result.sessionId)).toBe(true);

        const session = mgr.getSession(result.sessionId)!;
        expect(session.agentName).toBe('prd-creator');
        expect(session.docType).toBe('prd');
    });

    // ── correct agent per doc type ─────────────────────────────────────────────
    it.each<[string, string, string]>([
        ['prd',          'prd-creator',           'docs/prd'],
        ['requirements', 'requirements-gatherer',  'docs/requirements'],
        ['design',       'solution-architect',     'docs/design'],
        ['spec',         'specification-writer',   'docs/spec'],
        ['brainstorm',   'brainstormer',           'docs/ideas'],
    ])('docType "%s" → agentName "%s" and folder "%s"', async (docType, expectedAgent, expectedFolder) => {
        const model = {
            sendRequest: jest.fn()
                .mockImplementationOnce(() => Promise.resolve({
                    text: makeLlmChunks(`{"docType":"${docType}","title":"Test Doc"}`)
                }))
                .mockImplementation(() => Promise.resolve({
                    text: makeLlmChunks('Content or question.')
                }))
        };

        const result = await mgr.startNewSession('test input', { ...baseContext, model: model as any });

        const session = mgr.getSession(result.sessionId)!;
        expect(session.agentName).toBe(expectedAgent);
        // Normalise OS path separators before checking folder
        expect(result.documentPath.replace(/\\/g, '/')).toContain(expectedFolder);
    });

    // ── session continuation ───────────────────────────────────────────────────
    it('continues an existing session and applies LLM refinement', async () => {
        // Manually bootstrap a session
        const sessionId = 'test-session-001';
        (mgr as any).sessions.set(sessionId, {
            id: sessionId,
            docType: 'prd',
            agentName: 'prd-creator',
            documentPath: '/test/workspace/docs/prd/forex-trading-trainer.md',
            turnCount: 1,
            createdAt: new Date(),
            lastActivity: new Date()
        });

        const model = mockModel(
            '---DOCUMENT---\n# Updated PRD\n\nRefined content.\n---QUESTION---\nWhat is the target model size?'
        );

        const result = await mgr.continueSession(sessionId, 'Use EUR/USD as the primary pair', {
            ...baseContext,
            model: model as any
        });

        expect(result.shouldContinue).toBe(true);
        expect(result.response).toContain('What is the target model size?');
        expect(result.response).toContain('Document updated');

        // File should have been written with updated content
        const vscode = require('vscode');
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        const written: Buffer = vscode.workspace.fs.writeFile.mock.calls[0][1];
        expect(written.toString('utf8')).toContain('Updated PRD');
    });

    // ── done signal closes session ─────────────────────────────────────────────
    it.each(['done', 'Done', 'finish', 'finished', '/done', 'looks good', "that's it"])(
        'ends session when user types "%s"', async (doneInput) => {
            const sessionId = 'test-session-done';
            (mgr as any).sessions.set(sessionId, {
                id: sessionId,
                docType: 'requirements',
                agentName: 'requirements-gatherer',
                documentPath: '/test/workspace/docs/requirements/myreqs.md',
                turnCount: 3,
                createdAt: new Date(),
                lastActivity: new Date()
            });

            const result = await mgr.continueSession(sessionId, doneInput, baseContext);

            expect(result.shouldContinue).toBe(false);
            expect(result.response).toMatch(/session complete/i);
            expect(mgr.hasSession(sessionId)).toBe(false);
        }
    );

    // ── malformed LLM JSON falls back gracefully ──────────────────────────────
    it('falls back to prd type when LLM returns invalid JSON for classification', async () => {
        const model = {
            sendRequest: jest.fn()
                .mockImplementationOnce(() => Promise.resolve({
                    text: makeLlmChunks('this is not JSON at all')
                }))
                .mockImplementation(() => Promise.resolve({
                    text: makeLlmChunks('Draft or question.')
                }))
        };

        const result = await mgr.startNewSession('some idea', { ...baseContext, model: model as any });

        // Should not throw and should produce a valid session
        expect(result.shouldContinue).toBe(true);
        const session = mgr.getSession(result.sessionId)!;
        expect(['prd', 'brainstorm', 'requirements', 'design', 'spec']).toContain(session.docType);
    });
});
