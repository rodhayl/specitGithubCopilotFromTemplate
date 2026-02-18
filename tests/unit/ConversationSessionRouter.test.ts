import { ConversationSessionRouter, ConversationRoutingResult } from '../../src/conversation/ConversationSessionRouter';
import { ConversationManager } from '../../src/conversation/ConversationManager';
import { AgentManager } from '../../src/agents/AgentManager';
import { OfflineManager } from '../../src/offline/OfflineManager';
import { CommandContext } from '../../src/commands/types';
import { createMockChatRequest, createMockChatResponseStream } from '../testUtils';

// Mock dependencies
jest.mock('../../src/conversation/ConversationManager');
jest.mock('../../src/agents/AgentManager');
jest.mock('../../src/offline/OfflineManager');
jest.mock('../../src/logging');

describe('ConversationSessionRouter', () => {
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

            // Wait a bit to ensure time difference
            setTimeout(() => {
                router.updateSessionActivity(sessionId);
                
                const metadata = router.getSessionMetadata(sessionId);
                expect(metadata?.responseCount).toBe(1);
                expect(metadata?.lastActivity.getTime()).toBeGreaterThan(startTime.getTime());
            }, 10);
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