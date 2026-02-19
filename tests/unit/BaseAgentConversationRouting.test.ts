import { BaseAgent } from '../../src/agents/BaseAgent';
import { AgentContext, AgentResponse, ChatRequest } from '../../src/agents/types';

class TestAgent extends BaseAgent {
    public directHandler = jest.fn(async (): Promise<AgentResponse> => ({
        content: 'direct',
    }));

    constructor() {
        super('test-agent', 'test-system-prompt', [], 'prd');
    }

    protected async handleDirectRequest(_request: ChatRequest, _context: AgentContext): Promise<AgentResponse> {
        return this.directHandler();
    }
}

describe('BaseAgent conversation routing', () => {
    let agent: TestAgent;
    let context: AgentContext;
    let conversationManager: any;

    beforeEach(() => {
        agent = new TestAgent();
        conversationManager = {
            getActiveSession: jest.fn().mockReturnValue(null),
            startConversation: jest.fn().mockResolvedValue({
                sessionId: 'session-1',
                currentQuestionSet: [],
                state: { isActive: true },
                createdAt: new Date(),
                lastActivity: new Date(),
            }),
            continueConversation: jest.fn(),
        };

        agent.setConversationManager(conversationManager);

        context = {
            workspaceRoot: '/test/workspace',
            previousOutputs: [],
            userPreferences: {
                defaultDirectory: 'docs',
                defaultAgent: 'test-agent',
            },
            workflowState: {
                projectId: 'project-1',
                currentPhase: 'prd',
                activeAgent: 'test-agent',
                documents: {},
                context: {},
                history: [],
            },
            extensionContext: {
                globalState: { get: jest.fn() },
            } as any,
        };
    });

    it('uses direct handling by default for chat-like input', async () => {
        const request: ChatRequest = {
            prompt: 'help me shape this idea',
            parameters: {},
            originalRequest: {} as any,
        };

        const response = await agent.handleRequest(request, context);

        expect(response.content).toBe('direct');
        expect(agent.directHandler).toHaveBeenCalledTimes(1);
        expect(conversationManager.startConversation).not.toHaveBeenCalled();
    });

    it('uses conversation flow only when explicitly requested', async () => {
        const request: ChatRequest = {
            prompt: 'continue',
            parameters: {
                conversationMode: 'true',
            } as any,
            originalRequest: {} as any,
        };

        await agent.handleRequest(request, context);

        expect(conversationManager.startConversation).toHaveBeenCalledTimes(1);
        expect(agent.directHandler).not.toHaveBeenCalled();
    });
});

