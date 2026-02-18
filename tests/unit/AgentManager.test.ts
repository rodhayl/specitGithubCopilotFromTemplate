/**
 * Unit tests for AgentManager
 * Covers agent registration, listing, switching, and context building.
 */
import { AgentManager } from '../../src/agents/AgentManager';

const vscode = require('vscode');

describe('AgentManager', () => {
    let agentManager: AgentManager;
    let mockContext: any;

    beforeEach(() => {
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/ext' },
            extensionPath: '/ext',
            extension: { packageJSON: { version: '0.1.0' } },
            globalState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
            workspaceState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
            secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() },
            asAbsolutePath: jest.fn((p: string) => `/ext/${p}`),
            storagePath: '/storage',
            globalStoragePath: '/global-storage',
            logPath: '/logs',
            extensionMode: 1,
        };
        agentManager = new AgentManager(mockContext);
    });

    describe('listAgents()', () => {
        it('should list all built-in agents', () => {
            const agents = agentManager.listAgents();
            const names = agents.map(a => a.name);
            expect(names).toContain('prd-creator');
            expect(names).toContain('brainstormer');
            expect(names).toContain('requirements-gatherer');
            expect(names).toContain('solution-architect');
            expect(names).toContain('specification-writer');
            expect(names).toContain('quality-reviewer');
        });

        it('should have exactly one active agent at a time', () => {
            const agents = agentManager.listAgents();
            const activeAgents = agents.filter(a => a.active);
            expect(activeAgents).toHaveLength(1);
        });

        it('should return each agent with name, description, phase, and active fields', () => {
            const agents = agentManager.listAgents();
            for (const agent of agents) {
                expect(typeof agent.name).toBe('string');
                expect(typeof agent.description).toBe('string');
                expect(typeof agent.phase).toBe('string');
                expect(typeof agent.active).toBe('boolean');
            }
        });
    });

    describe('setCurrentAgent()', () => {
        it('should switch to a valid agent name and return true', () => {
            const result = agentManager.setCurrentAgent('brainstormer');
            expect(result).toBe(true);
            const active = agentManager.listAgents().find(a => a.active);
            expect(active?.name).toBe('brainstormer');
        });

        it('should return false for an unknown agent name', () => {
            const result = agentManager.setCurrentAgent('non-existent-agent');
            expect(result).toBe(false);
        });

        it('should not change current agent when switch fails', () => {
            const before = agentManager.getCurrentAgent();
            agentManager.setCurrentAgent('no-such-agent');
            const after = agentManager.getCurrentAgent();
            expect(after?.name).toBe(before?.name);
        });
    });

    describe('getAgent()', () => {
        it('should return an agent by name', () => {
            const agent = agentManager.getAgent('prd-creator');
            expect(agent).toBeDefined();
            expect(agent?.name).toBe('prd-creator');
        });

        it('should return undefined for an unknown agent', () => {
            expect(agentManager.getAgent('unknown')).toBeUndefined();
        });
    });

    describe('getCurrentAgent()', () => {
        it('should return the default prd-creator agent on initialization', () => {
            const current = agentManager.getCurrentAgent();
            expect(current?.name).toBe('prd-creator');
        });

        it('should reflect agent switch', () => {
            agentManager.setCurrentAgent('solution-architect');
            expect(agentManager.getCurrentAgent()?.name).toBe('solution-architect');
        });
    });

    describe('buildAgentContext()', () => {
        it('should include workspaceRoot from vscode workspace', () => {
            const mockRequest = { prompt: 'hello', model: undefined } as any;
            const context = agentManager.buildAgentContext(mockRequest);
            expect(typeof context.workspaceRoot).toBe('string');
        });

        it('should include workflowState', () => {
            const mockRequest = { prompt: 'hello', model: undefined } as any;
            const context = agentManager.buildAgentContext(mockRequest);
            expect(context.workflowState).toBeDefined();
        });
    });
});
