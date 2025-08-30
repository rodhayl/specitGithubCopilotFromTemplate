import * as vscode from 'vscode';
import { CommandContext } from '../commands/types';
import { ConversationError } from './types';
import { OfflineManager } from '../offline/OfflineManager';
import { AgentManager } from '../agents/AgentManager';
import { Logger } from '../logging';

/**
 * Recovery result for conversation errors
 */
export interface RecoveryResult {
    success: boolean;
    action: 'retry' | 'fallback' | 'manual' | 'abort';
    message?: string;
    fallbackOptions?: string[];
}

/**
 * Handles conversation error recovery and provides fallback options
 */
export class ConversationErrorRecovery {
    private logger: Logger;

    constructor(
        private offlineManager: OfflineManager,
        private agentManager: AgentManager
    ) {
        this.logger = Logger.getInstance();
    }

    /**
     * Handle session not found errors
     */
    async handleSessionNotFound(
        expectedSessionId: string,
        context: CommandContext
    ): Promise<void> {
        this.logger.warn('conversation-recovery', 'Session not found', { expectedSessionId });

        context.stream.markdown('⚠️ **Conversation Session Lost**\n\n');
        context.stream.markdown('The conversation session is no longer available. This can happen if:\n');
        context.stream.markdown('- The extension was restarted\n');
        context.stream.markdown('- The session timed out\n');
        context.stream.markdown('- There was an internal error\n\n');

        context.stream.markdown('**Recovery Options:**\n');
        context.stream.markdown('- `/agent current` - Check which agent is active\n');
        context.stream.markdown('- `/chat <your message>` - Start a new conversation\n');
        context.stream.markdown('- `/agent set <name>` - Set a specific agent and try again\n\n');

        // Try to suggest the most appropriate agent based on context
        const currentAgent = this.agentManager.getCurrentAgent();
        if (currentAgent) {
            context.stream.markdown(`💡 **Tip:** The ${currentAgent.name} agent is currently active. You can start a new conversation by simply typing your message.\n`);
        } else {
            context.stream.markdown('💡 **Tip:** Set an agent first with `/agent set <name>`, then start chatting.\n');
        }
    }

    /**
     * Handle inactive session errors
     */
    async handleInactiveSession(
        sessionId: string,
        context: CommandContext
    ): Promise<void> {
        this.logger.warn('conversation-recovery', 'Session inactive', { sessionId });

        context.stream.markdown('⚠️ **Conversation Session Inactive**\n\n');
        context.stream.markdown('The conversation session has been deactivated. This usually means the conversation was completed or ended.\n\n');

        context.stream.markdown('**What you can do:**\n');
        context.stream.markdown('- Start a new conversation with `/chat <your message>`\n');
        context.stream.markdown('- Switch agents with `/agent set <name>` if needed\n');
        context.stream.markdown('- Use `/help` to see available commands\n\n');

        // Provide agent-specific guidance
        const currentAgent = this.agentManager.getCurrentAgent();
        if (currentAgent) {
            context.stream.markdown(`🤖 **Active Agent:** ${currentAgent.name}\n`);
            context.stream.markdown('You can start a new conversation by typing your message directly.\n');
        }
    }

    /**
     * Provide fallback when conversation fails
     */
    async provideFallback(
        error: ConversationError,
        context: CommandContext
    ): Promise<void> {
        this.logger.error('conversation-recovery', 'Providing fallback for conversation error', error);

        context.stream.markdown('❌ **Conversation Error**\n\n');
        context.stream.markdown(`**Error:** ${error.message}\n\n`);

        // Check if we're in offline mode
        if (this.offlineManager.isOffline()) {
            await this.provideOfflineFallback(context);
            return;
        }

        // Provide general recovery options
        context.stream.markdown('**Recovery Options:**\n');

        switch (error.code) {
            case 'SESSION_NOT_FOUND':
                context.stream.markdown('- The conversation session was lost. Start a new one with `/chat <message>`\n');
                break;
            case 'SESSION_INACTIVE':
                context.stream.markdown('- The conversation ended. Start a new one with `/chat <message>`\n');
                break;
            case 'NO_CURRENT_QUESTION':
                context.stream.markdown('- The conversation state is corrupted. Start fresh with `/chat <message>`\n');
                break;
            case 'CONTINUE_CONVERSATION_FAILED':
                context.stream.markdown('- Try rephrasing your response\n');
                context.stream.markdown('- Check if the agent is still available with `/agent current`\n');
                break;
            default:
                context.stream.markdown('- Try starting a new conversation with `/chat <message>`\n');
                context.stream.markdown('- Check available agents with `/agent list`\n');
        }

        context.stream.markdown('- Use `/help` for more command options\n\n');

        // Suggest appropriate agents based on error context
        if (error.sessionId) {
            context.stream.markdown('💡 **Tip:** If you were working on a specific document, set the appropriate agent:\n');
            context.stream.markdown('- `/agent set prd-creator` for Product Requirements\n');
            context.stream.markdown('- `/agent set brainstormer` for ideation and planning\n');
            context.stream.markdown('- `/agent set quality-reviewer` for document review\n\n');
        }
    }

