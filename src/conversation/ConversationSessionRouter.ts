import * as vscode from 'vscode';
import { CommandContext } from '../commands/types';
import { ConversationManager } from './ConversationManager';
import { AgentManager } from '../agents/AgentManager';
import { ConversationErrorRecovery } from './ConversationErrorRecovery';
import { ConversationError } from './types';
import { OfflineManager } from '../offline/OfflineManager';
import { Logger } from '../logging';
import { AutoChatStateManager, AutoChatContext } from './AutoChatStateManager';
import { DocumentUpdateEngine, ConversationResponse, TemplateStructure, ConversationContext } from './DocumentUpdateEngine';

/**
 * Result of conversation routing decision
 */
export interface ConversationRoutingResult {
    routedTo: 'conversation' | 'agent' | 'error';
    sessionId?: string;
    agentName?: string;
    response?: string;
    error?: string;
    shouldContinue?: boolean;
}

/**
 * Session metadata for tracking active conversations
 */
export interface SessionMetadata {
    agentName: string;
    documentPath?: string;
    templateId?: string;
    startedAt: Date;
    lastActivity: Date;
    questionCount: number;
    responseCount: number;
}

/**
 * Conversation session state management
 */
export interface ConversationSessionState {
    activeSessionId: string | null;
    sessionsByAgent: Map<string, string>;
    sessionMetadata: Map<string, SessionMetadata>;
}

/**
 * Routes user input to appropriate conversation or agent handler
 */
export class ConversationSessionRouter {
    private logger: Logger;
    private sessionState: ConversationSessionState;
    private extensionContext?: vscode.ExtensionContext;
    private errorRecovery?: ConversationErrorRecovery;
    private autoChatManager?: AutoChatStateManager;
    private documentUpdateEngine?: DocumentUpdateEngine;

    constructor(
        private conversationManager: ConversationManager,
        private agentManager: AgentManager,
        extensionContext?: vscode.ExtensionContext,
        offlineManager?: OfflineManager
    ) {
        this.logger = Logger.getInstance();
        this.extensionContext = extensionContext;
        this.sessionState = {
            activeSessionId: null,
            sessionsByAgent: new Map(),
            sessionMetadata: new Map()
        };
        
        // Initialize error recovery if offline manager is available
        if (offlineManager) {
            this.errorRecovery = new ConversationErrorRecovery(offlineManager, agentManager);
        }
        
        // Initialize auto-chat manager
        this.autoChatManager = new AutoChatStateManager(extensionContext);
        
        // Initialize document update engine
        this.documentUpdateEngine = new DocumentUpdateEngine();
        
        // Load persisted session state
        this.loadSessionState();
    }

