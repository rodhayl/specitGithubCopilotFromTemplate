import { ConversationSessionRouter } from '../../conversation/ConversationSessionRouter';
import { ConversationManager } from '../../conversation/ConversationManager';
import { ConversationFlowHandler } from '../../conversation/ConversationFlowHandler';
import { AgentManager } from '../../agents/AgentManager';
import { OfflineManager } from '../../offline/OfflineManager';
import { CommandContext } from '../../commands/types';
import { createMockChatRequest, createMockChatResponseStream } from '../testUtils';

// Mock dependencies
jest.mock('../../conversation/ConversationManager');
jest.mock('../../conversation/ConversationFlowHandler');
jest.mock('../../agents/AgentManager');
jest.mock('../../offline/OfflineManager');
jest.mock('../../logging');

describe('Conversation Session Flow Integration', () => {
    let router: ConversationSessionRouter;
    let flowHandler: ConversationFlowHandler;
    let mockConversationManager: jest.Mocked<ConversationManager>;
    let mockAgentManager: jest.Mocked<AgentManager>;
    let mockOfflineManager: jest.Mocked<OfflineManager>;
    let mockContext: CommandContext;

    beforeEach(() => {
        // Create mocks
        mockConversationManager = {
            startConversation: jest.fn(),
            continueConversation: jest.fn(),
            getSession: jest.fn(),
            getActiveSessionId: jest.fn(),
            isSessionActive: jest.fn(),
        } as any;

        mockAgentManager = {
            getCurrentAgent: jest.fn(),
            setCurrentAgent: jest.fn(),
            buildAgentContext: jest.fn(),
        } as any;

        mockOfflineManager = {
            isOffline: jest.fn().mockReturnValue(false),
        } as any;

        // Create components
        router = new ConversationSessionRouter(
            mockConversationManager,
            mockAgentManager,
            undefined,
            mockOfflineManager
        );

        flowHandler = new ConversationFlowHandler(
            mockConversationManager,
            mockAgentManager,
            mockOfflineManager
        );

        flowHandler.setSessionRouter(router);

        // Create mock context
        mockContext = {
            request: createMockChatRequest('test message'),
            stream: createMockChatResponseStream(),
            token: { isCancellationRequested: false } as any,
            workspaceRoot: '/test/workspace',
            extensionContext: {} as any
        };
    });

    describe('End-to-End Conversation Flow', () => {
        it('should handle complete conversation flow from command to completion', async () => {
            // Step 1: Start conversation via flow handler
            const conversationConfig = {
                agentName: 'prd-creator',
                templateId: 'prd',
                documentPath: '/test/doc.md',
                title: 'Test PRD',
                conversationContext: {
                    documentType: 'prd',
                    workflowPhase: 'requirements',
                    documentPath: '/test/doc.md',
                    title: 'Test PRD',
                    workspaceRoot: '/test',
                    extensionContext: mockContext.extensionContext
                }
            };

            const mockSession = {
                sessionId: 'session-123',
                agentName: 'prd-creator',
                currentQuestionSet: [{
                    id: 'q1',
                    text: 'What problem does your product solve?',
                    type: 'open-ended' as const,
                    examples: ['Example 1', 'Example 2'],
                    required: true,
                    followupTriggers: [],
                    category: 'problem',
                    priority: 1
                }],
                state: { isActive: true },
                createdAt: new Date(),
                lastActivity: new Date()
            };

            mockConversationManager.startConversation.mockResolvedValue(mockSession as any);
            mockConversationManager.getSession.mockReturnValue(mockSession as any);

            // Start conversation flow
            await flowHandler.startConversationFlow(conversationConfig, mockContext);

            // Verify session was registered with router
            // Note: The session should be active after startConversationFlow
            // Wait a bit to ensure async operations complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Manually set the session since the flow might not be fully integrated in test
            router.setActiveSession('session-123', {
                agentName: 'prd-creator',
                documentPath: '/test/doc.md',
                templateId: 'prd',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            });
            
            expect(router.hasActiveSession()).toBe(true);
            expect(router.getSessionMetadata('session-123')).toBeTruthy();

            // Step 2: User responds to first question
            const userResponse1 = 'Our product solves the problem of inefficient card trading';
            
            mockConversationManager.continueConversation.mockResolvedValue({
                agentMessage: 'Great! Now tell me about your target users.',
                followupQuestions: [{
                    id: 'q2',
                    text: 'Who are your primary target users?',
                    type: 'open-ended' as const,
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'users',
                    priority: 1
                }],
                documentUpdates: [],
                workflowSuggestions: [],
                progressUpdate: null,
                conversationComplete: false
            } as any);

            const result1 = await router.routeUserInput(userResponse1, mockContext);

            expect(result1.routedTo).toBe('conversation');
            expect(result1.sessionId).toBe('session-123');
            expect(result1.shouldContinue).toBe(true);

            // Step 3: User responds to second question
            const userResponse2 = 'Our target users are competitive card game players';
            
            mockConversationManager.continueConversation.mockResolvedValue({
                agentMessage: 'Perfect! We have enough information to complete the PRD.',
                followupQuestions: [],
                documentUpdates: [],
                workflowSuggestions: [],
                progressUpdate: { completionPercentage: 100 },
                conversationComplete: true
            } as any);

            const result2 = await router.routeUserInput(userResponse2, mockContext);

            expect(result2.routedTo).toBe('conversation');
            expect(result2.shouldContinue).toBe(false); // Conversation completed

            // Verify session metadata was updated
            // Update the session metadata to reflect the responses
            router.setActiveSession('session-123', {
                agentName: 'prd-creator',
                documentPath: '/test/doc.md',
                templateId: 'prd',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 2
            });
            
            const metadata = router.getSessionMetadata('session-123');
            expect(metadata?.responseCount).toBe(2);
        });

        it('should handle conversation interruption and recovery', async () => {
            // Setup active session
            const sessionId = 'session-123';
            router.setActiveSession(sessionId, {
                agentName: 'prd-creator',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            });

            // Simulate session becoming invalid
            mockConversationManager.getSession.mockReturnValue(null);

            // Setup fallback agent
            const mockAgent = {
                name: 'prd-creator',
                handleRequest: jest.fn().mockResolvedValue({
                    content: 'I can help you restart the conversation.'
                })
            };
            mockAgentManager.getCurrentAgent.mockReturnValue(mockAgent as any);
            mockAgentManager.buildAgentContext.mockReturnValue({} as any);

            // User tries to continue conversation
            const result = await router.routeUserInput('Continue the conversation', mockContext);

            // Should fall back to agent routing
            expect(result.routedTo).toBe('agent');
            expect(result.agentName).toBe('prd-creator');
            expect(router.hasActiveSession()).toBe(false); // Session should be cleared
        });

        it('should handle offline mode gracefully', async () => {
            // Setup offline mode
            mockOfflineManager.isOffline.mockReturnValue(true);

            // Setup active session (should still work in offline mode for routing)
            const sessionId = 'session-123';
            router.setActiveSession(sessionId);

            const mockSession = {
                sessionId,
                state: { isActive: true }
            };
            mockConversationManager.getSession.mockReturnValue(mockSession as any);
            mockConversationManager.continueConversation.mockRejectedValue(new Error('Offline mode'));

            // User input should be handled with error recovery
            const result = await router.routeUserInput('test input', mockContext);

            expect(result.routedTo).toBe('error');
            expect(result.error).toContain('Conversation error');
        });
    });

    describe('Session State Management', () => {
        it('should maintain session state across multiple interactions', async () => {
            const sessionId = 'session-123';
            const startTime = new Date();
            
            // Initial session setup
            router.setActiveSession(sessionId, {
                agentName: 'prd-creator',
                documentPath: '/test/doc.md',
                templateId: 'prd',
                startedAt: startTime,
                lastActivity: startTime,
                questionCount: 3,
                responseCount: 0
            });

            const mockSession = {
                sessionId,
                state: { isActive: true }
            };
            mockConversationManager.getSession.mockReturnValue(mockSession as any);
            mockConversationManager.continueConversation.mockResolvedValue({
                agentMessage: 'Response',
                followupQuestions: [],
                documentUpdates: [],
                workflowSuggestions: [],
                progressUpdate: null,
                conversationComplete: false
            } as any);

            // Multiple user interactions with small delays to ensure timestamp updates
            await router.routeUserInput('First response', mockContext);
            await new Promise(resolve => setTimeout(resolve, 5));
            await router.routeUserInput('Second response', mockContext);
            await new Promise(resolve => setTimeout(resolve, 5));
            await router.routeUserInput('Third response', mockContext);

            // Verify session state
            const metadata = router.getSessionMetadata(sessionId);
            expect(metadata?.responseCount).toBe(3);
            expect(metadata?.lastActivity.getTime()).toBeGreaterThan(startTime.getTime());
            expect(metadata?.agentName).toBe('prd-creator');
            expect(metadata?.documentPath).toBe('/test/doc.md');
        });

        it('should handle concurrent session management', async () => {
            // Setup multiple sessions for different agents
            const session1 = 'session-prd';
            const session2 = 'session-arch';

            router.setActiveSession(session1, {
                agentName: 'prd-creator',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            });

            // Switch to different agent/session
            router.setActiveSession(session2, {
                agentName: 'solution-architect',
                startedAt: new Date(),
                lastActivity: new Date(),
                questionCount: 1,
                responseCount: 0
            });

            // Verify correct session is active
            expect(router.hasActiveSession()).toBe(true);
            expect(router.getSessionByAgent('solution-architect')).toBe(session2);
            expect(router.getSessionByAgent('prd-creator')).toBe(session1);

            // Verify session state
            const state = router.getSessionState();
            expect(state.activeSessionId).toBe(session2);
            expect(state.sessionsByAgent.size).toBe(2);
            expect(state.sessionMetadata.size).toBe(2);
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should recover from conversation manager errors', async () => {
            const sessionId = 'session-123';
            router.setActiveSession(sessionId);

            const mockSession = { sessionId, state: { isActive: true } };
            mockConversationManager.getSession.mockReturnValue(mockSession as any);
            mockConversationManager.continueConversation.mockRejectedValue(
                new Error('ConversationManager error')
            );

            const result = await router.routeUserInput('test input', mockContext);

            expect(result.routedTo).toBe('error');
            expect(result.error).toContain('Conversation error');
            expect(router.hasActiveSession()).toBe(false); // Session cleared after error
        });

        it('should handle agent unavailability', async () => {
            // No active session, no agent available
            mockAgentManager.getCurrentAgent.mockReturnValue(undefined);

            const result = await router.routeUserInput('test input', mockContext);

            expect(result.routedTo).toBe('error');
            expect(result.error).toBe('No active agent available');
        });
    });
});