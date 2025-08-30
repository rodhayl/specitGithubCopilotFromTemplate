import * as vscode from 'vscode';
import { Logger } from '../logging';

/**
 * Context information for auto-chat sessions
 */
export interface AutoChatContext {
    agentName: string;
    documentPath?: string;
    templateId?: string;
    conversationSessionId?: string;
    enabledAt: Date;
    lastActivity: Date;
}

/**
 * Auto-chat session state
 */
export interface AutoChatState {
    isActive: boolean;
    context: AutoChatContext | null;
    sessionStartTime: Date | null;
    lastUserInput: Date | null;
    messageCount: number;
}

/**
 * Manages auto-chat state for seamless conversation flow
 */
export class AutoChatStateManager {
    private logger: Logger;
    private state: AutoChatState;
    private extensionContext?: vscode.ExtensionContext;
    private readonly DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    constructor(extensionContext?: vscode.ExtensionContext) {
        this.logger = Logger.getInstance();
        this.extensionContext = extensionContext;
        this.state = {
            isActive: false,
            context: null,
            sessionStartTime: null,
            lastUserInput: null,
            messageCount: 0
        };
        
        // Load persisted state
        this.loadState();
    }

    /**
     * Enable auto-chat mode for current session
     */
    enableAutoChat(
        agentName: string,
        documentPath?: string,
        context?: Partial<AutoChatContext>
    ): void {
        // Check if auto-chat is enabled in configuration
        const config = vscode.workspace.getConfiguration('docu.autoChat');
        if (!config.get('enabled', true)) {
            this.logger.info('auto-chat', 'Auto-chat is disabled in configuration');
            return;
        }
        this.logger.info('auto-chat', 'Enabling auto-chat mode', {
            agentName,
            documentPath,
            hasContext: !!context
        });

        const now = new Date();
        
        this.state = {
            isActive: true,
            context: {
                agentName,
                documentPath,
                templateId: context?.templateId,
                conversationSessionId: context?.conversationSessionId,
                enabledAt: now,
                lastActivity: now
            },
            sessionStartTime: now,
            lastUserInput: null,
            messageCount: 0
        };

        this.saveState();
    }

    /**
     * Disable auto-chat mode
     */
    disableAutoChat(): void {
        this.logger.info('auto-chat', 'Disabling auto-chat mode', {
            wasActive: this.state.isActive,
            messageCount: this.state.messageCount
        });

        this.state = {
            isActive: false,
            context: null,
            sessionStartTime: null,
            lastUserInput: null,
            messageCount: 0
        };

        this.saveState();
    }

    /**
     * Check if auto-chat is currently active
     */
    isAutoChatActive(): boolean {
        // Check if session has timed out
        if (this.state.isActive && this.state.context) {
            const now = new Date();
            const timeSinceLastActivity = now.getTime() - this.state.context.lastActivity.getTime();
            const timeoutMinutes = vscode.workspace.getConfiguration('docu.autoChat').get('timeoutMinutes', 30);
            const timeout = timeoutMinutes * 60 * 1000;
            
            if (timeSinceLastActivity > timeout) {
                this.logger.info('auto-chat', 'Auto-chat session timed out', {
                    timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000),
                    timeoutMinutes
                });
                this.disableAutoChat();
                return false;
            }
        }