    /**
     * Route user input to conversation or agent
     */
    async routeUserInput(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            this.logger.info('conversation-router', 'Routing user input', {
                inputLength: input.length,
                hasActiveSession: this.hasActiveSession(),
                activeSessionId: this.sessionState.activeSessionId,
                autoChatActive: this.autoChatManager?.isAutoChatActive()
            });

            // Check if auto-chat is active
            const autoChatContext = this.autoChatManager?.getAutoChatContext();
            if (autoChatContext) {
                return await this.routeUserInputWithAutoChat(input, context, autoChatContext);
            }

            // Check if there's an active conversation session
            if (this.hasActiveSession()) {
                const sessionId = this.sessionState.activeSessionId!;
                
                // Verify the session is still active in the conversation manager
                if (this.conversationManager.getSession(sessionId)) {
                    return await this.routeToConversation(sessionId, input, context);
                } else {
                    // Session no longer exists, clean up and fall back to agent
                    this.logger.warn('conversation-router', 'Active session no longer exists, cleaning up', {
                        sessionId
                    });
                    this.clearActiveSession();
                }
            }

            // No active session, route to current agent
            return await this.routeToAgent(input, context);

        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route user input', error instanceof Error ? error : new Error(String(error)));
            return {
                routedTo: 'error',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Route user input with auto-chat awareness
     */
    async routeUserInputWithAutoChat(
        input: string,
        context: CommandContext,
        autoChatContext: AutoChatContext
    ): Promise<ConversationRoutingResult> {
        try {
            this.logger.info('conversation-router', 'Routing with auto-chat', {
                agentName: autoChatContext.agentName,
                documentPath: autoChatContext.documentPath
            });

            // Update auto-chat activity
            this.autoChatManager?.updateActivity();

            // Check if there's an existing conversation session for this agent
            let sessionId = autoChatContext.conversationSessionId;
            
            if (!sessionId || !this.conversationManager.getSession(sessionId)) {
                // Start new conversation session
                sessionId = await this.startConversationForAutoChat(autoChatContext, context);
                this.autoChatManager?.setConversationSessionId(sessionId);
            }

            // Route to conversation with document updates
            if (autoChatContext.documentPath && this.documentUpdateEngine) {
                return await this.handleConversationWithDocumentUpdates(
                    sessionId,
                    input,
                    context,
                    autoChatContext
                );
            } else {
                return await this.routeToConversation(sessionId, input, context);
            }

        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route with auto-chat', error instanceof Error ? error : new Error(String(error)));
            
            // Disable auto-chat on error and fall back
            this.autoChatManager?.disableAutoChat();
            
            return {
                routedTo: 'error',
                error: `Auto-chat error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Handle conversation with document updates
     */
    async handleConversationWithDocumentUpdates(
        sessionId: string,
        input: string,
        context: CommandContext,
        autoChatContext: AutoChatContext
    ): Promise<ConversationRoutingResult> {
        try {
            // Continue the conversation
            const conversationResponse = await this.conversationManager.continueConversation(sessionId, input);
            
            // Update document if we have a document path
            if (autoChatContext.documentPath && this.documentUpdateEngine) {
                const templateStructure = this.getTemplateStructure(autoChatContext.templateId || 'basic');
                const conversationContext: ConversationContext = {
                    agentName: autoChatContext.agentName,
                    templateId: autoChatContext.templateId || 'basic',
                    currentTurn: this.getConversationTurn(sessionId),
                    previousResponses: this.getPreviousResponses(sessionId),
                    documentPath: autoChatContext.documentPath
                };

                const updateResult = await this.documentUpdateEngine.updateDocumentFromConversation(
                    autoChatContext.documentPath,
                    conversationResponse,
                    templateStructure,
                    conversationContext
                );

                // Add document update feedback to response
                let enhancedResponse = conversationResponse.agentMessage;
                if (updateResult.success && updateResult.sectionsUpdated.length > 0) {
                    enhancedResponse += `\n\n✅ **Document Updated:** ${updateResult.sectionsUpdated.join(', ')}\n`;
                    enhancedResponse += `📊 **Progress:** ${updateResult.progressPercentage}% complete\n`;
                }

                // Check if conversation is complete
                const session = this.conversationManager.getSession(sessionId);
                const isComplete = !session?.state.isActive || conversationResponse.conversationComplete;
                
                if (isComplete) {
                    this.logger.info('conversation-router', 'Auto-chat conversation completed', { sessionId });
                    this.autoChatManager?.disableAutoChat();
                    this.clearActiveSession();
                }

                return {
                    routedTo: 'conversation',
                    sessionId,
                    response: enhancedResponse,
                    shouldContinue: !isComplete
                };
            } else {
                // No document updates, just continue conversation
                return await this.routeToConversation(sessionId, input, context);
            }

        } catch (error) {
            this.logger.error('conversation-router', 'Failed to handle conversation with document updates', error instanceof Error ? error : new Error(String(error)));
            
            return {
                routedTo: 'error',
                error: `Document update error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Check if there's an active conversation session
     */
    hasActiveSession(): boolean {
        return this.sessionState.activeSessionId !== null;
    }

    /**
     * Get the active conversation session
     */
    getActiveSession(): any | null {
        if (!this.sessionState.activeSessionId) {
            return null;
        }
        return this.conversationManager.getSession(this.sessionState.activeSessionId);
    }

    /**
     * Set the active conversation session
     */
    setActiveSession(sessionId: string, metadata?: Partial<SessionMetadata>): void {
        this.logger.info('conversation-router', 'Setting active session', { sessionId });
        
        this.sessionState.activeSessionId = sessionId;
        
        // Update session metadata if provided
        if (metadata) {
            const existingMetadata = this.sessionState.sessionMetadata.get(sessionId);
            const updatedMetadata: SessionMetadata = {
                agentName: metadata.agentName || existingMetadata?.agentName || 'unknown',
                documentPath: metadata.documentPath || existingMetadata?.documentPath,
                templateId: metadata.templateId || existingMetadata?.templateId,
                startedAt: existingMetadata?.startedAt || new Date(),
                lastActivity: metadata.lastActivity || new Date(),
                questionCount: metadata.questionCount ?? existingMetadata?.questionCount ?? 0,
                responseCount: metadata.responseCount ?? existingMetadata?.responseCount ?? 0
            };
            
            this.sessionState.sessionMetadata.set(sessionId, updatedMetadata);
            
            // Track session by agent
            if (updatedMetadata.agentName) {
                this.sessionState.sessionsByAgent.set(updatedMetadata.agentName, sessionId);
            }
        }
        
        // Persist the state change
        this.saveSessionState();
    }

    /**
     * Clear the active conversation session
     */
    clearActiveSession(): void {
        if (this.sessionState.activeSessionId) {
            this.logger.info('conversation-router', 'Clearing active session', {
                sessionId: this.sessionState.activeSessionId
            });
            
            const metadata = this.sessionState.sessionMetadata.get(this.sessionState.activeSessionId);
            if (metadata?.agentName) {
                this.sessionState.sessionsByAgent.delete(metadata.agentName);
            }
            
            this.sessionState.sessionMetadata.delete(this.sessionState.activeSessionId);
            this.sessionState.activeSessionId = null;
            
            // Persist the state change
            this.saveSessionState();
        }
    }

    /**
     * Get session metadata
     */
    getSessionMetadata(sessionId: string): SessionMetadata | null {
        return this.sessionState.sessionMetadata.get(sessionId) || null;
    }

    /**
     * Update session activity
     */
    updateSessionActivity(sessionId: string): void {
        const metadata = this.sessionState.sessionMetadata.get(sessionId);
        if (metadata) {
            metadata.lastActivity = new Date();
            metadata.responseCount++;
            this.sessionState.sessionMetadata.set(sessionId, metadata);
        }
    }

    /**
     * Get session by agent name
     */
    getSessionByAgent(agentName: string): string | null {
        return this.sessionState.sessionsByAgent.get(agentName) || null;
    }

    /**
     * Route input to active conversation
     */
    private async routeToConversation(
        sessionId: string,
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            this.logger.info('conversation-router', 'Routing to conversation', { sessionId });
            
            // Update session activity
            this.updateSessionActivity(sessionId);
            
            // Continue the conversation
            const response = await this.conversationManager.continueConversation(sessionId, input);
            
            // Check if conversation is complete
            const session = this.conversationManager.getSession(sessionId);
            const isComplete = !session?.state.isActive || response.conversationComplete;
            
            if (isComplete) {
                this.logger.info('conversation-router', 'Conversation completed, clearing session', { sessionId });
                this.clearActiveSession();
            }
            
            return {
                routedTo: 'conversation',
                sessionId,
                response: response.agentMessage,
                shouldContinue: !isComplete
            };
            
        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route to conversation', error instanceof Error ? error : new Error(String(error)));
            
            // Try to recover from the error
            if (this.errorRecovery && error instanceof ConversationError) {
                try {
                    await this.errorRecovery.recoverFromFailure(error, context);
                } catch (recoveryError) {
                    this.logger.error('conversation-router', 'Error recovery failed', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
                }
            }
            
            // Clear the problematic session
            this.clearActiveSession();
            
            return {
                routedTo: 'error',
                error: `Conversation error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Route input to current agent
     */
    private async routeToAgent(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            const currentAgent = this.agentManager.getCurrentAgent();
            
            if (!currentAgent) {
                return {
                    routedTo: 'error',
                    error: 'No active agent available'
                };
            }
            
            this.logger.info('conversation-router', 'Routing to agent', { agentName: currentAgent.name });
            
            // Build agent context
            const agentContext = this.agentManager.buildAgentContext(context.request);
            
            // Create agent request
            const agentRequest: import('../agents/types').ChatRequest = {
                command: context.request.command,
                prompt: input,
                parameters: {},
                originalRequest: context.request
            };
            
            // Handle request with agent
            const agentResponse = await currentAgent.handleRequest(agentRequest, agentContext);
            
            return {
                routedTo: 'agent',
                agentName: currentAgent.name,
                response: agentResponse.content || '',
                shouldContinue: false
            };
            
        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route to agent', error instanceof Error ? error : new Error(String(error)));
            
            return {
                routedTo: 'error',
                error: `Agent error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Clean up inactive sessions
     */
    cleanupInactiveSessions(): void {
        const now = new Date();
        const maxInactiveTime = 30 * 60 * 1000; // 30 minutes
        
        for (const [sessionId, metadata] of this.sessionState.sessionMetadata.entries()) {
            const inactiveTime = now.getTime() - metadata.lastActivity.getTime();
            
            if (inactiveTime > maxInactiveTime) {
                this.logger.info('conversation-router', 'Cleaning up inactive session', {
                    sessionId,
                    inactiveTime: Math.round(inactiveTime / 1000)
                });
                
                // Remove from our tracking
                this.sessionState.sessionMetadata.delete(sessionId);
                if (metadata.agentName) {
                    this.sessionState.sessionsByAgent.delete(metadata.agentName);
                }
                
                // Clear active session if it's this one
                if (this.sessionState.activeSessionId === sessionId) {
                    this.sessionState.activeSessionId = null;
                }
            }
        }
    }

    /**
     * Get session state for debugging
     */
    getSessionState(): ConversationSessionState {
        return {
            activeSessionId: this.sessionState.activeSessionId,
            sessionsByAgent: new Map(this.sessionState.sessionsByAgent),
            sessionMetadata: new Map(this.sessionState.sessionMetadata)
        };
    }

    /**
     * Get auto-chat manager instance
     */
    getAutoChatManager(): AutoChatStateManager | undefined {
        return this.autoChatManager;
    }

    /**
     * Get document update engine instance
     */
    getDocumentUpdateEngine(): DocumentUpdateEngine | undefined {
        return this.documentUpdateEngine;
    }

    /**
     * Start conversation for auto-chat
     */
    private async startConversationForAutoChat(
        autoChatContext: AutoChatContext,
        context: CommandContext
    ): Promise<string> {
        // Get the agent
        const agent = this.agentManager.getAgent(autoChatContext.agentName);
        if (!agent) {
            throw new Error(`Agent ${autoChatContext.agentName} not found`);
        }

        // Start conversation with the agent
        const conversationContext = {
            documentType: autoChatContext.templateId || 'basic',
            workflowPhase: 'creation',
            documentPath: autoChatContext.documentPath || '',
            title: autoChatContext.documentPath ? 
                `Document: ${autoChatContext.documentPath}` : 
                'Auto-chat conversation',
            workspaceRoot: context.workspaceRoot,
            extensionContext: context.extensionContext
        };

        const session = await this.conversationManager.startConversation(autoChatContext.agentName, conversationContext);
        const sessionId = session.sessionId;
        
        // Set as active session
        this.setActiveSession(sessionId, {
            agentName: autoChatContext.agentName,
            documentPath: autoChatContext.documentPath,
            templateId: autoChatContext.templateId,
            startedAt: new Date(),
            lastActivity: new Date(),
            questionCount: 0,
            responseCount: 0
        });

        return sessionId;
    }

    /**
     * Get template structure for document updates
     */
    private getTemplateStructure(templateId: string): TemplateStructure {
        // Default template structures - in a real implementation, 
        // this would come from the template manager
        const templates: { [key: string]: TemplateStructure } = {
            'basic': {
                sections: {
                    'Overview': { header: '## Overview', required: true, order: 1 },
                    'Requirements': { header: '## Requirements', required: false, order: 2 },
                    'Implementation': { header: '## Implementation', required: false, order: 3 },
                    'Testing': { header: '## Testing', required: false, order: 4 }
                },
                placeholders: {
                    '{{OVERVIEW}}': { section: 'Overview', description: 'Document overview' }
                }
            },
            'prd': {
                sections: {
                    'Problem Statement': { header: '## Problem Statement', required: true, order: 1 },
                    'Target Users': { header: '## Target Users', required: true, order: 2 },
                    'Goals and Objectives': { header: '## Goals and Objectives', required: true, order: 3 },
                    'Key Features': { header: '## Key Features', required: true, order: 4 },
                    'User Stories': { header: '## User Stories', required: false, order: 5 },
                    'Technical Requirements': { header: '## Technical Requirements', required: false, order: 6 },
                    'Success Metrics': { header: '## Success Metrics', required: false, order: 7 },
                    'Timeline': { header: '## Timeline', required: false, order: 8 }
                },
                placeholders: {
                    '{{PROBLEM_STATEMENT}}': { section: 'Problem Statement', description: 'Main problem being solved' },
                    '{{TARGET_USERS}}': { section: 'Target Users', description: 'Primary user personas' }
                }
            }
        };

        return templates[templateId] || templates['basic'];
    }

    /**
     * Get current conversation turn number
     */
    private getConversationTurn(sessionId: string): number {
        const session = this.conversationManager.getSession(sessionId);
        return session?.state.currentTurn || 1;
    }

    /**
     * Get previous conversation responses
     */
    private getPreviousResponses(sessionId: string): string[] {
        const session = this.conversationManager.getSession(sessionId);
        return session?.state.conversationHistory?.map(h => h.userMessage || '') || [];
    }

    /**
     * Load session state from persistence
     */
    private async loadSessionState(): Promise<void> {
        if (!this.extensionContext) {
            return;
        }

        try {
            const persistedState = this.extensionContext.globalState.get<any>('conversationSessionState');
            
            if (persistedState) {
                this.sessionState.activeSessionId = persistedState.activeSessionId || null;
                
                // Restore maps from serialized data
                if (persistedState.sessionsByAgent) {
                    this.sessionState.sessionsByAgent = new Map(Object.entries(persistedState.sessionsByAgent));
                }
                
                if (persistedState.sessionMetadata) {
                    const metadataEntries: [string, SessionMetadata][] = Object.entries(persistedState.sessionMetadata).map(([key, value]: [string, any]) => [
                        key,
                        {
                            ...value,
                            startedAt: new Date(value.startedAt),
                            lastActivity: new Date(value.lastActivity)
                        }
                    ]);
                    this.sessionState.sessionMetadata = new Map(metadataEntries);
                }
                
                this.logger.info('conversation-router', 'Session state loaded from persistence', {
                    activeSessionId: this.sessionState.activeSessionId,
                    sessionCount: this.sessionState.sessionMetadata.size
                });
            }
        } catch (error) {
            this.logger.warn('conversation-router', 'Failed to load session state', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Save session state to persistence
     */
    private async saveSessionState(): Promise<void> {
        if (!this.extensionContext) {
            return;
        }

        try {
            // Convert maps to serializable objects
            const serializableState = {
                activeSessionId: this.sessionState.activeSessionId,
                sessionsByAgent: Object.fromEntries(this.sessionState.sessionsByAgent),
                sessionMetadata: Object.fromEntries(
                    Array.from(this.sessionState.sessionMetadata.entries()).map(([key, value]) => [
                        key,
                        {
                            ...value,
                            startedAt: value.startedAt.toISOString(),
                            lastActivity: value.lastActivity.toISOString()
                        }
                    ])
                )
            };
            
            await this.extensionContext.globalState.update('conversationSessionState', serializableState);
            
            this.logger.debug('conversation-router', 'Session state saved to persistence');
        } catch (error) {
            this.logger.warn('conversation-router', 'Failed to save session state', error instanceof Error ? error : new Error(String(error)));
        }
    }

    // Duplicate functions removed - using the original implementations above
}