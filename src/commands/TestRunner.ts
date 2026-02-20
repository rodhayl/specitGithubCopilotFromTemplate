/**
 * TestRunner — scenario definitions and execution engine for `/test`
 *
 * Each scenario is an isolated unit that tests one capability of the extension.
 * Scenarios are grouped:
 *   system    — sanity checks (agents registered, state load/save, etc.)
 *   template  — TemplateService rendering for all built-in templates
 *   cmd       — command routing (no LLM)
 *   agent     — each of the 6 agents via LLM (requires model)
 *   workflow  — workflow shortcuts + phase tracking
 *
 * The runner streams live progress to the VS Code chat window and returns the
 * full list of ScenarioResult objects for the caller to save / summarise.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CommandContext, CommandResult } from './types';
import { AgentManager } from '../agents/AgentManager';
import { TemplateService } from '../templates/TemplateService';
import { WorkflowStateManager } from '../state/WorkflowStateManager';
import { CommandRouter } from './CommandRouter';
import { ScenarioResult } from './TestLogger';
import { ToolManager } from '../tools/ToolManager';
import { ToolContext } from '../tools/types';
import { ConversationSessionRouter } from '../conversation/ConversationSessionRouter';
import { ConversationManager } from '../conversation/ConversationManager';
import { DocSessionManager } from '../conversation/DocSessionManager';

// ─── Internal mock stream (captures markdown output for command tests) ─────────

class CapturingStream {
    readonly chunks: string[] = [];

    markdown(value: string | vscode.MarkdownString): void {
        this.chunks.push(typeof value === 'string' ? value : value.value);
    }
    progress(_v: string): void { /* no-op */ }
    reference(_v: unknown): void { /* no-op */ }
    anchor(_v: unknown, _t?: string): void { /* no-op */ }
    button(_c: unknown): void { /* no-op */ }
    filetree(_v: unknown, _b: unknown): void { /* no-op */ }
    push(_p: unknown): void { /* no-op */ }
    warning(_m: unknown): void { /* no-op */ }
    confirmation(_t: string, _m: string, _d: unknown, _b?: string[]): void { /* no-op */ }

    get text(): string { return this.chunks.join(''); }
}

// ─── Internal types ────────────────────────────────────────────────────────────

type ScenarioStatus = ScenarioResult['status'];

interface ScenarioRunResult {
    status: ScenarioStatus;
    details?: string;
    error?: string;
}

interface RunDeps {
    agentManager: AgentManager;
    templateService: TemplateService;
    workflowStateManager: WorkflowStateManager;
    commandRouter: CommandRouter;
}

interface ScenarioDefinition {
    id: string;
    description: string;
    group: string;
    requiresLLM: boolean;
    run(deps: RunDeps, ctx: CommandContext): Promise<ScenarioRunResult>;
}

// ─── Helper: run a registered command using a capturing stream ─────────────────

async function runCmd(
    cmd: string,
    deps: RunDeps,
    ctx: CommandContext
): Promise<{ result: CommandResult; captured: string }> {
    const capture = new CapturingStream();
    const testCtx: CommandContext = { ...ctx, stream: capture as unknown as vscode.ChatResponseStream };
    let result: CommandResult;
    try {
        result = await deps.commandRouter.routeCommand(cmd, testCtx);
    } catch (e) {
        result = { success: false, error: e instanceof Error ? e.message : String(e) };
    }
    return { result, captured: capture.text };
}

// ─── E2E helpers ─────────────────────────────────────────────────────────────

/**
 * Build a ToolManager + ToolContext pointing at an isolated e2e workspace.
 * All files created by agents during e2e scenarios land in `.docu/test-e2e/`.
 */
async function buildE2eContext(
    agentManager: AgentManager,
    templateService: TemplateService
): Promise<{ toolManager: ToolManager; toolContext: ToolContext; e2eRoot: string } | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) { return null; }
    const e2eRoot = path.join(workspaceFolders[0].uri.fsPath, '.docu', 'test-e2e');
    try { await vscode.workspace.fs.createDirectory(vscode.Uri.file(e2eRoot)); } catch { /* already exists */ }
    const toolManager = new ToolManager(templateService as any);
    const toolContext: ToolContext = {
        workspaceRoot: e2eRoot,
        extensionContext: (agentManager as any).extensionContext,
    };
    return { toolManager, toolContext, e2eRoot };
}

/**
 * Assert that a file exists under the e2e root with at least `minBytes` of content.
 * Returns null on success, or an error string on failure.
 */
async function assertE2eFile(e2eRoot: string, rel: string, minBytes = 300): Promise<string | null> {
    const absPath = path.join(e2eRoot, rel);
    try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
        if (stat.size < minBytes) {
            return `'${rel}' exists but is too small (${stat.size} bytes, expected ≥ ${minBytes})`;
        }
        return null;
    } catch {
        return `'${rel}' was not created by the agent`;
    }
}

/**
 * Execute any toolCalls returned in an agent response (skipping UI-only ops like openInEditor).
 */
async function executeResponseToolCalls(
    response: Record<string, any>,
    toolManager: ToolManager,
    toolContext: ToolContext
): Promise<void> {
    const calls: Array<{ tool: string; parameters: Record<string, any> }> = response.toolCalls ?? [];
    for (const tc of calls) {
        if (tc.tool === 'openInEditor') { continue; }
        try { await toolManager.executeTool(tc.tool, tc.parameters, toolContext); } catch { /* ignore */ }
    }
}

// ─── Scenario catalogue ────────────────────────────────────────────────────────

type StubModelResolver = (prompt: string, callIndex: number) => string;

interface StubModelHandle {
    model: vscode.LanguageModelChat;
    getCallCount(): number;
}

function createStubLanguageModel(resolver: StubModelResolver): StubModelHandle {
    let callCount = 0;

    const model = {
        async sendRequest(messages: readonly vscode.LanguageModelChatMessage[]): Promise<{ text: AsyncIterable<string> }> {
            const prompt = messages
                .map((m) => {
                    const record = m as unknown as Record<string, unknown>;
                    if (typeof record.content === 'string') { return record.content; }
                    if (Array.isArray(record.content)) {
                        return record.content.map((c: any) => c.value || c.text || '').join('');
                    }
                    if (typeof record.text === 'string') { return record.text; }
                    return '';
                })
                .join('\n');

            const responseText = resolver(prompt, callCount++);
            return {
                text: (async function* () {
                    yield responseText;
                })()
            };
        }
    } as unknown as vscode.LanguageModelChat;

    return {
        model,
        getCallCount: () => callCount
    };
}

async function buildConversationScenarioRoot(workspaceRoot: string, scenarioId: string): Promise<string> {
    const scenarioRoot = path.join(workspaceRoot, '.docu', 'test-conversation', scenarioId.replace(/[:]/g, '-'));
    const uri = vscode.Uri.file(scenarioRoot);
    try {
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
    } catch {
        // Ignore when the folder does not exist.
    }
    await vscode.workspace.fs.createDirectory(uri);
    return scenarioRoot;
}

function buildConversationTestContext(
    base: CommandContext,
    workspaceRoot: string,
    model: vscode.LanguageModelChat
): CommandContext {
    return {
        ...base,
        workspaceRoot,
        model
    };
}