    /**
     * Recover from conversation failure
     */
    async recoverFromFailure(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        this.logger.info('conversation-recovery', 'Attempting recovery from conversation failure', {
            errorCode: error.code,
            sessionId: error.sessionId
        });

        try {
            // Determine recovery strategy based on error type
            switch (error.code) {
                case 'SESSION_NOT_FOUND':
                    await this.handleSessionNotFound(error.sessionId || 'unknown', context);
                    return {
                        success: true,
                        action: 'manual',
                        message: 'Session recovery guidance provided'
                    };

                case 'SESSION_INACTIVE':
                    await this.handleInactiveSession(error.sessionId || 'unknown', context);
                    return {
                        success: true,
                        action: 'manual',
                        message: 'Inactive session guidance provided'
                    };

                case 'START_CONVERSATION_FAILED':
                case 'CONTINUE_CONVERSATION_FAILED':
                    // Try to provide fallback options
                    await this.provideFallback(error, context);
                    return {
                        success: true,
                        action: 'fallback',
                        message: 'Fallback options provided',
                        fallbackOptions: [
                            'Start new conversation with /chat',
                            'Check agent status with /agent current',
                            'Set different agent with /agent set <name>'
                        ]
                    };

                default:
                    // Generic recovery
                    await this.provideFallback(error, context);
                    return {
                        success: true,
                        action: 'manual',
                        message: 'Generic recovery guidance provided'
                    };
            }

        } catch (recoveryError) {
            this.logger.error('conversation-recovery', 'Recovery attempt failed', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
            
            context.stream.markdown('❌ **Recovery Failed**\n\n');
            context.stream.markdown('Unable to provide automatic recovery. Please try:\n');
            context.stream.markdown('- Restart VS Code\n');
            context.stream.markdown('- Use `/help` for available commands\n');
            context.stream.markdown('- Report this issue if it persists\n');

            return {
                success: false,
                action: 'abort',
                message: 'Recovery failed'
            };
        }
    }

    /**
     * Provide offline mode fallback
     */
    private async provideOfflineFallback(context: CommandContext): Promise<void> {
        context.stream.markdown('⚠️ **Offline Mode Active**\n\n');
        context.stream.markdown('AI conversation features are currently unavailable. Here\'s what you can do:\n\n');

        context.stream.markdown('**Document Creation:**\n');
        context.stream.markdown('- Use `/new "Title" --template basic` to create documents\n');
        context.stream.markdown('- Use `/templates list` to see available templates\n');
        context.stream.markdown('- Edit documents manually in VS Code\n\n');

        context.stream.markdown('**When AI Returns:**\n');
        context.stream.markdown('- Set an agent with `/agent set <name>`\n');
        context.stream.markdown('- Start conversations with `/chat <message>`\n');
        context.stream.markdown('- Get help with `/help`\n\n');

        context.stream.markdown('💡 **Tip:** Your work will be saved and you can continue with AI assistance when the service becomes available.\n');
    }

    /**
     * Check if error is recoverable
     */
    isRecoverable(error: ConversationError): boolean {
        const recoverableErrors = [
            'SESSION_NOT_FOUND',
            'SESSION_INACTIVE',
            'NO_CURRENT_QUESTION',
            'CONTINUE_CONVERSATION_FAILED'
        ];

        return recoverableErrors.includes(error.code);
    }

    /**
     * Get recovery suggestions for error
     */
    getRecoverySuggestions(error: ConversationError): string[] {
        const suggestions: string[] = [];

        switch (error.code) {
            case 'SESSION_NOT_FOUND':
            case 'SESSION_INACTIVE':
                suggestions.push('Start a new conversation with /chat <message>');
                suggestions.push('Check active agent with /agent current');
                break;

            case 'NO_CURRENT_QUESTION':
                suggestions.push('Start fresh conversation with /chat <message>');
                suggestions.push('Set appropriate agent with /agent set <name>');
                break;

            case 'CONTINUE_CONVERSATION_FAILED':
                suggestions.push('Try rephrasing your response');
                suggestions.push('Check agent availability with /agent current');
                suggestions.push('Start new conversation if issue persists');
                break;

            default:
                suggestions.push('Use /help for available commands');
                suggestions.push('Try /agent list to see available agents');
                suggestions.push('Start new conversation with /chat <message>');
        }

        return suggestions;
    }
}