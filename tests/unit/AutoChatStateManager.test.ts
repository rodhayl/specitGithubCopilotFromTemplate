import { AutoChatStateManager, AutoChatContext } from '../../src/conversation/AutoChatStateManager';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
    ExtensionContext: jest.fn(),
    ChatResponseStream: jest.fn(),
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => defaultValue)
        }))
    }
}));

// Mock Logger
jest.mock('../../src/logging', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

describe('AutoChatStateManager', () => {
    let autoChatManager: AutoChatStateManager;
    let mockExtensionContext: any;

    beforeEach(() => {
        mockExtensionContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        };
        autoChatManager = new AutoChatStateManager(mockExtensionContext);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('enableAutoChat', () => {
        it('should enable auto-chat mode with agent name', () => {
            const agentName = 'prd-creator';
            const documentPath = '/path/to/document.md';

            autoChatManager.enableAutoChat(agentName, documentPath);

            expect(autoChatManager.isAutoChatActive()).toBe(true);

            const context = autoChatManager.getAutoChatContext();
            expect(context).toBeTruthy();
            expect(context?.agentName).toBe(agentName);
            expect(context?.documentPath).toBe(documentPath);
        });

        it('should enable auto-chat mode with additional context', () => {
            const agentName = 'requirements-gatherer';
            const documentPath = '/path/to/requirements.md';
            const additionalContext = {
                templateId: 'requirements',
                conversationSessionId: 'session-123'
            };

            autoChatManager.enableAutoChat(agentName, documentPath, additionalContext);

            const context = autoChatManager.getAutoChatContext();
            expect(context?.templateId).toBe('requirements');
            expect(context?.conversationSessionId).toBe('session-123');
        });
    });

    describe('disableAutoChat', () => {
        it('should disable auto-chat mode', () => {
            autoChatManager.enableAutoChat('prd-creator');
            expect(autoChatManager.isAutoChatActive()).toBe(true);

            autoChatManager.disableAutoChat();
            expect(autoChatManager.isAutoChatActive()).toBe(false);
            expect(autoChatManager.getAutoChatContext()).toBeNull();
        });

        it('should clear all session properties upon disable', () => {
            autoChatManager.enableAutoChat('prd-creator', '/path.md');
            autoChatManager.updateActivity();
            autoChatManager.updateActivity(); // increments messageCount

            autoChatManager.disableAutoChat();

            const stats = autoChatManager.getSessionStats();
            expect(stats.isActive).toBe(false);
            expect(stats.messageCount).toBe(0);
            expect(stats.agentName).toBeUndefined();
            expect(stats.documentPath).toBeUndefined();
            expect((autoChatManager as any).state.sessionStartTime).toBeNull();
            expect((autoChatManager as any).state.lastUserInput).toBeNull();
        });
    });

    describe('isAutoChatActive', () => {
        it('should return false when not active', () => {
            expect(autoChatManager.isAutoChatActive()).toBe(false);
        });

        it('should return true when active', () => {
            autoChatManager.enableAutoChat('prd-creator');
            expect(autoChatManager.isAutoChatActive()).toBe(true);
        });

        it('should return false when session has timed out', () => {
            // Enable auto-chat
            autoChatManager.enableAutoChat('prd-creator');

            // Mock a very old timestamp to simulate timeout
            const context = autoChatManager.getAutoChatContext();
            if (context) {
                context.lastActivity = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
            }

            expect(autoChatManager.isAutoChatActive()).toBe(false);
        });
    });

    describe('updateActivity', () => {
        it('should update activity timestamp and message count', () => {
            autoChatManager.enableAutoChat('prd-creator');

            const initialStats = autoChatManager.getSessionStats();
            expect(initialStats.messageCount).toBe(0);

            autoChatManager.updateActivity();

            const updatedStats = autoChatManager.getSessionStats();
            expect(updatedStats.messageCount).toBe(1);
        });

        it('should not update when auto-chat is not active', () => {
            const initialStats = autoChatManager.getSessionStats();

            autoChatManager.updateActivity();

            const updatedStats = autoChatManager.getSessionStats();
            expect(updatedStats.messageCount).toBe(initialStats.messageCount);
        });
    });

    describe('showAutoChatPrompt', () => {
        it('should show auto-chat prompt with agent information', () => {
            const mockStream = {
                markdown: jest.fn()
            } as any;

            autoChatManager.enableAutoChat('prd-creator', '/path/to/document.md');
            autoChatManager.showAutoChatPrompt(mockStream);

            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Agent Set: prd-creator')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('/path/to/document.md')
            );
        });

        it('should not show prompt when no context available', () => {
            const mockStream = {
                markdown: jest.fn()
            } as any;

            autoChatManager.showAutoChatPrompt(mockStream);

            expect(mockStream.markdown).not.toHaveBeenCalled();
        });
    });

    describe('getSessionStats', () => {
        it('should return correct session statistics', async () => {
            const agentName = 'prd-creator';
            const documentPath = '/path/to/document.md';

            autoChatManager.enableAutoChat(agentName, documentPath);
            autoChatManager.updateActivity();
            autoChatManager.updateActivity();

            // Wait a bit to ensure session duration is measurable
            await new Promise(resolve => setTimeout(resolve, 1100));

            const stats = autoChatManager.getSessionStats();

            expect(stats.isActive).toBe(true);
            expect(stats.agentName).toBe(agentName);
            expect(stats.documentPath).toBe(documentPath);
            expect(stats.messageCount).toBe(2);
            expect(stats.sessionDuration).toBeGreaterThan(0);
        });
    });

    describe('setConversationSessionId', () => {
        it('should update conversation session ID in context', () => {
            const sessionId = 'conversation-123';

            autoChatManager.enableAutoChat('prd-creator');
            autoChatManager.setConversationSessionId(sessionId);

            const context = autoChatManager.getAutoChatContext();
            expect(context?.conversationSessionId).toBe(sessionId);
        });

        it('should not update when no context exists', () => {
            const sessionId = 'conversation-123';

            autoChatManager.setConversationSessionId(sessionId);

            const context = autoChatManager.getAutoChatContext();
            expect(context).toBeNull();
        });
    });

    describe('cleanupExpiredSessions', () => {
        it('should clean up expired sessions', () => {
            autoChatManager.enableAutoChat('prd-creator');

            // Mock expired session
            const context = autoChatManager.getAutoChatContext();
            if (context) {
                context.lastActivity = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
            }

            autoChatManager.cleanupExpiredSessions();

            expect(autoChatManager.isAutoChatActive()).toBe(false);
        });

        it('should not clean up active sessions', () => {
            autoChatManager.enableAutoChat('prd-creator');

            autoChatManager.cleanupExpiredSessions();

            expect(autoChatManager.isAutoChatActive()).toBe(true);
        });
    });

    describe('state persistence', () => {
        it('should save state to extension context', async () => {
            const agentName = 'prd-creator';
            const documentPath = '/path/to/document.md';

            autoChatManager.enableAutoChat(agentName, documentPath);

            // Verify that globalState.update was called
            expect(mockExtensionContext.globalState.update).toHaveBeenCalledWith(
                'autoChatState',
                expect.objectContaining({
                    isActive: true,
                    context: expect.objectContaining({
                        agentName,
                        documentPath
                    })
                })
            );
        });

        it('should load state from extension context', () => {
            const persistedState = {
                isActive: true,
                context: {
                    agentName: 'prd-creator',
                    documentPath: '/path/to/document.md',
                    enabledAt: new Date().toISOString(),
                    lastActivity: new Date().toISOString()
                },
                messageCount: 5
            };

            mockExtensionContext.globalState.get.mockReturnValue(persistedState);

            // Create new instance to trigger loading
            const newManager = new AutoChatStateManager(mockExtensionContext);

            expect(newManager.isAutoChatActive()).toBe(true);
            const context = newManager.getAutoChatContext();
            expect(context?.agentName).toBe('prd-creator');
        });
    });
});