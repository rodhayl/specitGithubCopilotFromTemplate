import * as vscode from 'vscode';
import { Logger } from '../logging';
import { CommandContext } from '../commands/types';
import { AutoChatStateManager } from './AutoChatStateManager';
import { DocumentUpdateEngine } from './DocumentUpdateEngine';

/**
 * Auto-chat specific error types
 */
export class AutoChatError extends Error {
    constructor(
        message: string,
        public readonly errorType: 'state_corruption' | 'document_update_failure' | 'session_timeout' | 'agent_unavailable',
        public readonly context?: any
    ) {
        super(message);
        this.name = 'AutoChatError';
    }
}

/**
 * Recovery options for auto-chat errors
 */
export interface AutoChatRecoveryOption {
    action: 'restart_autochat' | 'disable_autochat' | 'manual_chat' | 'retry_operation';
    description: string;
    command?: string;
}

/**
 * Handles error recovery for auto-chat functionality
 */
export class AutoChatErrorRecovery {
    private logger: Logger;

    constructor(
        private autoChatManager: AutoChatStateManager,
        private documentUpdateEngine?: DocumentUpdateEngine
    ) {
        this.logger = Logger.getInstance();
    }

    /**
     * Handle auto-chat state corruption
     */
    async recoverAutoChatState(): Promise<void> {
        try {
            this.logger.warn('auto-chat-recovery', 'Recovering from auto-chat state corruption');
            
            // Clear corrupted state
            this.autoChatManager.disableAutoChat();
            
            // Clean up any expired sessions
            this.autoChatManager.cleanupExpiredSessions();
            
            this.logger.info('auto-chat-recovery', 'Auto-chat state recovery completed');
            
        } catch (error) {
            this.logger.error('auto-chat-recovery', 'Failed to recover auto-chat state', error instanceof Error ? error : new Error(String(error)));
            throw new AutoChatError(
                'Failed to recover auto-chat state',
                'state_corruption',
                { originalError: error }
            );
        }
    }