        return this.state.isActive;
    }

    /**
     * Get current auto-chat context
     */
    getAutoChatContext(): AutoChatContext | null {
        if (!this.isAutoChatActive()) {
            return null;
        }
        return this.state.context;
    }

    /**
     * Update activity timestamp and message count
     */
    updateActivity(): void {
        if (this.state.isActive && this.state.context) {
            this.state.context.lastActivity = new Date();
            this.state.lastUserInput = new Date();
            this.state.messageCount++;
            this.saveState();
        }
    }

    /**
     * Show auto-chat prompt to user
     */
    showAutoChatPrompt(stream: vscode.ChatResponseStream): void {
        if (!this.state.context) {
            return;
        }

        const config = vscode.workspace.getConfiguration('docu.autoChat');
        const showProgress = config.get('showProgressIndicators', true);

        const agentName = this.state.context.agentName;
        const documentInfo = this.state.context.documentPath 
            ? `\n📝 **Document:** ${this.state.context.documentPath}` 
            : '';

        stream.markdown(`✅ **Agent Set: ${agentName}**${documentInfo}\n\n`);
        stream.markdown('🤖 **Ready for conversation!** You can now chat directly without using `/chat`.\n\n');
        
        if (showProgress && this.state.context.documentPath) {
            stream.markdown('📊 **Document updates will be saved automatically during our conversation.**\n\n');
        }
        
        stream.markdown('💡 **What would you like to work on?**\n');
        stream.markdown('- Tell me about your project requirements\n');
        stream.markdown('- Help me develop the document content\n');
        stream.markdown('- Review and improve existing content\n\n');
        stream.markdown('💬 **Just type your message below to get started!**\n');
    }

    /**
     * Show conversation continuation prompt
     */
    showContinuationPrompt(stream: vscode.ChatResponseStream): void {
        if (!this.state.context) {
            return;
        }

        stream.markdown('\n💬 **Continue the conversation** - I\'m ready for your next response!\n');
        
        if (this.state.context.documentPath) {
            stream.markdown(`📝 **Document updates will be saved to:** ${this.state.context.documentPath}\n`);
        }
    }

    /**
     * Get session statistics
     */
    getSessionStats(): {
        isActive: boolean;
        agentName?: string;
        messageCount: number;
        sessionDuration?: number;
        documentPath?: string;
    } {
        const stats = {
            isActive: this.state.isActive,
            messageCount: this.state.messageCount,
            agentName: this.state.context?.agentName,
            documentPath: this.state.context?.documentPath
        };

        if (this.state.sessionStartTime) {
            const now = new Date();
            const duration = now.getTime() - this.state.sessionStartTime.getTime();
            return { ...stats, sessionDuration: Math.round(duration / 1000) };
        }

        return stats;
    }

    /**
     * Update conversation session ID
     */
    setConversationSessionId(sessionId: string): void {
        if (this.state.context) {
            this.state.context.conversationSessionId = sessionId;
            this.saveState();
        }
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): void {
        if (this.state.isActive && this.state.context) {
            const now = new Date();
            const timeSinceLastActivity = now.getTime() - this.state.context.lastActivity.getTime();
            
            const timeoutMinutes = vscode.workspace.getConfiguration('docu.autoChat').get('timeoutMinutes', 30);
            const timeout = timeoutMinutes * 60 * 1000;
            
            if (timeSinceLastActivity > timeout) {
                this.logger.info('auto-chat', 'Cleaning up expired auto-chat session', {
                    agentName: this.state.context.agentName,
                    timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000)
                });
                this.disableAutoChat();
            }
        }
    }

    /**
     * Load state from persistence
     */
    private async loadState(): Promise<void> {
        if (!this.extensionContext) {
            return;
        }

        try {
            const persistedState = this.extensionContext.globalState.get<any>('autoChatState');
            
            if (persistedState) {
                this.state = {
                    isActive: persistedState.isActive || false,
                    context: persistedState.context ? {
                        ...persistedState.context,
                        enabledAt: new Date(persistedState.context.enabledAt),
                        lastActivity: new Date(persistedState.context.lastActivity)
                    } : null,
                    sessionStartTime: persistedState.sessionStartTime ? new Date(persistedState.sessionStartTime) : null,
                    lastUserInput: persistedState.lastUserInput ? new Date(persistedState.lastUserInput) : null,
                    messageCount: persistedState.messageCount || 0
                };
                
                this.logger.info('auto-chat', 'Auto-chat state loaded from persistence', {
                    isActive: this.state.isActive,
                    agentName: this.state.context?.agentName
                });

                // Clean up expired sessions on load
                this.cleanupExpiredSessions();
            }
        } catch (error) {
            this.logger.warn('auto-chat', 'Failed to load auto-chat state', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Save state to persistence
     */
    private async saveState(): Promise<void> {
        if (!this.extensionContext) {
            return;
        }

        try {
            const serializableState = {
                isActive: this.state.isActive,
                context: this.state.context ? {
                    ...this.state.context,
                    enabledAt: this.state.context.enabledAt.toISOString(),
                    lastActivity: this.state.context.lastActivity.toISOString()
                } : null,
                sessionStartTime: this.state.sessionStartTime?.toISOString() || null,
                lastUserInput: this.state.lastUserInput?.toISOString() || null,
                messageCount: this.state.messageCount
            };
            
            await this.extensionContext.globalState.update('autoChatState', serializableState);
            
            this.logger.debug('auto-chat', 'Auto-chat state saved to persistence');
        } catch (error) {
            this.logger.warn('auto-chat', 'Failed to save auto-chat state', error instanceof Error ? error : new Error(String(error)));
        }
    }
}