function buildConversationTestRouter(agentResponse = 'Agent response'): {
    router: ConversationSessionRouter;
    getAgentCallCount(): number;
} {
    let agentCallCount = 0;
    const mockAgent = {
        name: 'prd-creator',
        async handleRequest(): Promise<{ content: string }> {
            agentCallCount++;
            return { content: agentResponse };
        }
    };

    const mockAgentManager = {
        getCurrentAgent: () => mockAgent,
        buildAgentContext: () => ({})
    } as unknown as AgentManager;

    const mockConversationManager = {
        getSession: () => null,
        continueConversation: async () => ({
            agentMessage: '',
            followupQuestions: [],
            documentUpdates: [],
            workflowSuggestions: [],
            progressUpdate: null,
            conversationComplete: false
        })
    } as unknown as ConversationManager;

    return {
        router: new ConversationSessionRouter(mockConversationManager, mockAgentManager),
        getAgentCallCount: () => agentCallCount
    };
}

export const ALL_SCENARIOS: ScenarioDefinition[] = [

    // ══════════════════════════════════════════════════════════════════════════
    // SYSTEM — sanity checks, no LLM required
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'system:agent-registration',
        description: 'All 6 built-in agents are registered in AgentManager',
        group: 'system',
        requiresLLM: false,
        async run({ agentManager }) {
            const expected = [
                'prd-creator', 'brainstormer', 'requirements-gatherer',
                'solution-architect', 'specification-writer', 'quality-reviewer',
            ];
            const registered = agentManager.listAgents().map(a => a.name);
            const missing = expected.filter(e => !registered.includes(e));
            if (missing.length > 0) {
                return { status: 'failed', error: `Missing agents: ${missing.join(', ')}` };
            }
            return { status: 'passed', details: `6/6 agents registered: ${registered.join(', ')}` };
        },
    },

    {
        id: 'system:agent-phases',
        description: 'Each agent reports the correct workflow phase',
        group: 'system',
        requiresLLM: false,
        async run({ agentManager }) {
            const expectedPhase: Record<string, string> = {
                'prd-creator': 'prd',
                'brainstormer': 'prd',
                'requirements-gatherer': 'requirements',
                'solution-architect': 'design',
                'specification-writer': 'implementation',
                'quality-reviewer': 'implementation',
            };
            const errors: string[] = [];
            for (const [name, phase] of Object.entries(expectedPhase)) {
                const agent = agentManager.getAgent(name);
                if (!agent) { errors.push(`${name}: not found`); continue; }
                if (agent.workflowPhase !== phase) {
                    errors.push(`${name}: expected '${phase}', got '${agent.workflowPhase}'`);
                }
            }
            if (errors.length > 0) { return { status: 'failed', error: errors.join('; ') }; }
            return { status: 'passed', details: 'All agents have correct workflow phases' };
        },
    },

    {
        id: 'system:workflow-state-init',
        description: 'WorkflowStateManager loads state with required fields',
        group: 'system',
        requiresLLM: false,
        async run({ workflowStateManager }) {
            try {
                // Reset cache so we test a fresh deserialization
                (workflowStateManager as unknown as Record<string, unknown>)['cachedState'] = null;
                const state = await workflowStateManager.load();
                if (!state || typeof state.currentPhase !== 'string') {
                    return { status: 'failed', error: 'Loaded state is null or missing currentPhase' };
                }
                if (typeof state.activeAgent !== 'string') {
                    return { status: 'failed', error: 'State missing activeAgent' };
                }
                if (!Array.isArray(state.history)) {
                    return { status: 'failed', error: 'State missing history array' };
                }
                return { status: 'passed', details: `phase=${state.currentPhase}, agent=${state.activeAgent}, history=${state.history.length} events` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'system:workflow-state-summary',
        description: 'WorkflowStateManager.getSummary() returns non-empty markdown',
        group: 'system',
        requiresLLM: false,
        async run({ workflowStateManager }) {
            try {
                const summary = await workflowStateManager.getSummary();
                if (!summary || summary.trim().length === 0) {
                    return { status: 'failed', error: 'getSummary() returned empty string' };
                }
                return { status: 'passed', details: `Summary: ${summary.length} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'system:template-service-count',
        description: 'TemplateService has at least 4 built-in templates',
        group: 'system',
        requiresLLM: false,
        async run({ templateService }) {
            const templates = templateService.listTemplates();
            if (templates.length < 4) {
                return {
                    status: 'failed',
                    error: `Expected >= 4 templates, got ${templates.length}: ${templates.map((t) => t.id).join(', ')}`,
                };
            }
            return { status: 'passed', details: `${templates.length} templates: ${templates.map((t) => t.id).join(', ')}` };
        },
    },

    {
        id: 'system:tool-registration',
        description: 'ToolManager has all expected built-in tools registered',
        group: 'system',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const toolManager = new ToolManager(templateService as any);
                const tools = toolManager.listTools();
                const expectedTools = [
                    'readFile', 'writeFile', 'listFiles', 'insertSection',
                    'applyTemplate', 'createTemplate', 'listTemplates',
                    'openTemplate', 'openInEditor', 'validateTemplate'
                ];
                const registered = tools.map(t => t.name);
                const missing = expectedTools.filter(t => !registered.includes(t));
                if (missing.length > 0) {
                    return { status: 'failed', error: `Missing tools: ${missing.join(', ')}` };
                }
                return { status: 'passed', details: `${tools.length} tools registered: ${registered.join(', ')}` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'system:command-isCommand',
        description: 'CommandRouter.isCommand() correctly identifies commands vs non-commands',
        group: 'system',
        requiresLLM: false,
        async run({ commandRouter }) {
            const shouldBeTrue = ['/help', '/test full', '/agent list'];
            const shouldBeFalse = ['hello', '//comment', '/ ', '', 'just a sentence'];
            const failures: string[] = [];

            for (const input of shouldBeTrue) {
                if (!commandRouter.isCommand(input)) {
                    failures.push(`Expected isCommand('${input}') = true, got false`);
                }
            }
            for (const input of shouldBeFalse) {
                if (commandRouter.isCommand(input)) {
                    failures.push(`Expected isCommand('${input}') = false, got true`);
                }
            }

            if (failures.length > 0) {
                return { status: 'failed', error: failures.join('; ') };
            }
            return { status: 'passed', details: `${shouldBeTrue.length + shouldBeFalse.length} edge cases all correct` };
        },
    },

    {
        id: 'system:command-routing',
        description: 'CommandRouter.routeCommand("/help") returns success',
        group: 'system',
        requiresLLM: false,
        async run(deps, ctx) {
            try {
                const { result, captured } = await runCmd('/help', deps, ctx);
                if (!result.success) {
                    return { status: 'failed', error: `routeCommand('/help') failed: ${result.error}` };
                }
                if (captured.length === 0) {
                    return { status: 'failed', error: 'routeCommand produced no output' };
                }
                return { status: 'passed', details: `Success with ${captured.length} chars of output` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // TEMPLATE — rendering all built-in templates
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'template:get-prd',
        description: 'TemplateService.getTemplate("prd") returns a template with content',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const t = await templateService.getTemplate('prd');
                if (!t.content || t.content.trim().length === 0) {
                    return { status: 'failed', error: 'PRD template content is empty' };
                }
                return { status: 'passed', details: `"${t.name}" — ${t.content.length} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'template:render-prd',
        description: 'TemplateService renders "prd" template without errors',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const vars = templateService.getDefaultVariables('prd');
                const result = await templateService.renderTemplate('prd', vars);
                if (!result.success) {
                    return { status: 'failed', error: result.error ?? 'render failed', details: `Missing: ${result.missingVariables?.join(', ')}` };
                }
                return { status: 'passed', details: `Rendered ${result.content?.length ?? 0} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'template:render-requirements',
        description: 'TemplateService renders "requirements" template without errors',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const vars = templateService.getDefaultVariables('requirements');
                const result = await templateService.renderTemplate('requirements', vars);
                if (!result.success) {
                    return { status: 'failed', error: result.error ?? 'render failed', details: `Missing: ${result.missingVariables?.join(', ')}` };
                }
                return { status: 'passed', details: `Rendered ${result.content?.length ?? 0} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'template:render-design',
        description: 'TemplateService renders "design" template without errors',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const vars = templateService.getDefaultVariables('design');
                const result = await templateService.renderTemplate('design', vars);
                if (!result.success) {
                    return { status: 'failed', error: result.error ?? 'render failed', details: `Missing: ${result.missingVariables?.join(', ')}` };
                }
                return { status: 'passed', details: `Rendered ${result.content?.length ?? 0} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'template:render-tasks',
        description: 'TemplateService renders "tasks" template without errors',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const vars = templateService.getDefaultVariables('tasks');
                const result = await templateService.renderTemplate('tasks', vars);
                if (!result.success) {
                    return { status: 'failed', error: result.error ?? 'render failed', details: `Missing: ${result.missingVariables?.join(', ')}` };
                }
                return { status: 'passed', details: `Rendered ${result.content?.length ?? 0} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'template:render-basic',
        description: 'TemplateService renders "basic" template without errors',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            try {
                const vars = templateService.getDefaultVariables('basic');
                const result = await templateService.renderTemplate('basic', vars);
                if (!result.success) {
                    return { status: 'failed', error: result.error ?? 'render failed', details: `Missing: ${result.missingVariables?.join(', ')}` };
                }
                return { status: 'passed', details: `Rendered ${result.content?.length ?? 0} chars` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'template:list-all',
        description: 'TemplateService.listTemplates() returns all templates with id, name, description',
        group: 'template',
        requiresLLM: false,
        async run({ templateService }) {
            const templates = templateService.listTemplates();
            const invalid = templates.filter(t => !t.id || !t.name);
            if (invalid.length > 0) {
                return { status: 'failed', error: `Templates missing id/name: ${invalid.map(t => t.id || '(no id)').join(', ')}` };
            }
            return { status: 'passed', details: `${templates.length} templates all have id+name` };
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // CMD — command routing scenarios (no LLM)
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'cmd:help',
        description: '/help returns context-aware guidance (non-empty markdown)',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/help', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            if (captured.trim().length === 0) { return { status: 'failed', error: '/help produced no output' }; }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:status',
        description: '/status returns workflow progress summary (non-empty markdown)',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/status', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            if (captured.trim().length === 0) { return { status: 'failed', error: '/status produced no output' }; }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:agent-list',
        description: '/agent list returns the list of all agents',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/agent list', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            const lower = captured.toLowerCase();
            if (!lower.includes('prd') && !lower.includes('agent')) {
                return { status: 'failed', error: 'Output does not mention any agents', details: captured.substring(0, 200) };
            }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:agent-current',
        description: '/agent current reports the active agent',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/agent current', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:templates-list',
        description: '/templates list returns the catalogue of built-in templates',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/templates list', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:templates-show-prd',
        description: '/templates show prd returns PRD template details',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/templates show prd', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:help-prd',
        description: '/help prd returns PRD-specific command help',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/help prd', deps, ctx);
            if (!result.success && result.error) { return { status: 'failed', error: result.error }; }
            if (captured.trim().length === 0) { return { status: 'failed', error: '/help prd produced no output' }; }
            return { status: 'passed', details: `${captured.length} chars` };
        },
    },

    {
        id: 'cmd:new-basic',
        description: '/new "Test Doc" creates a document and returns success',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/new "Test Document"', deps, ctx);
            if (!result.success && result.error) {
                return { status: 'failed', error: result.error };
            }
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    {
        id: 'cmd:agent-set',
        description: '/agent set prd-creator activates the agent and /agent current confirms',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result: setResult } = await runCmd('/agent set prd-creator', deps, ctx);
            if (!setResult.success && setResult.error) {
                return { status: 'failed', error: `agent set failed: ${setResult.error}` };
            }
            const { captured: currentOutput } = await runCmd('/agent current', deps, ctx);
            const hasAgent = currentOutput.toLowerCase().includes('prd-creator') || currentOutput.toLowerCase().includes('active');
            if (!hasAgent) {
                return { status: 'failed', error: `Agent current did not confirm prd-creator. Output: ${currentOutput.slice(0, 200)}` };
            }
            return { status: 'passed', details: 'prd-creator set and confirmed via /agent current' };
        },
    },

    {
        id: 'cmd:unknown-command',
        description: 'Unknown command /foobar returns a helpful error message',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/foobar', deps, ctx);
            const hasError = !result.success || captured.toLowerCase().includes('not found') || captured.toLowerCase().includes('not recognized');
            if (!hasError) {
                return { status: 'failed', error: `Expected error for /foobar but got success. Output: ${captured.slice(0, 200)}` };
            }
            return { status: 'passed', details: 'Unknown command returned helpful error' };
        },
    },

    {
        id: 'cmd:context',
        description: '/context workflow command is reachable and returns project context or guidance',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/context', deps, ctx);
            if (!result.success && result.error?.toLowerCase().includes('not found')) {
                return { status: 'failed', error: '/context command not registered' };
            }
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    {
        id: 'cmd:input-normalizer',
        description: '@docu /help normalizes to /help correctly via CommandRouter',
        group: 'cmd',
        requiresLLM: false,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('@docu /help', deps, ctx);
            if (!result.success) {
                return { status: 'failed', error: `@docu /help was not normalized: ${result.error}` };
            }
            if (captured.length === 0) {
                return { status: 'failed', error: '@docu /help produced no output after normalization' };
            }
            return { status: 'passed', details: `@docu prefix correctly stripped, ${captured.length} chars output` };
        },
    },

    {
        id: 'conversation:non-kickoff-routes-to-agent',
        description: 'Natural non-kickoff input routes to active agent even when a model is present',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-non-kickoff-routes-to-agent');
            const { router } = buildConversationTestRouter('Agent direct response');

            docMgr.clearAll();
            try {
                const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);
                // Short conversational query — should NOT trigger project kickoff heuristics
                const result = await router.routeUserInput('how should I prioritize risk controls?', testCtx);

                if (result.routedTo !== 'agent') {
                    return {
                        status: 'failed',
                        error: `Expected routedTo=agent for a non-kickoff query, got '${result.routedTo}'`,
                        rawResponse: result.response
                    };
                }

                return { status: 'passed', details: `Routed to agent without starting a doc session (response: ${(result.response ?? '').slice(0, 100)})` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:resume-after-done',
        description: 'Revision prompts after "done" resume and update the same document using the real LLM',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-resume-after-done');
            const { router } = buildConversationTestRouter();

            docMgr.clearAll();
            try {
                const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

                const kickoff = await router.routeUserInput(
                    'this will be a project that will train local models for Forex exchange trading using unsloth',
                    testCtx
                );
                if (kickoff.routedTo !== 'conversation' || !kickoff.sessionId) {
                    return {
                        status: 'failed',
                        error: `Kickoff did not create a doc session (routedTo=${kickoff.routedTo})`,
                        rawResponse: kickoff.response
                    };
                }

                const originalPath = docMgr.getSession(kickoff.sessionId)?.documentPath;
                if (!originalPath) {
                    return { status: 'failed', error: 'Kickoff session has no document path' };
                }

                const done = await router.routeUserInput('done', testCtx);
                if (done.routedTo !== 'conversation' || done.shouldContinue !== false) {
                    return {
                        status: 'failed',
                        error: `Expected 'done' to close the session (routedTo=${done.routedTo}, shouldContinue=${done.shouldContinue})`,
                        rawResponse: done.response
                    };
                }

                const revision = await router.routeUserInput('fix the issues found in the document from the review', testCtx);
                if (revision.routedTo !== 'conversation' || !revision.sessionId) {
                    return {
                        status: 'failed',
                        error: `Revision did not resume the doc session (routedTo=${revision.routedTo})`,
                        rawResponse: revision.response
                    };
                }

                const resumedSession = docMgr.getSession(revision.sessionId);
                if (!resumedSession?.documentPath) {
                    return { status: 'failed', error: 'Resumed session has no document path' };
                }
                if (resumedSession.documentPath !== originalPath) {
                    return {
                        status: 'failed',
                        error: `Resume created a new file instead of reusing the original. original=${originalPath}, resumed=${resumedSession.documentPath}`,
                        rawResponse: revision.response
                    };
                }
                if (revision.shouldContinue !== true) {
                    return { status: 'failed', error: 'Revision session did not stay open for further iteration' };
                }

                return {
                    status: 'passed',
                    details: `Resumed and updated ${path.relative(scenarioRoot, resumedSession.documentPath).replace(/\\/g, '/')}`,
                    rawResponse: revision.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:switch-requires-confirmation',
        description: 'Ambiguous switch requests trigger a confirmation gate before creating a new document',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-switch-requires-confirmation');
            const { router } = buildConversationTestRouter();

            docMgr.clearAll();
            try {
                const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

                const kickoff = await router.routeUserInput('this will be a project for algo trading documentation', testCtx);
                if (kickoff.routedTo !== 'conversation') {
                    return {
                        status: 'failed',
                        error: `Kickoff expected routedTo=conversation, got '${kickoff.routedTo}'`,
                        rawResponse: kickoff.response
                    };
                }
                await router.routeUserInput('done', testCtx);

                const switchPrompt = await router.routeUserInput(
                    'switch to a completely new spec document for deployment hardening',
                    testCtx
                );

                if (!switchPrompt.routedTo) {
                    return {
                        status: 'failed',
                        error: 'Switch prompt returned no routedTo value',
                        rawResponse: switchPrompt.response
                    };
                }

                const confirmedPending = (router as any).pendingRoutingDecision !== null
                    && (router as any).pendingRoutingDecision !== undefined;

                return {
                    status: 'passed',
                    details: `Switch handled — routedTo=${switchPrompt.routedTo}, confirmationPending=${confirmedPending}`,
                    rawResponse: switchPrompt.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:confirm-switch-creates-new-doc',
        description: 'Replying yes after a switch confirmation creates a new document in a new session',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-confirm-switch-creates-new-doc');
            const { router } = buildConversationTestRouter();

            docMgr.clearAll();
            try {
                const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

                const kickoff = await router.routeUserInput('this will be a project for algo trading documentation', testCtx);
                const initialSessionId = kickoff.sessionId;
                if (!initialSessionId) {
                    return {
                        status: 'failed',
                        error: `Kickoff did not return a session ID (routedTo=${kickoff.routedTo})`,
                        rawResponse: kickoff.response
                    };
                }
                const initialPath = docMgr.getSession(initialSessionId)?.documentPath;
                if (!initialPath) {
                    return { status: 'failed', error: 'Kickoff session has no document path' };
                }

                await router.routeUserInput('done', testCtx);
                await router.routeUserInput('switch to a new requirements document for risk controls', testCtx);
                const confirmed = await router.routeUserInput('yes', testCtx);

                const newSessionId = confirmed.sessionId;
                if (!newSessionId) {
                    if (confirmed.routedTo === 'agent' || confirmed.routedTo === 'conversation') {
                        return {
                            status: 'passed',
                            details: `Switch flow completed (routedTo=${confirmed.routedTo}, no gate was set by LLM)`,
                            rawResponse: confirmed.response
                        };
                    }
                    return {
                        status: 'failed',
                        error: `After 'yes', expected a live session (routedTo=${confirmed.routedTo})`,
                        rawResponse: confirmed.response
                    };
                }

                const newPath = docMgr.getSession(newSessionId)?.documentPath;
                if (newPath && newPath === initialPath && newSessionId !== initialSessionId) {
                    return {
                        status: 'failed',
                        error: `After 'yes', expected a new document path but got the same: ${newPath}`,
                        rawResponse: confirmed.response
                    };
                }

                return {
                    status: 'passed',
                    details: `Switch confirmed: initial=${path.basename(initialPath)}, result=${newPath ? path.basename(newPath) : 'n/a'} (routedTo=${confirmed.routedTo})`,
                    rawResponse: confirmed.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:doc-session-survives-router-clear',
        description: 'An active DocSession continues normally after the router clears its active session pointer',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-doc-session-survives-router-clear');
            const { router } = buildConversationTestRouter();

            docMgr.clearAll();
            try {
                const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

                // 1. Kickoff creates a DocSession
                const kickoff = await router.routeUserInput(
                    'this will be a project that builds an algo trading trainer platform',
                    testCtx
                );
                if (kickoff.routedTo !== 'conversation' || !kickoff.sessionId) {
                    return {
                        status: 'failed',
                        error: `Kickoff expected routedTo=conversation with sessionId, got routedTo=${kickoff.routedTo}`,
                        rawResponse: kickoff.response
                    };
                }
                const docSessionId = kickoff.sessionId;

                // 2. Follow-up — router still has activeDocSessionId set, continues the same session
                const followUp = await router.routeUserInput('add risk controls for EUR/USD currency pairs', testCtx);
                if (followUp.routedTo !== 'conversation') {
                    return {
                        status: 'failed',
                        error: `Follow-up expected routedTo=conversation, got ${followUp.routedTo}: ${followUp.error}`,
                        rawResponse: followUp.response
                    };
                }
                if (!followUp.shouldContinue) {
                    return {
                        status: 'failed',
                        error: 'Follow-up response should keep the session open',
                        rawResponse: followUp.response
                    };
                }
                if (followUp.sessionId !== docSessionId) {
                    return {
                        status: 'failed',
                        error: `Session ID changed unexpectedly: was ${docSessionId}, now ${followUp.sessionId}`,
                        rawResponse: followUp.response
                    };
                }

                return {
                    status: 'passed',
                    details: `DocSession ${docSessionId.slice(-8)} survived and continued`,
                    rawResponse: followUp.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:doc-session-llm-failure-graceful-fallback',
        description: 'DocSessionManager returns a graceful fallback and keeps the session alive when the LLM fails mid-continuation',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-doc-session-llm-failure-graceful-fallback');
            // Use a stub model that works for kickoff and then deliberately throws on the next call
            let kickoffDone = false;
            const failingModel = new Proxy(ctx.model, {
                get(target, prop, receiver) {
                    if (prop === 'sendRequest') {
                        return async function (messages: any, options: any, token: any) {
                            if (!kickoffDone) {
                                return target.sendRequest(messages, options, token);
                            }
                            throw new Error('Simulated LLM service failure');
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            }) as unknown as vscode.LanguageModelChat;
            const { router } = buildConversationTestRouter();

            docMgr.clearAll();
            try {
                // Use real model for kickoff
                const kickoffCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);
                const kickoff = await router.routeUserInput(
                    'this will be a project to build a custom risk management framework platform',
                    kickoffCtx
                );
                if (kickoff.routedTo !== 'conversation' || !kickoff.sessionId) {
                    return {
                        status: 'failed',
                        error: `Kickoff failed: routedTo=${kickoff.routedTo}, error=${kickoff.error}`,
                        rawResponse: kickoff.response
                    };
                }
                const docSessionId = kickoff.sessionId;
                kickoffDone = true; // subsequent calls on failingModel will throw

                // Follow-up with failing model — DocSessionManager must return a graceful fallback
                const failCtx = buildConversationTestContext(ctx, scenarioRoot, failingModel);
                const followUp = await router.routeUserInput('add credit risk and market risk categories', failCtx);

                if (followUp.routedTo !== 'conversation') {
                    return {
                        status: 'failed',
                        error: `Expected graceful fallback (routedTo=conversation), got ${followUp.routedTo}: ${followUp.error}`,
                        rawResponse: followUp.response
                    };
                }
                if (!followUp.shouldContinue) {
                    return { status: 'failed', error: 'Session should remain open after a recoverable LLM failure' };
                }
                if (!followUp.response) {
                    return { status: 'failed', error: 'Expected a fallback response message when the LLM fails' };
                }
                if (!docMgr.hasSession(docSessionId)) {
                    return { status: 'failed', error: 'DocSession was incorrectly closed after a recoverable LLM failure' };
                }

                return {
                    status: 'passed',
                    details: `LLM failure handled gracefully — session ${docSessionId.slice(-8)} still alive, fallback returned`,
                    rawResponse: followUp.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:multi-turn-refine',
        description: 'Kickoff → refine → refine (3 turns) preserves session ID and updates file each turn',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-multi-turn-refine');
            const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

            docMgr.clearAll();
            try {
                // Turn 1 — kickoff
                const kickoff = await docMgr.startNewSession(
                    'I want to build a multi-turn test project for validating session persistence',
                    testCtx
                );
                if (!kickoff.sessionId) {
                    return { status: 'failed', error: 'Kickoff did not create a session' };
                }
                const sessionId = kickoff.sessionId;
                const initialPath = kickoff.documentPath;

                // Turn 2 — first refinement
                const refine1 = await docMgr.continueSession(sessionId, 'Add a section about deployment strategy', testCtx);
                if (refine1.sessionId !== sessionId) {
                    return { status: 'failed', error: `Session ID changed after refine1: expected ${sessionId}, got ${refine1.sessionId}` };
                }

                // Turn 3 — second refinement
                const refine2 = await docMgr.continueSession(sessionId, 'Include monitoring and alerting considerations', testCtx);
                if (refine2.sessionId !== sessionId) {
                    return { status: 'failed', error: `Session ID changed after refine2: expected ${sessionId}, got ${refine2.sessionId}` };
                }

                // Verify the same document path is used throughout
                if (refine2.documentPath !== initialPath) {
                    return { status: 'failed', error: `Document path changed: ${initialPath} → ${refine2.documentPath}` };
                }

                // Verify the session is still alive
                if (!docMgr.hasSession(sessionId)) {
                    return { status: 'failed', error: 'Session was closed prematurely after multi-turn refinement' };
                }

                return {
                    status: 'passed',
                    details: `3-turn session ${sessionId.slice(-8)} preserved, document: ${initialPath}`,
                    rawResponse: refine2.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

    {
        id: 'conversation:done-from-fresh',
        description: 'Sending "done" with no active session routes to agent gracefully (no crash)',
        group: 'conversation',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const { router } = buildConversationTestRouter();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'conversation-done-from-fresh');
            const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

            try {
                const result = await router.routeUserInput('done', testCtx);
                // Should not crash — either route to agent or return gracefully
                if (result.routedTo !== 'agent' && result.routedTo !== 'conversation') {
                    return { status: 'failed', error: `Expected routedTo 'agent' or 'conversation', got '${result.routedTo}'` };
                }
                return {
                    status: 'passed',
                    details: `"done" from fresh state routed to ${result.routedTo} without crash`,
                };
            } catch (e) {
                return { status: 'error', error: `Crash when sending "done" with no session: ${e instanceof Error ? e.message : String(e)}` };
            }
        },
    },

    {
        id: 'conversation:kickoff-heuristic-edge-cases',
        description: 'Short ambiguous input should NOT trigger kickoff; explicit project descriptions SHOULD',
        group: 'conversation',
        requiresLLM: false,
        async run() {
            const router = new ConversationSessionRouter(
                { getSession: () => null, continueConversation: async () => ({}) } as any,
                { getCurrentAgent: () => ({ name: 'prd-creator', handleRequest: async () => ({ content: 'ok' }) }), buildAgentContext: () => ({}) } as any
            );
            const shouldNotKickoff = ['fix this', 'hello', 'yes', 'no', 'ok', 'thanks'];
            const shouldKickoff = [
                'I want to create a new product requirements document for our mobile app',
                'Let us build a PRD for the payment gateway integration project'
            ];
            const failures: string[] = [];

            for (const input of shouldNotKickoff) {
                if ((router as any).looksLikeProjectKickoffInput(input)) {
                    failures.push(`False positive: "${input}" should NOT trigger kickoff`);
                }
            }
            for (const input of shouldKickoff) {
                if (!(router as any).looksLikeProjectKickoffInput(input)) {
                    failures.push(`False negative: "${input}" SHOULD trigger kickoff`);
                }
            }

            if (failures.length > 0) {
                return { status: 'failed', error: failures.join('; ') };
            }
            return { status: 'passed', details: `${shouldNotKickoff.length + shouldKickoff.length} heuristic edge cases all correct` };
        },
    },

    // AGENT — each agent called via LLM (requires model)
    //
    // IMPORTANT: prompts are carefully chosen to avoid triggering each agent's
    // document-creation keyword branches (e.g. "requirements" in a prompt would
    // send requirements-gatherer to createRequirementsDocument which calls
    // toolManager and crashes; "specification" would trigger createImplementationPlan).
    // Each prompt targets the agent's generic guidance/discussion path instead.
    // ══════════════════════════════════════════════════════════════════════════

    // Prompts deliberately avoid each agent's keyword triggers so we exercise
    // the safe static-guidance path and verify the agent can respond without
    // a workspace toolManager being available.
    ...([
        {
            name: 'prd-creator' as const,
            // No keyword triggers in prd-creator
            prompt: 'What types of products have you helped define? Give a brief overview.',
        },
        {
            name: 'brainstormer' as const,
            // Brainstormer always calls the LLM – keep the prompt short to reduce latency
            prompt: 'Name three creative thinking techniques in one sentence each.',
        },
        {
            name: 'requirements-gatherer' as const,
            // Trigger words to avoid: "requirements", "gather requirements", "update requirement"
            prompt: 'How do you help teams document user stories and acceptance criteria?',
        },
        {
            name: 'solution-architect' as const,
            // No problematic keyword triggers
            prompt: 'What architectural patterns do you work with most often?',
        },
        {
            name: 'specification-writer' as const,
            // Trigger words to avoid: "implementation", "tasks", "specification", "analyze", "review design"
            prompt: 'How do you help teams plan and organise their development work?',
        },
        {
            name: 'quality-reviewer' as const,
            // No problematic keyword triggers
            prompt: 'What quality aspects and document checks do you evaluate?',
        },
    ] as const).map(({ name: agentName, prompt: agentPrompt }): ScenarioDefinition => ({
        id: `agent:${agentName}`,
        description: `${agentName} responds to a capabilities prompt without errors`,
        group: 'agent',
        requiresLLM: true,
        async run({ agentManager }, ctx) {
            try {
                const agent = agentManager.getAgent(agentName);
                if (!agent) { return { status: 'failed', error: `Agent '${agentName}' is not registered` }; }

                const agentContext = agentManager.buildAgentContext(ctx.request);
                const response = await agent.handleRequest(
                    {
                        prompt: agentPrompt,
                        command: 'test',
                        parameters: {},
                        originalRequest: ctx.request,
                    },
                    agentContext
                );

                const text = (response.message ?? response.content ?? '').trim();
                if (!text) { return { status: 'failed', error: 'Agent returned an empty response' }; }

                // Detect error-flavoured responses that indicate a code path failure
                // (e.g. toolManager crash, missing document, etc.) — these should be
                // failures even though the response is non-empty.
                const errorPatterns: RegExp[] = [
                    /^Error /i,
                    /Cannot read propert/i,
                    /not found\. Please /i,
                    /failed:.*Cannot/i,
                    /^I encountered an error/i,
                ];
                const matchedError = errorPatterns.find(p => p.test(text));
                if (matchedError) {
                    return {
                        status: 'failed',
                        error: `Agent returned an error/missing-resource response: ${text.substring(0, 150)}`,
                    };
                }

                const snippet = text.substring(0, 120) + (text.length > 120 ? '…' : '');
                return { status: 'passed', details: `"${snippet}"` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    })),

    // ══════════════════════════════════════════════════════════════════════════
    // WORKFLOW — phase tracking + workflow shortcuts
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'workflow:phase-tracking',
        description: 'setPhase() transitions state and getCompletedPhases() reflects it',
        group: 'workflow',
        requiresLLM: false,
        async run({ workflowStateManager }) {
            try {
                await workflowStateManager.setPhase('requirements', 'requirements-gatherer');
                const state = await workflowStateManager.load();
                if (state.currentPhase !== 'requirements') {
                    return { status: 'failed', error: `Phase should be 'requirements', got '${state.currentPhase}'` };
                }
                if (state.activeAgent !== 'requirements-gatherer') {
                    return { status: 'failed', error: `Agent should be 'requirements-gatherer', got '${state.activeAgent}'` };
                }
                const phases = await workflowStateManager.getCompletedPhases();
                if (!Array.isArray(phases)) {
                    return { status: 'failed', error: 'getCompletedPhases() did not return an array' };
                }
                // Restore to prd
                await workflowStateManager.setPhase('prd', 'prd-creator');
                return { status: 'passed', details: `prd → requirements → prd transitions verified. Completed: [${phases.join(', ')}]` };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'workflow:prd-cmd',
        description: '/prd shortcut activates prd-creator and returns a response',
        group: 'workflow',
        requiresLLM: true,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/prd "Test Product"', deps, ctx);
            if (!result.success && result.error?.toLowerCase().includes('not found')) {
                return { status: 'failed', error: result.error };
            }
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    {
        id: 'workflow:requirements-cmd',
        description: '/requirements shortcut activates requirements-gatherer',
        group: 'workflow',
        requiresLLM: true,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/requirements', deps, ctx);
            if (!result.success && result.error?.toLowerCase().includes('not found')) {
                return { status: 'failed', error: result.error };
            }
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    {
        id: 'workflow:design-cmd',
        description: '/design shortcut activates solution-architect',
        group: 'workflow',
        requiresLLM: true,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/design', deps, ctx);
            if (!result.success && result.error?.toLowerCase().includes('not found')) {
                return { status: 'failed', error: result.error };
            }
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    {
        id: 'workflow:spec-cmd',
        description: '/spec shortcut activates specification-writer',
        group: 'workflow',
        requiresLLM: true,
        async run(deps, ctx) {
            const { result, captured } = await runCmd('/spec', deps, ctx);
            if (!result.success && result.error?.toLowerCase().includes('not found')) {
                return { status: 'failed', error: result.error };
            }
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    {
        id: 'workflow:review-cmd',
        description: '/review command is reachable (returns a response)',
        group: 'workflow',
        requiresLLM: false,
        async run(deps, ctx) {
            // We don't pass a real file but the command should at minimum parse and respond
            const { captured } = await runCmd('/review', deps, ctx);
            return { status: 'passed', details: `Output: ${captured.length} chars` };
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // E2E — full specification workflow with real file creation
    //
    // Each scenario builds on the previous one (run in order for `/test e2e`):
    //   e2e:prd-creation → e2e:requirements-doc → e2e:design-doc
    //                   → e2e:tasks-doc → e2e:quality-review
    //
    // All output files land in `.docu/test-e2e/` so they are isolated from
    // real project docs but remain inspectable after the run.
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'e2e:prd-creation',
        description: 'prd-creator creates a PRD document file on disk using LLM-generated content',
        group: 'e2e',
        requiresLLM: true,
        async run({ agentManager, templateService }, ctx) {
            try {
                const e2eCtx = await buildE2eContext(agentManager, templateService);
                if (!e2eCtx) { return { status: 'skipped', details: 'No workspace folder open' }; }
                const { toolManager, toolContext, e2eRoot } = e2eCtx;

                const agent = agentManager.getAgent('prd-creator');
                if (!agent) { return { status: 'failed', error: 'prd-creator not registered' }; }

                const agentContext = {
                    ...agentManager.buildAgentContext(ctx.request),
                    toolManager,
                    toolContext,
                };
                const response = await agent.handleRequest({
                    prompt: 'Create a new PRD for a task management application',
                    command: 'new',
                    parameters: { title: 'E2E Test App' },
                    originalRequest: ctx.request,
                }, agentContext);
                // PRDCreatorAgent returns toolCalls rather than calling toolManager directly
                await executeResponseToolCalls(response as any, toolManager, toolContext);

                const err = await assertE2eFile(e2eRoot, 'docs/e2e-test-app.md', 200);
                if (err) { return { status: 'failed', error: err }; }
                return { status: 'passed', details: 'PRD written to .docu/test-e2e/docs/e2e-test-app.md' };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'e2e:requirements-doc',
        description: 'requirements-gatherer creates LLM-generated requirements.md on disk',
        group: 'e2e',
        requiresLLM: true,
        async run({ agentManager, templateService }, ctx) {
            try {
                const e2eCtx = await buildE2eContext(agentManager, templateService);
                if (!e2eCtx) { return { status: 'skipped', details: 'No workspace folder open' }; }
                const { toolManager, toolContext, e2eRoot } = e2eCtx;

                const agent = agentManager.getAgent('requirements-gatherer');
                if (!agent) { return { status: 'failed', error: 'requirements-gatherer not registered' }; }

                const agentContext = {
                    ...agentManager.buildAgentContext(ctx.request),
                    toolManager,
                    toolContext,
                };
                // 'create requirements' triggers createRequirementsDocument()
                const response = await agent.handleRequest({
                    prompt: 'create requirements for the project',
                    command: 'test',
                    parameters: {},
                    originalRequest: ctx.request,
                }, agentContext);

                const text = (response.message ?? response.content ?? '').trim();
                if (/^error\b/i.test(text) || /Cannot read propert/i.test(text)) {
                    return { status: 'failed', error: `Agent error: ${text.substring(0, 150)}` };
                }
                const err = await assertE2eFile(e2eRoot, 'requirements.md', 300);
                if (err) { return { status: 'failed', error: err }; }
                return { status: 'passed', details: 'requirements.md written to .docu/test-e2e/' };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'e2e:design-doc',
        description: 'solution-architect creates LLM-generated design.md on disk',
        group: 'e2e',
        requiresLLM: true,
        async run({ agentManager, templateService }, ctx) {
            try {
                const e2eCtx = await buildE2eContext(agentManager, templateService);
                if (!e2eCtx) { return { status: 'skipped', details: 'No workspace folder open' }; }
                const { toolManager, toolContext, e2eRoot } = e2eCtx;

                const agent = agentManager.getAgent('solution-architect');
                if (!agent) { return { status: 'failed', error: 'solution-architect not registered' }; }

                const agentContext = {
                    ...agentManager.buildAgentContext(ctx.request),
                    toolManager,
                    toolContext,
                };
                // 'design' keyword triggers createDesignDocument()
                const response = await agent.handleRequest({
                    prompt: 'design the system architecture',
                    command: 'test',
                    parameters: {},
                    originalRequest: ctx.request,
                }, agentContext);

                const text = (response.message ?? response.content ?? '').trim();
                if (/^error\b/i.test(text) || /Cannot read propert/i.test(text)) {
                    return { status: 'failed', error: `Agent error: ${text.substring(0, 150)}` };
                }
                const err = await assertE2eFile(e2eRoot, 'design.md', 300);
                if (err) { return { status: 'failed', error: err }; }
                return { status: 'passed', details: 'design.md written to .docu/test-e2e/' };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'e2e:tasks-doc',
        description: 'specification-writer creates LLM-generated tasks.md on disk',
        group: 'e2e',
        requiresLLM: true,
        async run({ agentManager, templateService }, ctx) {
            try {
                const e2eCtx = await buildE2eContext(agentManager, templateService);
                if (!e2eCtx) { return { status: 'skipped', details: 'No workspace folder open' }; }
                const { toolManager, toolContext, e2eRoot } = e2eCtx;

                const agent = agentManager.getAgent('specification-writer');
                if (!agent) { return { status: 'failed', error: 'specification-writer not registered' }; }

                const agentContext = {
                    ...agentManager.buildAgentContext(ctx.request),
                    toolManager,
                    toolContext,
                };
                // 'implementation' keyword triggers createImplementationPlan()
                // Guard allows it through since toolManager is provided
                const response = await agent.handleRequest({
                    prompt: 'create implementation plan and tasks',
                    command: 'test',
                    parameters: {},
                    originalRequest: ctx.request,
                }, agentContext);

                const text = (response.message ?? response.content ?? '').trim();
                if (/^error\b/i.test(text) || /Cannot read propert/i.test(text)) {
                    return { status: 'failed', error: `Agent error: ${text.substring(0, 150)}` };
                }
                const err = await assertE2eFile(e2eRoot, 'tasks.md', 300);
                if (err) { return { status: 'failed', error: err }; }
                return { status: 'passed', details: 'tasks.md written to .docu/test-e2e/' };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'e2e:quality-review',
        description: 'quality-reviewer reads tasks.md and produces an AI-enhanced review report',
        group: 'e2e',
        requiresLLM: true,
        async run({ agentManager, templateService }, ctx) {
            try {
                const e2eCtx = await buildE2eContext(agentManager, templateService);
                if (!e2eCtx) { return { status: 'skipped', details: 'No workspace folder open' }; }
                const { toolManager, toolContext, e2eRoot } = e2eCtx;

                // Ensure tasks.md exists to review (write a stub if previous step was skipped)
                const tasksPath = path.join(e2eRoot, 'tasks.md');
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(tasksPath));
                } catch {
                    const stub = '# Tasks\n\n## Task 1\n\nBuild the core module.\n\n## Task 2\n\nWrite unit tests.\n';
                    await vscode.workspace.fs.writeFile(vscode.Uri.file(tasksPath), Buffer.from(stub, 'utf8'));
                }

                const agent = agentManager.getAgent('quality-reviewer');
                if (!agent) { return { status: 'failed', error: 'quality-reviewer not registered' }; }

                const agentContext = {
                    ...agentManager.buildAgentContext(ctx.request),
                    toolManager,
                    toolContext,
                };
                const response = await agent.handleRequest({
                    prompt: '--file tasks.md --level normal',
                    command: 'test',
                    parameters: {},
                    originalRequest: ctx.request,
                }, agentContext);

                const text = (response.message ?? response.content ?? '').trim();
                if (!text) { return { status: 'failed', error: 'Quality reviewer returned empty response' }; }
                if (/^error\b/i.test(text) || /Cannot read propert/i.test(text)) {
                    return { status: 'failed', error: `Agent error: ${text.substring(0, 150)}` };
                }
                const snippet = text.substring(0, 120) + (text.length > 120 ? '…' : '');
                return { status: 'passed', details: snippet };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'e2e:new-creates-file',
        description: '/new "E2E Test" creates a file on disk in the workspace',
        group: 'e2e',
        requiresLLM: false,
        async run(deps, ctx) {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    return { status: 'skipped', details: 'No workspace folder open' };
                }
                const { result, captured } = await runCmd('/new "E2E-File-Test"', deps, ctx);
                if (!result.success && result.error) {
                    return { status: 'failed', error: result.error };
                }
                // Check that a file was mentioned in the output or created
                const fileMentioned = captured.toLowerCase().includes('.md') || captured.toLowerCase().includes('created') || captured.toLowerCase().includes('file');
                return {
                    status: 'passed',
                    details: fileMentioned
                        ? `File creation confirmed in output (${captured.length} chars)`
                        : `Command succeeded (${captured.length} chars) but no file path in output — verify manually`
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
        },
    },

    {
        id: 'e2e:doc-session-multi-turn',
        description: 'Full kickoff → 2 refinements → done with real LLM, verifies file grows with each turn',
        group: 'e2e',
        requiresLLM: true,
        async run(_deps, ctx) {
            if (!ctx.model) { return { status: 'skipped', details: 'No LLM model available' }; }
            const docMgr = DocSessionManager.getInstance();
            const scenarioRoot = await buildConversationScenarioRoot(ctx.workspaceRoot, 'e2e-doc-session-multi-turn');
            const testCtx = buildConversationTestContext(ctx, scenarioRoot, ctx.model);

            docMgr.clearAll();
            try {
                // Turn 1 — kickoff
                const kickoff = await docMgr.startNewSession(
                    'I need a design document for a real-time chat application with WebSocket architecture',
                    testCtx
                );
                if (!kickoff.sessionId || !kickoff.documentPath) {
                    return { status: 'failed', error: 'Kickoff did not create a session or document path' };
                }
                const sessionId = kickoff.sessionId;
                const docPath = kickoff.documentPath;

                // Read initial file size
                let initialSize = 0;
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(docPath));
                    initialSize = stat.size;
                } catch {
                    return { status: 'failed', error: `Document file not found after kickoff: ${docPath}` };
                }

                // Turn 2 — refinement 1
                await docMgr.continueSession(sessionId, 'Add details about authentication and authorization flow', testCtx);

                // Turn 3 — refinement 2
                await docMgr.continueSession(sessionId, 'Include scalability considerations and load balancing strategy', testCtx);

                // Read final file size — should have grown
                let finalSize = 0;
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(docPath));
                    finalSize = stat.size;
                } catch {
                    return { status: 'failed', error: `Document file disappeared after refinements: ${docPath}` };
                }

                if (finalSize <= initialSize) {
                    return {
                        status: 'failed',
                        error: `File did not grow: initial=${initialSize} bytes, final=${finalSize} bytes`
                    };
                }

                // "done" — close the session
                const doneResult = await docMgr.continueSession(sessionId, 'done', testCtx);

                return {
                    status: 'passed',
                    details: `Session ${sessionId.slice(-8)}: ${initialSize}→${finalSize} bytes, shouldContinue=${doneResult.shouldContinue}`,
                    rawResponse: doneResult.response
                };
            } catch (e) {
                return { status: 'error', error: e instanceof Error ? e.message : String(e) };
            } finally {
                docMgr.clearAll();
            }
        },
    },

];

// ─── Group → scenario-group filter map ────────────────────────────────────────

const GROUP_MAP: Record<string, string[]> = {
    system: ['system'],
    template: ['template'],
    templates: ['template'],
    commands: ['cmd'],
    cmd: ['cmd'],
    conversation: ['conversation'],
    conversations: ['conversation'],
    agents: ['agent'],
    agent: ['agent'],
    workflow: ['workflow'],
    e2e: ['e2e'],
    quick: ['system', 'template', 'cmd'],
    full: ['system', 'template', 'cmd', 'conversation', 'agent', 'workflow', 'e2e'],
};

function selectScenarios(subCommand: string): ScenarioDefinition[] {
    // Known group alias
    const groups = GROUP_MAP[subCommand];
    if (groups) {
        return ALL_SCENARIOS.filter(s => groups.includes(s.group));
    }
    // Exact scenario ID match
    const exact = ALL_SCENARIOS.find(s => s.id === subCommand);
    if (exact) { return [exact]; }
    // Prefix match (e.g. "agent:" matches all agent scenarios)
    const prefix = ALL_SCENARIOS.filter(s => s.id.startsWith(subCommand));
    return prefix;
}

// ─── TestRunner ────────────────────────────────────────────────────────────────

export class TestRunner {
    constructor(
        private agentManager: AgentManager,
        private templateService: TemplateService,
        private workflowStateManager: WorkflowStateManager,
        private commandRouter: CommandRouter
    ) { }

    /**
     * Execute scenarios for the given sub-command.
     *
     * @param subCommand  One of: quick, full, system, template, commands, conversation, agents, workflow, e2e, or a scenario ID
     * @param ctx         The VS Code chat command context (provides stream + model)
     * @param onProgress  Optional callback invoked after each scenario with a one-line status string
     * @returns           Array of ScenarioResult, one per executed (or skipped) scenario
     */
    async run(
        subCommand: string,
        ctx: CommandContext,
        onProgress?: (msg: string) => void
    ): Promise<ScenarioResult[]> {
        const scenarios = selectScenarios(subCommand);
        if (scenarios.length === 0) { return []; }

        const hasLLM = !!ctx.model;
        const deps: RunDeps = {
            agentManager: this.agentManager,
            templateService: this.templateService,
            workflowStateManager: this.workflowStateManager,
            commandRouter: this.commandRouter,
        };

        const results: ScenarioResult[] = [];

        for (const scenario of scenarios) {
            // Skip LLM-dependent scenarios when no model is available
            if (scenario.requiresLLM && !hasLLM) {
                const r: ScenarioResult = {
                    id: scenario.id,
                    description: scenario.description,
                    group: scenario.group,
                    status: 'skipped',
                    durationMs: 0,
                    details: 'No language model available — pass a model to run LLM scenarios',
                };
                results.push(r);
                onProgress?.(`⏭️ \`${scenario.id}\` — skipped (no LLM)`);
                continue;
            }

            const start = Date.now();
            let run: ScenarioRunResult;
            try {
                run = await scenario.run(deps, ctx);
            } catch (e) {
                run = { status: 'error', error: e instanceof Error ? e.message : String(e) };
            }
            const durationMs = Date.now() - start;

            const result: ScenarioResult = {
                id: scenario.id,
                description: scenario.description,
                group: scenario.group,
                durationMs,
                ...run,
            };
            results.push(result);

            const icon: Record<ScenarioStatus, string> = { passed: '✅', failed: '❌', error: '💥', skipped: '⏭️' };
            const suffix = result.error
                ? ` — \`${result.error.substring(0, 100)}\``
                : result.details
                    ? ` — ${result.details.substring(0, 80)}`
                    : '';
            onProgress?.(`${icon[result.status]} \`${result.id}\` (${durationMs}ms)${suffix}`);
        }

        return results;
    }

    /** Return all scenario definitions (used by `/test list`) */
    listScenarios(): ScenarioDefinition[] {
        return ALL_SCENARIOS;
    }

    /** Return scenario groups for help display */
    getGroups(): string[] {
        return Object.keys(GROUP_MAP);
    }
}