    /**
     * Handle document update failures
     */
    async recoverDocumentUpdate(
        documentPath: string,
        failedContent: string,
        error: Error
    ): Promise<void> {
        try {
            this.logger.warn('auto-chat-recovery', 'Recovering from document update failure', {
                documentPath,
                error: error.message
            });

            // Try to create a backup of the failed content
            await this.createContentBackup(documentPath, failedContent);
            
            // Reset document update progress for this file
            if (this.documentUpdateEngine) {
                const progress = this.documentUpdateEngine.getUpdateProgress(documentPath);
                this.logger.info('auto-chat-recovery', 'Document update progress reset', {
                    documentPath,
                    previousProgress: progress.progressPercentage
                });
            }
            
        } catch (recoveryError) {
            this.logger.error('auto-chat-recovery', 'Failed to recover from document update failure', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
            throw new AutoChatError(
                'Failed to recover from document update failure',
                'document_update_failure',
                { originalError: error, recoveryError }
            );
        }
    }

    /**
     * Provide fallback guidance when auto-chat fails
     */
    async provideFallbackGuidance(
        error: AutoChatError,
        context: CommandContext
    ): Promise<void> {
        const recoveryOptions = this.getRecoveryOptions(error);
        
        // Show error message with recovery options
        context.stream.markdown(`⚠️ **Auto-Chat Error**\n\n`);
        context.stream.markdown(`**Issue:** ${error.message}\n\n`);
        
        context.stream.markdown('**Recovery Options:**\n');
        for (const option of recoveryOptions) {
            if (option.command) {
                context.stream.markdown(`- **${option.description}**: \`${option.command}\`\n`);
            } else {
                context.stream.markdown(`- ${option.description}\n`);
            }
        }
        
        context.stream.markdown('\n💡 **You can continue working manually or try restarting auto-chat.**\n');
        
        // Log the error for debugging
        this.logger.error('auto-chat-recovery', 'Auto-chat error occurred', error, {
            errorType: error.errorType,
            context: error.context
        });
    }

    /**
     * Handle session timeout recovery
     */
    async handleSessionTimeout(
        agentName: string,
        documentPath?: string,
        context?: CommandContext
    ): Promise<void> {
        try {
            this.logger.info('auto-chat-recovery', 'Handling session timeout', {
                agentName,
                documentPath
            });

            // Clear the timed-out session
            this.autoChatManager.disableAutoChat();
            
            if (context) {
                context.stream.markdown('⏰ **Auto-chat session timed out**\n\n');
                context.stream.markdown(`**Agent:** ${agentName}\n`);
                if (documentPath) {
                    context.stream.markdown(`**Document:** ${documentPath}\n`);
                }
                context.stream.markdown('\n**What you can do:**\n');
                context.stream.markdown(`- \`/agent set ${agentName}\` - Restart auto-chat with this agent\n`);
                context.stream.markdown('- `/chat <message>` - Start a manual conversation\n');
                context.stream.markdown('- Continue editing the document manually\n');
            }
            
        } catch (error) {
            this.logger.error('auto-chat-recovery', 'Failed to handle session timeout', error instanceof Error ? error : new Error(String(error)));
            throw new AutoChatError(
                'Failed to handle session timeout',
                'session_timeout',
                { agentName, documentPath, originalError: error }
            );
        }
    }

    /**
     * Handle agent unavailable errors
     */
    async handleAgentUnavailable(
        agentName: string,
        context: CommandContext
    ): Promise<void> {
        try {
            this.logger.warn('auto-chat-recovery', 'Handling agent unavailable', { agentName });

            // Disable auto-chat since agent is unavailable
            this.autoChatManager.disableAutoChat();
            
            context.stream.markdown(`❌ **Agent Unavailable: ${agentName}**\n\n`);
            context.stream.markdown('The requested agent is not available for auto-chat.\n\n');
            context.stream.markdown('**Available options:**\n');
            context.stream.markdown('- `/agent list` - See available agents\n');
            context.stream.markdown('- `/agent set <other-agent>` - Switch to a different agent\n');
            context.stream.markdown('- Continue working without AI assistance\n');
            
        } catch (error) {
            this.logger.error('auto-chat-recovery', 'Failed to handle agent unavailable', error instanceof Error ? error : new Error(String(error)));
            throw new AutoChatError(
                'Failed to handle agent unavailable error',
                'agent_unavailable',
                { agentName, originalError: error }
            );
        }
    }

    /**
     * Attempt to restart auto-chat after error
     */
    async attemptAutoChatRestart(
        agentName: string,
        documentPath?: string,
        templateId?: string
    ): Promise<boolean> {
        try {
            this.logger.info('auto-chat-recovery', 'Attempting auto-chat restart', {
                agentName,
                documentPath,
                templateId
            });

            // Clear any existing state
            this.autoChatManager.disableAutoChat();
            
            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to re-enable auto-chat
            this.autoChatManager.enableAutoChat(agentName, documentPath, {
                templateId,
                documentPath
            });
            
            this.logger.info('auto-chat-recovery', 'Auto-chat restart successful');
            return true;
            
        } catch (error) {
            this.logger.error('auto-chat-recovery', 'Auto-chat restart failed', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }

    /**
     * Get recovery options based on error type
     */
    private getRecoveryOptions(error: AutoChatError): AutoChatRecoveryOption[] {
        const options: AutoChatRecoveryOption[] = [];
        
        switch (error.errorType) {
            case 'state_corruption':
                options.push({
                    action: 'restart_autochat',
                    description: 'Restart auto-chat mode',
                    command: '/agent set <agent-name>'
                });
                options.push({
                    action: 'manual_chat',
                    description: 'Use manual chat commands',
                    command: '/chat <message>'
                });
                break;
                
            case 'document_update_failure':
                options.push({
                    action: 'retry_operation',
                    description: 'Try the conversation again'
                });
                options.push({
                    action: 'disable_autochat',
                    description: 'Disable auto-updates and continue manually'
                });
                break;
                
            case 'session_timeout':
                options.push({
                    action: 'restart_autochat',
                    description: 'Start a new auto-chat session',
                    command: '/agent set <agent-name>'
                });
                options.push({
                    action: 'manual_chat',
                    description: 'Continue with manual chat',
                    command: '/chat <message>'
                });
                break;
                
            case 'agent_unavailable':
                options.push({
                    action: 'restart_autochat',
                    description: 'Choose a different agent',
                    command: '/agent list'
                });
                options.push({
                    action: 'manual_chat',
                    description: 'Work without AI assistance'
                });
                break;
                
            default:
                options.push({
                    action: 'disable_autochat',
                    description: 'Disable auto-chat and continue manually'
                });
                options.push({
                    action: 'manual_chat',
                    description: 'Use manual chat commands',
                    command: '/chat <message>'
                });
                break;
        }
        
        return options;
    }

    /**
     * Create backup of failed content
     */
    private async createContentBackup(documentPath: string, content: string): Promise<void> {
        try {
            const backupPath = `${documentPath}.backup.${Date.now()}.md`;
            const backupContent = `# Backup of Failed Content\n\nOriginal document: ${documentPath}\nTimestamp: ${new Date().toISOString()}\n\n---\n\n${content}`;
            
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(backupPath),
                Buffer.from(backupContent, 'utf8')
            );
            
            this.logger.info('auto-chat-recovery', 'Content backup created', { backupPath });
            
        } catch (error) {
            this.logger.warn('auto-chat-recovery', 'Failed to create content backup', error instanceof Error ? error : new Error(String(error)));
            // Don't throw here - backup failure shouldn't prevent recovery
        }
    }

    /**
     * Validate auto-chat state integrity
     */
    validateAutoChatState(): { valid: boolean; issues: string[] } {
        const issues: string[] = [];
        
        try {
            const isActive = this.autoChatManager.isAutoChatActive();
            const context = this.autoChatManager.getAutoChatContext();
            
            if (isActive && !context) {
                issues.push('Auto-chat is active but context is missing');
            }
            
            if (context) {
                if (!context.agentName) {
                    issues.push('Auto-chat context missing agent name');
                }
                
                if (!context.enabledAt || !context.lastActivity) {
                    issues.push('Auto-chat context missing timestamps');
                }
                
                // Check for stale sessions
                const now = new Date();
                const timeSinceActivity = now.getTime() - context.lastActivity.getTime();
                if (timeSinceActivity > 60 * 60 * 1000) { // 1 hour
                    issues.push('Auto-chat session appears stale (no activity for over 1 hour)');
                }
            }
            
        } catch (error) {
            issues.push(`Error validating auto-chat state: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
}