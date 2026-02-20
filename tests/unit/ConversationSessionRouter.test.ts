import { ConversationSessionRouter, ConversationRoutingResult } from '../../src/conversation/ConversationSessionRouter';
import { ConversationManager } from '../../src/conversation/ConversationManager';
import { AgentManager } from '../../src/agents/AgentManager';
import { OfflineManager } from '../../src/offline/OfflineManager';
import { DocSessionManager } from '../../src/conversation/DocSessionManager';
import { CommandContext } from '../../src/commands/types';
import { createMockChatRequest, createMockChatResponseStream } from '../testUtils';
import * as vscode from 'vscode';

// Mock dependencies
jest.mock('../../src/conversation/ConversationManager');
jest.mock('../../src/agents/AgentManager');
jest.mock('../../src/offline/OfflineManager');
jest.mock('../../src/logging');
jest.mock('../../src/utils/FileUtils', () => ({
    FileUtils: {
        ensureDirectoryExists: jest.fn().mockResolvedValue(undefined)
    }
}));

describe('ConversationSessionRouter', () => {
    const makeLlmChunks = (...chunks: string[]) =>
        (async function* () { for (const chunk of chunks) { yield chunk; } })();

    let router: ConversationSessionRouter;
    let mockConversationManager: jest.Mocked<ConversationManager>;
    let mockAgentManager: jest.Mocked<AgentManager>;
    let mockOfflineManager: jest.Mocked<OfflineManager>;
    let mockContext: CommandContext;

    beforeEach(() => {
        // Clear all mocks and timers
        jest.clearAllMocks();
        jest.clearAllTimers();

        // Create mocks
        mockConversationManager = {
            getSession: jest.fn(),
            continueConversation: jest.fn(),
        } as any;

        mockAgentManager = {
            getCurrentAgent: jest.fn(),
            buildAgentContext: jest.fn(),
        } as any;

        mockOfflineManager = {
            isOffline: jest.fn().mockReturnValue(false),
        } as any;

        // Create router
        router = new ConversationSessionRouter(
            mockConversationManager,
            mockAgentManager,
            undefined,
            mockOfflineManager
        );
        DocSessionManager.getInstance().clearAll();

        // Create mock context
        mockContext = {
            request: createMockChatRequest('test message'),
            stream: createMockChatResponseStream(),
            token: { isCancellationRequested: false } as any,
            workspaceRoot: '/test/workspace',
            extensionContext: {} as any
        };
    });

    afterEach(() => {
        // Clean up resources
        jest.clearAllMocks();
        jest.clearAllTimers();

        // Clean up router state
        if (router) {
            try {
                router.clearActiveSession();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        DocSessionManager.getInstance().clearAll();
    });

    describe('routeUserInput', () => {
        it('should route to conversation when active session exists', async () => {
            // Setup
            const sessionId = 'test-session-123';
            const mockSession = {
                sessionId,
                state: { isActive: true },
                agentName: 'test-agent'
            };

            router.setActiveSession(sessionId, {
                agentName: 'test-agent',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            });

            mockConversationManager.getSession.mockReturnValue(mockSession as any);
            mockConversationManager.continueConversation.mockResolvedValue({
                agentMessage: 'Test response',
                followupQuestions: [],
                documentUpdates: [],
                workflowSuggestions: [],
                progressUpdate: null,
                conversationComplete: false
            } as any);

            // Execute
            const result = await router.routeUserInput('test input', mockContext);

            // Verify
            expect(result.routedTo).toBe('conversation');
            expect(result.sessionId).toBe(sessionId);
            expect(result.response).toBe('Test response');
            expect(result.shouldContinue).toBe(true);
            expect(mockConversationManager.continueConversation).toHaveBeenCalledWith(sessionId, 'test input');
        });

        it('should route to agent when no active session exists', async () => {
            // Setup
            const mockAgent = {
                name: 'test-agent',
                handleRequest: jest.fn().mockResolvedValue({
                    content: 'Agent response'
                })
            };

            mockAgentManager.getCurrentAgent.mockReturnValue(mockAgent as any);
            mockAgentManager.buildAgentContext.mockReturnValue({} as any);

            // Execute
            const result = await router.routeUserInput('test input', mockContext);

            // Verify
            expect(result.routedTo).toBe('agent');
            expect(result.agentName).toBe('test-agent');
            expect(result.response).toBe('Agent response');
            expect(result.shouldContinue).toBe(false);
            expect(mockAgent.handleRequest).toHaveBeenCalled();
        });

        it('should route non-kickoff prompts to active agent even when model is selected', async () => {
            const mockAgent = {
                name: 'test-agent',
                handleRequest: jest.fn().mockResolvedValue({
                    content: 'Agent response'
                })
            };

            mockAgentManager.getCurrentAgent.mockReturnValue(mockAgent as any);
            mockAgentManager.buildAgentContext.mockReturnValue({} as any);
            mockContext.model = {} as any;

            const result = await router.routeUserInput('how should I prioritize risk controls?', mockContext);

            expect(result.routedTo).toBe('agent');
            expect(result.agentName).toBe('test-agent');
            expect(result.response).toBe('Agent response');
            expect(mockAgent.handleRequest).toHaveBeenCalledTimes(1);
        });

        it('should return error when no agent is available', async () => {
            // Setup
            mockAgentManager.getCurrentAgent.mockReturnValue(undefined);

            // Execute
            const result = await router.routeUserInput('test input', mockContext);

            // Verify
            expect(result.routedTo).toBe('error');
            expect(result.error).toBe('No active agent available');
        });

        it('should clean up invalid session and route to agent', async () => {
            // Setup
            const sessionId = 'invalid-session';
            router.setActiveSession(sessionId);

            mockConversationManager.getSession.mockReturnValue(null); // Session doesn't exist

            const mockAgent = {
                name: 'test-agent',
                handleRequest: jest.fn().mockResolvedValue({
                    content: 'Agent response'
                })
            };
            mockAgentManager.getCurrentAgent.mockReturnValue(mockAgent as any);
            mockAgentManager.buildAgentContext.mockReturnValue({} as any);

            // Execute
            const result = await router.routeUserInput('test input', mockContext);

            // Verify
            expect(result.routedTo).toBe('agent');
            expect(router.hasActiveSession()).toBe(false); // Session should be cleared
        });

        it('should handle conversation errors gracefully', async () => {
            // Setup
            const sessionId = 'test-session';
            router.setActiveSession(sessionId);

            const mockSession = { sessionId, state: { isActive: true } };
            mockConversationManager.getSession.mockReturnValue(mockSession as any);
            mockConversationManager.continueConversation.mockRejectedValue(new Error('Conversation failed'));

            // Execute
            const result = await router.routeUserInput('test input', mockContext);

            // Verify
            expect(result.routedTo).toBe('error');
            expect(result.error).toContain('Conversation error');
            expect(router.hasActiveSession()).toBe(false); // Session should be cleared
        });

        it('should start doc session for kickoff input when auto-chat is active from agent set', async () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((_key: string, defaultValue: any) => defaultValue)
            });

            const autoChatManager = router.getAutoChatManager();
            autoChatManager?.enableAutoChat('prd-creator');
            expect(autoChatManager?.isAutoChatActive()).toBe(true);

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
            mockContext.model = model as any;

            const result = await router.routeUserInput(
                'this will be a project that will train local models for Forex exchange trading using unsloth',
                mockContext
            );

            expect(result.routedTo).toBe('conversation');
            expect(result.shouldContinue).toBe(true);
            expect(result.response).toContain('PRD Creator');
            expect(model.sendRequest).toHaveBeenCalledTimes(3);
            expect(autoChatManager?.isAutoChatActive()).toBe(false);
        });

        it('should route auto-chat messages without document context to active agent', async () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((_key: string, defaultValue: any) => defaultValue)
            });

            const mockAgent = {
                name: 'prd-creator',
                handleRequest: jest.fn().mockResolvedValue({
                    content: 'Agent direct response'
                })
            };
            mockAgentManager.getCurrentAgent.mockReturnValue(mockAgent as any);
            mockAgentManager.buildAgentContext.mockReturnValue({} as any);

            const autoChatManager = router.getAutoChatManager();
            autoChatManager?.enableAutoChat('prd-creator');

            mockContext.model = {} as any;
            const result = await router.routeUserInput('hello there, help me think this through', mockContext);

            expect(result.routedTo).toBe('agent');
            expect(result.response).toBe('Agent direct response');
            expect(result.shouldContinue).toBe(true);
            expect(mockAgent.handleRequest).toHaveBeenCalledTimes(1);
            expect(mockConversationManager.continueConversation).not.toHaveBeenCalled();
        });

        it('should route document-bound auto-chat through doc session manager', async () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((_key: string, defaultValue: any) => defaultValue)
            });

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from('# Existing Doc\n\nInitial content')
            );
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            const autoChatManager = router.getAutoChatManager();
            autoChatManager?.enableAutoChat('prd-creator', '/test/workspace/docs/prd/existing-doc.md', {
                templateId: 'prd'
            });

            const model = {
                sendRequest: jest.fn().mockResolvedValue({
                    text: makeLlmChunks('Which trading risk limits are mandatory for v1?')
                })
            };
            mockContext.model = model as any;

            const result = await router.routeUserInput(
                'Add risk controls and leverage limits to the document.',
                mockContext
            );

            expect(result.routedTo).toBe('conversation');
            expect(result.shouldContinue).toBe(true);
            expect(result.response).toContain('Which trading risk limits are mandatory for v1?');
            expect(model.sendRequest).toHaveBeenCalledTimes(1);
            expect(mockConversationManager.continueConversation).not.toHaveBeenCalled();
        });

        it('should resume the last completed document for revision-style prompts instead of starting a new doc', async () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((_key: string, defaultValue: any) => defaultValue)
            });

            (vscode.workspace.fs.readFile as jest.Mock)
                .mockResolvedValue(Buffer.from('# Local Forex Model Training Using Unsloth\n\nInitial content.'))
                .mockResolvedValue(Buffer.from('# Local Forex Model Training Using Unsloth\n\nUpdated content.'));
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            const model = {
                sendRequest: jest.fn()
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('{"docType":"brainstorm","title":"Local Forex Model Training Using Unsloth"}')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('# Local Forex Model Training Using Unsloth\n\n## Overview\nInitial draft.')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('What is the most critical risk to address first?')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks(
                            '---DOCUMENT---\n# Local Forex Model Training Using Unsloth\n\n## Overview\nImproved with fixes from review.\n---QUESTION---\nWhich remaining risk should we refine next?'
                        )
                    }))
            };
            mockContext.model = model as any;

            const kickoff = await router.routeUserInput(
                'this will be a project that will train local models for Forex exchange trading using unsloth',
                mockContext
            );
            expect(kickoff.routedTo).toBe('conversation');
            expect(kickoff.shouldContinue).toBe(true);

            const done = await router.routeUserInput('done', mockContext);
            expect(done.routedTo).toBe('conversation');
            expect(done.shouldContinue).toBe(false);
            expect(done.response).toContain('Session complete');

            const revision = await router.routeUserInput(
                'fix the issues found in the document',
                mockContext
            );
            expect(revision.routedTo).toBe('conversation');
            expect(revision.shouldContinue).toBe(true);
            expect(revision.response).toContain('Which remaining risk should we refine next?');

            // 3 startup calls (classify + draft + first question) + 1 refinement call.
            expect(model.sendRequest).toHaveBeenCalledTimes(4);
        });

        it('should require confirmation before switching to a new document when context is ambiguous', async () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((_key: string, defaultValue: any) => defaultValue)
            });

            (vscode.workspace.fs.readFile as jest.Mock)
                .mockResolvedValue(Buffer.from('# Existing Doc\n\nInitial content'))
                .mockResolvedValue(Buffer.from('# Existing Doc\n\nRefined content'));
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            const model = {
                sendRequest: jest.fn()
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('{"docType":"brainstorm","title":"Existing Doc"}')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('# Existing Doc\n\n## Overview\nInitial draft.')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('What should we refine first?')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks(
                            '{"action":"start_new_doc","confidence":0.64,"reason":"User asked to switch documents.","requiresConfirmation":true,"targetDocType":"spec","targetAgent":"specification-writer"}'
                        )
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('# Deployment Hardening Spec\n\n## Scope\nInitial spec draft.')
                    }))
                    .mockImplementationOnce(() => Promise.resolve({
                        text: makeLlmChunks('Which security controls should be mandatory in phase one?')
                    }))
            };
            mockContext.model = model as any;

            const kickoff = await router.routeUserInput('this will be a project for algo trading docs', mockContext);
            expect(kickoff.routedTo).toBe('conversation');
            expect(kickoff.shouldContinue).toBe(true);

            await router.routeUserInput('done', mockContext);

            const switchPrompt = await router.routeUserInput('switch to a new spec document for deployment hardening', mockContext);
            expect(switchPrompt.routedTo).toBe('agent');
            expect(switchPrompt.response).toContain('Reply `yes`');

            const confirmation = await router.routeUserInput('yes', mockContext);
            expect(confirmation.routedTo).toBe('conversation');
            expect(confirmation.response).toContain('Which security controls');
            expect(confirmation.shouldContinue).toBe(true);

            // Kickoff (3 calls) + intent analysis (1 call) + forced spec startup (2 calls).
            expect(model.sendRequest).toHaveBeenCalledTimes(6);
        });

        it('should resume the same doc session after the conversation-level session was cleared', async () => {
            // Inject a DocSession directly — no LLM bootstrap chain
            const docMgr = DocSessionManager.getInstance();
            const injectedSessionId = 'test-midflight-session';
            (docMgr as any).sessions.set(injectedSessionId, {
                id: injectedSessionId,
                docType: 'prd',
                agentName: 'prd-creator',
                documentPath: '/test/workspace/docs/prd/midflight.md',
                turnCount: 2,
                createdAt: new Date(),
                lastActivity: new Date()
            });

            // Router knows about the active doc session
            (router as any).activeDocSessionId = injectedSessionId;

            // Mock file reads and writes
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('# Mid Flight PRD\n\nDraft content.'));
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            // The model will be called inside DocSessionManager.continueSession.refineDocument
            const resumeModel = {
                sendRequest: jest.fn().mockResolvedValue({
                    text: (async function* () {
                        yield '---DOCUMENT---\n# Mid Flight PRD\n\nUpdated content.\n---QUESTION---\nWhat risk controls should we add?';
                    })()
                })
            };
            mockContext.model = resumeModel as any;

            const resume = await router.routeUserInput('please add more detail to the risk section', mockContext);

            // Router should continue the active doc session
            expect(resume.routedTo).toBe('conversation');
            expect(resume.shouldContinue).toBe(true);
            expect(resume.response).toContain('What risk controls should we add?');
        });

        it('should return a graceful fallback response when the LLM throws during an active doc session continuation', async () => {
            // Inject DocSession state — no LLM bootstrap needed
            const docMgr = DocSessionManager.getInstance();
            const injectedSessionId = 'test-llm-failure-session';
            (docMgr as any).sessions.set(injectedSessionId, {
                id: injectedSessionId,
                docType: 'prd',
                agentName: 'prd-creator',
                documentPath: '/test/workspace/docs/prd/my-doc.md',
                turnCount: 1,
                createdAt: new Date(),
                lastActivity: new Date()
            });

            // Wire up router to the injected session
            (router as any).activeDocSessionId = injectedSessionId;

            // File read works fine, but the model call inside refineDocument throws
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('# My Doc\n\nContent.'));
            const throwingModel = {
                sendRequest: jest.fn().mockRejectedValue(new Error('LLM service unavailable'))
            };
            mockContext.model = throwingModel as any;

            const result = await router.routeUserInput('please add the risk section', mockContext);

            // DocSessionManager swallows LLM errors and returns a soft fallback so the session stays alive
            expect(result.routedTo).toBe('conversation');
            expect(result.shouldContinue).toBe(true);
            // The response should contain a fallback question
            expect(result.response).toBeTruthy();

            // Session is still active (graceful degradation — user can retry)
            expect((router as any).activeDocSessionId).toBe(injectedSessionId);
        });

    });

    describe('session management', () => {
        it('should set and get active session', () => {
            const sessionId = 'test-session';
            const metadata = {
                agentName: 'test-agent',
                documentPath: '/test/doc.md',
                templateId: 'prd',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 5,
                responseCount: 2
            };

            router.setActiveSession(sessionId, metadata);

            expect(router.hasActiveSession()).toBe(true);
            expect(router.getSessionMetadata(sessionId)).toEqual(metadata);
            expect(router.getSessionByAgent('test-agent')).toBe(sessionId);
        });

        it('should clear active session', () => {
            const sessionId = 'test-session';
            router.setActiveSession(sessionId, {
                agentName: 'test-agent',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            });

            expect(router.hasActiveSession()).toBe(true);

            router.clearActiveSession();

            expect(router.hasActiveSession()).toBe(false);
            expect(router.getSessionMetadata(sessionId)).toBeNull();
        });

        it('should update session activity', () => {
            const sessionId = 'test-session';
            const startTime = new Date();

            router.setActiveSession(sessionId, {
                agentName: 'test-agent',
                startedAt: startTime,
                lastActivity: startTime,
                questionCount: 1,
                responseCount: 0
            });

            router.updateSessionActivity(sessionId);

            const metadata = router.getSessionMetadata(sessionId);
            expect(metadata?.responseCount).toBe(1);
            expect(metadata?.lastActivity.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        });

        it('should clean up inactive sessions', () => {
            const oldTime = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago
            const sessionId = 'old-session';

            router.setActiveSession(sessionId, {
                agentName: 'test-agent',
                startedAt: oldTime,
                lastActivity: oldTime,
                questionCount: 1,
                responseCount: 0
            });

            expect(router.hasActiveSession()).toBe(true);

            router.cleanupInactiveSessions();

            expect(router.hasActiveSession()).toBe(false);
            expect(router.getSessionMetadata(sessionId)).toBeNull();
        });
    });

    describe('session state', () => {
        it('should return current session state', () => {
            const sessionId = 'test-session';
            const metadata = {
                agentName: 'test-agent',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            };

            router.setActiveSession(sessionId, metadata);

            const state = router.getSessionState();

            expect(state.activeSessionId).toBe(sessionId);
            expect(state.sessionsByAgent.get('test-agent')).toBe(sessionId);
            expect(state.sessionMetadata.get(sessionId)).toMatchObject({
                agentName: 'test-agent',
                questionCount: 1,
                responseCount: 0,
            });
        });

        it('should handle empty session state', () => {
            const state = router.getSessionState();

            expect(state.activeSessionId).toBeNull();
            expect(state.sessionsByAgent.size).toBe(0);
            expect(state.sessionMetadata.size).toBe(0);
        });
    });
});
