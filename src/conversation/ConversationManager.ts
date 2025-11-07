// Consolidated ConversationManager implementation
import * as vscode from 'vscode';
import { 
    ConversationManager as IConversationManager,
    ConversationContext,
    ConversationSession,
    ConversationResponse,
    ConversationSummary,
    ConversationTurn,
    ConversationState,
    ConversationError,
    Question,
    QuestionEngine,
    ResponseProcessor,
    ContentCapture,
    WorkflowSuggestion,
    WorkflowOrchestrator,
    ProgressTracker,
    DocumentUpdate
} from './types';
import { Logger } from '../logging/Logger';
import { ErrorHandler, ErrorCategory, withErrorHandling } from '../utils/ErrorHandler';
import { CommandResult, CommandContext, ConversationConfig } from '../commands/types';
import { OutputCoordinator } from '../commands/OutputCoordinator';
import { AgentUtils } from '../utils/AgentUtils';
import { OfflineManager } from '../offline/OfflineManager';
import { AgentManager } from '../agents/AgentManager';

// Consolidated interfaces from removed managers
export interface ConversationStateInfo {
    isActive: boolean;
    agentName?: string;
    documentPath?: string;
    phase?: string;
    nextSteps?: string[];
}

export interface FeedbackOptions {
    showProgressIndicator?: boolean;
    includeNextSteps?: boolean;
    includeRecoveryOptions?: boolean;
    showConversationTips?: boolean;
}

export interface RecoveryResult {
    success: boolean;
    message: string;
    fallbackOptions: string[];
    recoveryAction?: string;
}

export interface RecoveryOption {
    description: string;
    action: string;
    command?: string;
}

export interface ConversationInitiationResult {
    success: boolean;
    sessionId?: string;
    error?: string;
    fallbackOptions?: string[];
}

export interface CommandConversationMapping {
    commandName: string;
    templateMappings: {
        [templateId: string]: {
            agentName: string;
            autoStart: boolean;
            questions: Question[];
        };
    };
    defaultAgent?: string;
    conversationFlags: string[];
}

/**
 * ConversationManager - Manages conversation sessions and multi-turn interactions
 *
 * Coordinates conversation flows, maintains session state, processes questions/responses,
 * and integrates with the question engine and response processor. Supports multi-turn
 * conversations with context retention and session management.
 *
 * @example
 * ```typescript
 * const convManager = new ConversationManager(questionEngine, responseProcessor);
 * const session = await convManager.startConversation(request, { agentName: 'prd-creator' });
 * await convManager.processResponse(sessionId, response);
 * ```
 */
export class ConversationManager implements IConversationManager {
    private static instance: ConversationManager;
    private sessions: Map<string, ConversationSession> = new Map();
    private conversationHistory: Map<string, ConversationTurn[]> = new Map();
    private activeSessionsByAgent: Map<string, string> = new Map();
    private logger: Logger;
    private outputCoordinator: OutputCoordinator;
    private commandMappings: Map<string, CommandConversationMapping> = new Map();

    constructor(
        private questionEngine?: QuestionEngine,
        private responseProcessor?: ResponseProcessor,
        private contentCapture?: ContentCapture,
        private workflowOrchestrator?: WorkflowOrchestrator,
        private progressTracker?: ProgressTracker,
        private extensionContext?: vscode.ExtensionContext,
        private offlineManager?: OfflineManager,
        private agentManager?: AgentManager
    ) {
        this.logger = Logger.getInstance();
        this.outputCoordinator = OutputCoordinator.getInstance();
        this.initializeCommandMappings();
    }

    static getInstance(): ConversationManager {
        if (!ConversationManager.instance) {
            ConversationManager.instance = new ConversationManager();
        }
        return ConversationManager.instance;
    }

    static setInstance(instance: ConversationManager): void {
        ConversationManager.instance = instance;
    }

    /**
     * Start a conversation continuation from a command result
     */
    async startContinuation(commandName: string, commandResult: any, userContext: any): Promise<string> {
        // Implementation for starting conversation continuation
        const sessionId = this.generateSessionId();
        // Add logic here based on command result
        return sessionId;
    }

    /**
     * Determine if a conversation should be started based on command result
     */
    shouldStartConversation(commandName: string, commandResult: any, userContext: any): any {
        // Implementation for determining if conversation should start
        return {
            shouldStart: true,
            agentName: 'default',
            reason: 'Command completed successfully'
        };
    }

    /**
     * Handle errors in conversation
     */
    handleError(sessionId: string, error: { name?: string; type: string; message: string; recoverable: boolean }): any {
        // Implementation for handling conversation errors
        const canRetry = error.recoverable && (error.type === 'network' || error.type === 'execution');
        const canModify = error.type === 'validation' || error.type === 'input';
        
        const suggestedActions = [];
        if (canRetry) {
            suggestedActions.push('retry', 'wait_and_retry');
        }
        if (canModify) {
            suggestedActions.push('modify_input', 'clarify_request');
        }
        if (!canRetry && !canModify) {
            suggestedActions.push('restart_conversation', 'contact_support');
        }
        
        return {
            handled: true,
            canRetry,
            canModify,
            suggestedActions,
            recovery: canRetry ? 'retry' : 'modify',
            message: `Error handled: ${error.message}`
        };
    }

    /**
     * Attempt recovery from conversation errors
     *
     * @returns Recovery result with success status, strategy, message, and action
     */
    async attemptRecovery(sessionId: string, error: { name?: string; type: string; message: string; recoverable: boolean }, strategy: string): Promise<{
        success: boolean;
        strategy: string;
        message: string;
        action: string;
    }> {
        // Implementation for attempting recovery
        const session = this.sessions.get(sessionId);
        if (!session) {
            return {
                success: false,
                strategy,
                message: 'Session not found',
                action: 'restart'
            };
        }
        
        let success = false;
        let action = strategy;
        let message = '';
        
        switch (strategy) {
            case 'retry':
                if (error.recoverable) {
                    success = true;
                    message = 'Operation retried successfully';
                } else {
                    success = false;
                    message = 'Error is not recoverable';
                    action = 'restart';
                }
                break;
            case 'modify':
                success = true;
                message = 'Ready for modified input';
                action = 'modify';
                break;
            case 'restart':
                success = true;
                message = 'Conversation restarted';
                action = 'restart';
                // Reset session state
                session.state.currentQuestionIndex = 0;
                session.state.isActive = true;
                break;
            default:
                success = false;
                message = 'Unknown recovery strategy';
                action = 'unknown';
        }
        
        return {
            success,
            strategy,
            action,
            message
        };
    }

    async startConversation(agentName: string, context: ConversationContext): Promise<ConversationSession> {
        try {
            // End any existing session for this agent
            const existingSessionId = this.activeSessionsByAgent.get(agentName);
            if (existingSessionId) {
                await this.endConversation(existingSessionId);
            }

            // Generate session ID
            const sessionId = this.generateSessionId();
            
            // Generate initial questions
            const initialQuestions = this.questionEngine?.generateInitialQuestions(agentName, context) || [];
            
            // Create conversation state
            const state: ConversationState = {
                sessionId,
                agentName,
                phase: context.workflowPhase,
                currentQuestionIndex: 0,
                answeredQuestions: new Map(),
                extractedData: new Map(),
                pendingValidations: [],
                completionScore: 0,
                isActive: true,
                lastUpdated: new Date(),
                // Enhanced fields for command-initiated conversations
                documentPath: context.documentPath,
                templateId: context.documentType
            };

            // Create session
            const session: ConversationSession = {
                sessionId,
                agentName,
                currentQuestionSet: initialQuestions,
                state,
                createdAt: new Date(),
                lastActivity: new Date()
            };

            // Store session
            this.sessions.set(sessionId, session);
            this.activeSessionsByAgent.set(agentName, sessionId);
            this.conversationHistory.set(sessionId, []);

            // Initialize conversation history with system message
            await this.addConversationTurn(sessionId, 'system', 
                `Conversation started with ${agentName} agent for ${context.documentType} in ${context.workflowPhase} phase`);

            // Initialize progress tracking
            if (this.progressTracker) {
                this.progressTracker.updateProgress(sessionId, {
                    currentPhase: context.workflowPhase,
                    completionPercentage: 0,
                    completedSections: [],
                    pendingSections: await this.getRequiredSections(context),
                    nextSteps: initialQuestions.slice(0, 3).map(q => q.text),
                    estimatedTimeRemaining: this.estimateSessionDuration(initialQuestions.length)
                });
            }

            return session;

        } catch (error) {
            throw new ConversationError(
                `Failed to start conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'START_CONVERSATION_FAILED',
                undefined,
                true
            );
        }
    }

    async continueConversation(sessionId: string, userResponse: string): Promise<ConversationResponse> {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new ConversationError('Session not found', 'SESSION_NOT_FOUND', sessionId);
            }

            if (!session.state.isActive) {
                throw new ConversationError('Session is not active', 'SESSION_INACTIVE', sessionId);
            }

            // Add user response to history
            await this.addConversationTurn(sessionId, 'response', userResponse);

            // Get current question
            const currentQuestion = session.currentQuestionSet[session.state.currentQuestionIndex];
            if (!currentQuestion) {
                // Try to recover by resetting to first question
                if (session.currentQuestionSet.length > 0) {
                    session.state.currentQuestionIndex = 0;
                    const recoveredQuestion = session.currentQuestionSet[0];
                    if (recoveredQuestion) {
                        // Continue with the first question
                        session.state.answeredQuestions.set(recoveredQuestion.id, userResponse);
                        
                        // Generate a simple response and move to next question
                        const agentMessage = `Thank you for that information. Let me ask you another question: ${recoveredQuestion.text}`;
                        
                        await this.addConversationTurn(sessionId, 'question', agentMessage);
                        
                        return {
                            agentMessage,
                            followupQuestions: [recoveredQuestion],
                            documentUpdates: [],
                            workflowSuggestions: [],
                            progressUpdate: this.progressTracker?.calculateProgress(sessionId),
                            conversationComplete: false
                        };
                    }
                }
                throw new ConversationError('No current question found', 'NO_CURRENT_QUESTION', sessionId);
            }

            // Process the response
            const analysis = this.responseProcessor?.analyzeResponse(userResponse, currentQuestion) || {
                extractedEntities: [],
                needsClarification: false,
                suggestedFollowups: []
            };
            
            // Store the response
            session.state.answeredQuestions.set(currentQuestion.id, userResponse);

            // Extract structured data if possible
            if (analysis.extractedEntities.length > 0) {
                for (const entity of analysis.extractedEntities) {
                    session.state.extractedData.set(entity.type, entity.value);
                }
            }

            // Update completion score
            session.state.completionScore = this.calculateCompletionScore(session.state);

            // Generate document updates if applicable
            const documentUpdates = await this.generateDocumentUpdates(session, userResponse, currentQuestion);

            // Generate follow-up questions
            const followupQuestions = this.questionEngine?.generateFollowupQuestions(
                session.agentName,
                userResponse,
                this.conversationHistory.get(sessionId) || []
            ) || [];

            // Determine next question or completion
            let nextQuestions: Question[] = [];
            let agentMessage = '';
            let workflowSuggestions: WorkflowSuggestion[] = [];

            if (analysis.needsClarification) {
                // Ask for clarification
                agentMessage = `I need some clarification on your response. ${analysis.suggestedFollowups.join(' ')}`;
                nextQuestions = this.generateClarificationQuestions(currentQuestion, analysis);
            } else if (followupQuestions.length > 0) {
                // Ask follow-up questions
                agentMessage = this.generateFollowupMessage(userResponse, followupQuestions);
                nextQuestions = followupQuestions;
            } else if (session.state.currentQuestionIndex < session.currentQuestionSet.length - 1) {
                // Move to next primary question
                session.state.currentQuestionIndex++;
                const nextQuestion = session.currentQuestionSet[session.state.currentQuestionIndex];
                agentMessage = `Great! Now, ${nextQuestion.text}`;
                nextQuestions = [nextQuestion];
            } else {
                // Check if conversation is complete
                const completionStatus = await this.evaluateConversationCompletion(session);
                if (completionStatus.readyForTransition) {
                    if (this.workflowOrchestrator) {
                        workflowSuggestions = [await this.workflowOrchestrator.suggestNextPhase(
                            session.state.phase,
                            completionStatus
                        )];
                    }
                    agentMessage = `Excellent! We've covered all the essential questions for the ${session.state.phase} phase. ${workflowSuggestions[0].reason}`;
                } else {
                    // Generate additional questions for incomplete areas
                    nextQuestions = this.generateCompletionQuestions(session, completionStatus);
                    agentMessage = `We're making great progress! Let me ask a few more questions to ensure we have everything we need.`;
                }
            }

            // Update session
            if (nextQuestions.length > 0) {
                session.currentQuestionSet = nextQuestions;
                // Reset index when we have new questions
                session.state.currentQuestionIndex = 0;
            }
            session.state.lastUpdated = new Date();
            session.lastActivity = new Date();

            // Update progress
            const progressUpdate = this.progressTracker?.calculateProgress(sessionId);

            // Add agent message to history
            await this.addConversationTurn(sessionId, 'question', agentMessage);

            const response: ConversationResponse = {
                agentMessage,
                followupQuestions: nextQuestions,
                documentUpdates,
                workflowSuggestions,
                progressUpdate,
                sessionId
            };

            return response;

        } catch (error) {
            throw new ConversationError(
                `Failed to continue conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CONTINUE_CONVERSATION_FAILED',
                sessionId,
                true
            );
        }
    }

    async endConversation(sessionId: string): Promise<ConversationSummary> {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new ConversationError('Session not found', 'SESSION_NOT_FOUND', sessionId);
            }

            // Mark session as inactive
            session.state.isActive = false;

            // Calculate final metrics
            const history = this.conversationHistory.get(sessionId) || [];
            const questionsAsked = history.filter(turn => turn.type === 'question').length;
            const questionsAnswered = session.state.answeredQuestions.size;
            const duration = Date.now() - session.createdAt.getTime();

            // Get updated documents
            const documentsUpdated = Array.from(session.state.extractedData.keys());

            // Create summary
            const summary: ConversationSummary = {
                sessionId,
                agentName: session.agentName,
                phase: session.state.phase,
                questionsAsked,
                questionsAnswered,
                documentsUpdated,
                completionScore: session.state.completionScore,
                duration,
                createdAt: session.createdAt,
                completedAt: new Date()
            };

            // Remove from active sessions
            this.activeSessionsByAgent.delete(session.agentName);

            // Add completion turn to history
            await this.addConversationTurn(sessionId, 'system', 
                `Conversation completed. Score: ${session.state.completionScore.toFixed(2)}, Duration: ${Math.round(duration / 1000)}s`);

            return summary;

        } catch (error) {
            throw new ConversationError(
                `Failed to end conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'END_CONVERSATION_FAILED',
                sessionId,
                true
            );
        }
    }

    getConversationHistory(sessionId: string): ConversationTurn[] {
        return this.conversationHistory.get(sessionId) || [];
    }

    getActiveSession(agentName: string): ConversationSession | null {
        const sessionId = this.activeSessionsByAgent.get(agentName);
        return sessionId ? this.sessions.get(sessionId) || null : null;
    }

    async pauseConversation(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.state.isActive = false;
            await this.addConversationTurn(sessionId, 'system', 'Conversation paused');
        }
    }

    async resumeConversation(sessionId: string): Promise<ConversationSession> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new ConversationError('Session not found', 'SESSION_NOT_FOUND', sessionId);
        }

        session.state.isActive = true;
        session.lastActivity = new Date();
        await this.addConversationTurn(sessionId, 'system', 'Conversation resumed');
        
        return session;
    }

    /**
     * Set command context for a conversation session
     */
    setCommandContext(sessionId: string, commandName: string, commandContext: any): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.state.initiatedByCommand = commandName;
            session.state.commandContext = commandContext;
        }
    }

    /**
     * Get conversation session by ID
     */
    getSession(sessionId: string): ConversationSession | null {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get active session ID for routing
     */
    getActiveSessionId(): string | null {
        // Find the most recently active session
        let mostRecentSession: ConversationSession | null = null;
        let mostRecentTime = 0;

        for (const session of this.sessions.values()) {
            if (session.state.isActive && session.lastActivity.getTime() > mostRecentTime) {
                mostRecentSession = session;
                mostRecentTime = session.lastActivity.getTime();
            }
        }

        return mostRecentSession?.sessionId || null;
    }

    /**
     * Check if a session is active and ready for input
     */
    isSessionActive(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        return session?.state.isActive || false;
    }

    /**
     * Handle user input for active session
     */
    async handleUserInput(
        sessionId: string,
        input: string,
        context: any
    ): Promise<ConversationResponse> {
        try {
            this.log(`Handling user input for session ${sessionId}`, 'info');
            
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new ConversationError('Session not found', 'SESSION_NOT_FOUND', sessionId);
            }

            if (!session.state.isActive) {
                throw new ConversationError('Session is not active', 'SESSION_INACTIVE', sessionId);
            }

            // Continue the conversation with the user input
            const response = await this.continueConversation(sessionId, input);
            
            this.log(`User input processed for session ${sessionId}`, 'info');
            
            return response;

        } catch (error) {
            this.log(`Failed to handle user input for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }

    private generateSessionId(): string {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async addConversationTurn(sessionId: string, type: 'question' | 'response' | 'system', content: string): Promise<void> {
        const turn: ConversationTurn = {
            id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId,
            timestamp: new Date(),
            type,
            content,
            metadata: {}
        };

        const history = this.conversationHistory.get(sessionId) || [];
        history.push(turn);
        this.conversationHistory.set(sessionId, history);
    }

    private calculateCompletionScore(state: ConversationState): number {
        const totalQuestions = state.answeredQuestions.size;
        const requiredQuestions = Math.max(3, totalQuestions); // Minimum 3 questions
        const completionRatio = Math.min(totalQuestions / requiredQuestions, 1);
        
        // Factor in data extraction success
        const dataExtractionScore = state.extractedData.size > 0 ? 0.2 : 0;
        
        return Math.min(completionRatio * 0.8 + dataExtractionScore, 1);
    }

    private async generateDocumentUpdates(session: ConversationSession, userResponse: string, question: Question): Promise<any[]> {
        try {
            // Extract meaningful content from user response
            const extractedContent = this.extractContentFromResponse(userResponse, question, session);
            
            if (!extractedContent) {
                return [];
            }
            
            // Generate document update based on agent type and question category
            const documentUpdate: DocumentUpdate = {
                section: this.mapQuestionToSection(question, session.agentName),
                content: extractedContent,
                updateType: 'append',
                timestamp: new Date(),
                confidence: 0.8
            };
            
            this.log(`Generated document update for ${session.agentName}: ${documentUpdate.section}`, 'info');
            
            return [documentUpdate];
            
        } catch (error) {
            this.log(`Error generating document updates: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            return [];
        }
    }

    /**
     * Extract meaningful content from user response
     */
    private extractContentFromResponse(userResponse: string, question: Question, session: ConversationSession): string | null {
        // Clean and format the user response
        const cleanResponse = userResponse.trim();
        
        if (cleanResponse.length < 10) {
            return null; // Too short to be meaningful
        }
        
        // Format based on question type and agent
        switch (session.agentName) {
            case 'prd-creator':
                return this.formatPRDContent(cleanResponse, question);
            case 'requirements-gatherer':
                return this.formatRequirementsContent(cleanResponse, question);
            case 'solution-architect':
                return this.formatArchitectureContent(cleanResponse, question);
            case 'specification-writer':
                return this.formatSpecificationContent(cleanResponse, question);
            default:
                return `**${question.category || 'Response'}:** ${cleanResponse}\n\n`;
        }
    }

    /**
     * Map question to document section
     */
    private mapQuestionToSection(question: Question, agentName: string): string {
        const sectionMaps: Record<string, Record<string, string>> = {
            'prd-creator': {
                'problem': 'Problem Statement',
                'solution': 'Solution Overview',
                'users': 'User Personas',
                'goals': 'Product Objectives',
                'success': 'Success Metrics',
                'constraints': 'Constraints',
                'default': 'Product Details'
            },
            'requirements-gatherer': {
                'user-story': 'User Stories',
                'acceptance': 'Acceptance Criteria',
                'functional': 'Functional Requirements',
                'non-functional': 'Non-Functional Requirements',
                'default': 'Requirements'
            },
            'solution-architect': {
                'architecture': 'System Architecture',
                'components': 'Components',
                'data': 'Data Models',
                'integration': 'Integrations',
                'default': 'Technical Design'
            },
            'specification-writer': {
                'tasks': 'Implementation Tasks',
                'timeline': 'Timeline',
                'resources': 'Resource Planning',
                'dependencies': 'Dependencies',
                'default': 'Implementation Plan'
            }
        };
        
        const agentMap = sectionMaps[agentName] || sectionMaps['prd-creator'];
        return agentMap[question.category] || agentMap['default'];
    }

    /**
     * Format content for PRD documents
     */
    private formatPRDContent(response: string, question: Question): string {
        switch (question.category) {
            case 'problem':
                return `### Problem Statement\n\n${response}\n\n`;
            case 'solution':
                return `### Solution Overview\n\n${response}\n\n`;
            case 'users':
                return `### Target Users\n\n${response}\n\n`;
            case 'goals':
                return `### Objectives\n\n${response}\n\n`;
            default:
                return `### ${question.category || 'Details'}\n\n${response}\n\n`;
        }
    }

    /**
     * Format content for requirements documents
     */
    private formatRequirementsContent(response: string, question: Question): string {
        switch (question.category) {
            case 'user-story':
                return `**User Story:** ${response}\n\n`;
            case 'acceptance':
                return `**Acceptance Criteria:**\n${response}\n\n`;
            default:
                return `**${question.category || 'Requirement'}:** ${response}\n\n`;
        }
    }

    /**
     * Format content for architecture documents
     */
    private formatArchitectureContent(response: string, question: Question): string {
        switch (question.category) {
            case 'architecture':
                return `## Architecture Overview\n\n${response}\n\n`;
            case 'components':
                return `## Components\n\n${response}\n\n`;
            default:
                return `## ${question.category || 'Technical Details'}\n\n${response}\n\n`;
        }
    }

    /**
     * Format content for specification documents
     */
    private formatSpecificationContent(response: string, question: Question): string {
        switch (question.category) {
            case 'tasks':
                return `### Implementation Tasks\n\n${response}\n\n`;
            case 'timeline':
                return `### Timeline\n\n${response}\n\n`;
            default:
                return `### ${question.category || 'Implementation Details'}\n\n${response}\n\n`;
        }
    }

    /**
     * Log conversation manager activity
     */
    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ConversationManager] [${level.toUpperCase()}] ${message}`);
    }

    private generateFollowupMessage(userResponse: string, followupQuestions: Question[]): string {
        const responses = [
            `That's helpful! Let me dig a bit deeper.`,
            `Great insight! I'd like to explore this further.`,
            `Interesting! Let me ask a follow-up question.`,
            `Thanks for that detail. Let me understand more about this.`
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        return `${randomResponse} ${followupQuestions[0]?.text || ''}`;
    }

    private generateClarificationQuestions(originalQuestion: Question, analysis: any): Question[] {
        return [{
            id: `clarify_${originalQuestion.id}_${Date.now()}`,
            text: `Could you provide more specific details about ${originalQuestion.category}? ${analysis.suggestedFollowups[0] || ''}`,
            type: 'open-ended' as const,
            examples: originalQuestion.examples,
            required: true,
            followupTriggers: [],
            category: originalQuestion.category,
            priority: 1
        }];
    }

    private async evaluateConversationCompletion(session: ConversationSession): Promise<any> {
        // This would integrate with WorkflowOrchestrator
        // For now, return a simple completion status
        return {
            readyForTransition: session.state.completionScore >= 0.7,
            completionPercentage: session.state.completionScore * 100,
            missingSections: []
        };
    }

    private generateCompletionQuestions(session: ConversationSession, completionStatus: any): Question[] {
        // Generate questions for incomplete areas
        return [{
            id: `completion_${Date.now()}`,
            text: "Is there anything else you'd like to add or clarify about this topic?",
            type: 'open-ended' as const,
            examples: [],
            required: false,
            followupTriggers: [],
            category: 'completion',
            priority: 1
        }];
    }

    private async getRequiredSections(context: ConversationContext): Promise<string[]> {
        // This would be determined based on document type and phase
        const sectionMap: Record<string, string[]> = {
            'prd': ['Executive Summary', 'Product Objectives', 'User Personas', 'Functional Requirements'],
            'requirements': ['Introduction', 'Requirements', 'Non-Functional Requirements'],
            'design': ['Overview', 'Architecture', 'Components', 'Data Models']
        };
        
        return sectionMap[context.documentType] || ['Introduction', 'Main Content', 'Conclusion'];
    }

    private estimateSessionDuration(questionCount: number): string {
        const minutesPerQuestion = 2;
        const totalMinutes = questionCount * minutesPerQuestion;
        
        if (totalMinutes < 60) {
            return `${totalMinutes} minutes`;
        } else {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}h ${minutes}m`;
        }
    }

    // ===== CONSOLIDATED FEEDBACK MANAGEMENT METHODS =====

    /**
     * Provide feedback when a conversation is successfully started from a command
     */
    async provideConversationStartedFeedback(
        commandResult: CommandResult,
        options: FeedbackOptions = {}
    ): Promise<void> {
        try {
            const config = commandResult.conversationConfig;
            if (!config) {
                return;
            }

            // Register conversation feedback with output coordinator
            const feedbackContent = this.buildConversationStartedContent(config, options);
            this.outputCoordinator.addSecondaryFeedback('conversation-started', {
                type: 'conversation',
                content: feedbackContent,
                priority: 2
            });

            this.logger.info('conversation', 'Registered conversation started feedback', {
                agentName: config.agentName,
                documentPath: config.documentPath
            });

        } catch (error) {
            this.logger.error('conversation', 'Failed to provide conversation started feedback', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Provide feedback when a conversation fails to start
     */
    async provideConversationFailedFeedback(
        commandResult: CommandResult,
        error: Error,
        options: FeedbackOptions = {}
    ): Promise<void> {
        try {
            // Register conversation failure feedback with output coordinator
            const feedbackContent = this.buildConversationFailedContent(error, commandResult, options);
            this.outputCoordinator.addSecondaryFeedback('conversation-failed', {
                type: 'warning',
                content: feedbackContent,
                priority: 1 // High priority for errors
            });

            this.logger.info('conversation', 'Registered conversation failed feedback', {
                error: error.message,
                documentPath: commandResult.conversationConfig?.documentPath
            });

        } catch (feedbackError) {
            this.logger.error('conversation', 'Failed to provide conversation failed feedback', feedbackError instanceof Error ? feedbackError : new Error(String(feedbackError)));
        }
    }

    /**
     * Provide feedback about current conversation state
     */
    async provideConversationStateFeedback(
        stateInfo: ConversationStateInfo,
        options: FeedbackOptions = {}
    ): Promise<void> {
        try {
            // Register conversation state feedback with output coordinator
            const feedbackContent = this.buildConversationStateContent(stateInfo, options);
            this.outputCoordinator.addSecondaryFeedback('conversation-state', {
                type: 'conversation',
                content: feedbackContent,
                priority: 3
            });

            this.logger.info('conversation', 'Registered conversation state feedback', {
                isActive: stateInfo.isActive,
                agentName: stateInfo.agentName
            });

        } catch (error) {
            this.logger.error('conversation', 'Failed to provide conversation state feedback', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Provide guidance for continuing an existing conversation
     */
    async provideContinuationGuidance(conversationContext: any): Promise<void> {
        try {
            let content = '🔄 **Continuing conversation...**\n\n';
            
            if (conversationContext.lastQuestion) {
                content += `**Previous question:** ${conversationContext.lastQuestion}\n\n`;
            }

            content += '💬 **How to continue:**\n';
            content += '- Answer any pending questions\n';
            content += '- Ask for clarification if needed\n';
            content += '- Provide additional details or context\n';
            content += '- Type "done" when you\'re satisfied with the document\n';

            this.outputCoordinator.addSecondaryFeedback('conversation-continuation', {
                type: 'guidance',
                content,
                priority: 4
            });

        } catch (error) {
            this.logger.error('conversation', 'Failed to provide continuation guidance', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Provide feedback when conversation is completed
     */
    async provideConversationCompletedFeedback(documentPath: string): Promise<void> {
        try {
            const content = `✅ **Conversation completed successfully!**

📄 **Document updated:** \`${documentPath}\`

🎉 **What you can do next:**
- Review and edit the generated content
- Use \`/review\` to get feedback on the document
- Use \`/update\` to make specific changes
- Share the document with your team`;

            this.outputCoordinator.addSecondaryFeedback('conversation-completed', {
                type: 'conversation',
                content,
                priority: 1
            });

        } catch (error) {
            this.logger.error('conversation', 'Failed to provide conversation completed feedback', error instanceof Error ? error : new Error(String(error)));
        }
    }

    // ===== CONSOLIDATED RECOVERY MANAGEMENT METHODS =====

    /**
     * Recover from conversation failure
     */
    async recoverFromFailure(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        this.logger.error('conversation', 'Attempting conversation recovery', error);

        try {
            switch (error.code) {
                case 'START_CONVERSATION_FAILED':
                    return await this.recoverFromStartFailure(error, context);
                
                case 'CONTINUE_CONVERSATION_FAILED':
                    return await this.recoverFromContinueFailure(error, context);
                
                case 'SESSION_NOT_FOUND':
                    return await this.recoverFromSessionLoss(error, context);
                
                case 'SESSION_INACTIVE':
                    return await this.recoverFromInactiveSession(error, context);
                
                case 'NO_CURRENT_QUESTION':
                    return await this.recoverFromQuestionError(error, context);
                
                default:
                    return await this.recoverFromGenericError(error, context);
            }
        } catch (recoveryError) {
            this.logger.error('conversation', 'Recovery attempt failed', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
            
            return {
                success: false,
                message: 'Recovery failed. Please try manual conversation restart.',
                fallbackOptions: [
                    'Use `/agent list` to see available agents',
                    'Use `/agent set <agent-name>` to set an agent',
                    'Use `/chat <message>` to start a new conversation',
                    'Use `/help` for more assistance'
                ]
            };
        }
    }

    /**
     * Provide fallback options when conversation initiation fails
     */
    async provideFallbackOptions(
        failedConfig: ConversationConfig,
        context: CommandContext
    ): Promise<void> {
        this.logger.info('conversation', 'Providing fallback options for failed conversation', {
            agentName: failedConfig.agentName,
            templateId: failedConfig.templateId
        });

        context.stream.markdown('❌ **Conversation failed to start automatically.**\n\n');
        context.stream.markdown('**What you can try:**\n\n');

        // Check if we're in offline mode
        if (this.offlineManager?.isOffline()) {
            await this.provideOfflineFallback(failedConfig, context);
        } else {
            await this.provideOnlineFallback(failedConfig, context);
        }

        // Always provide manual options
        context.stream.markdown('\n**Manual Options:**\n');
        context.stream.markdown(`- \`/agent set ${failedConfig.agentName}\` - Set the agent manually\n`);
        context.stream.markdown('- `/chat <your message>` - Start a conversation manually\n');
        context.stream.markdown('- `/agent list` - See all available agents\n');
        context.stream.markdown('- `/help` - Get more help\n\n');

        context.stream.markdown('💡 **Tip:** You can continue working on your document and try the conversation later!\n');
    }

    // ===== CONSOLIDATED CONTINUATION MANAGEMENT METHODS =====

    /**
     * Initiate conversation after command execution
     */
    async initiatePostCommandConversation(
        commandResult: CommandResult,
        conversationConfig: ConversationConfig,
        context: CommandContext
    ): Promise<ConversationInitiationResult> {
        try {
            this.logger.info('conversation', 'Initiating post-command conversation', {
                agentName: conversationConfig.agentName,
                templateId: conversationConfig.templateId,
                documentPath: conversationConfig.documentPath
            });

            // Set the active agent
            this.agentManager?.setCurrentAgent(conversationConfig.agentName);

            // Start the conversation session
            const session = await this.startConversation(
                conversationConfig.agentName,
                conversationConfig.conversationContext
            );

            this.logger.info('conversation', 'Conversation session started', {
                sessionId: session.sessionId,
                agentName: conversationConfig.agentName
            });

            return {
                success: true,
                sessionId: session.sessionId
            };

        } catch (error) {
            this.logger.error('conversation', 'Failed to initiate post-command conversation', error instanceof Error ? error : new Error(String(error)));
            
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                fallbackOptions: [
                    'Try setting an agent manually with `/agent set <agent-name>`',
                    'Use `/chat <message>` to start a conversation',
                    'Check if the agent is available with `/agent list`'
                ]
            };
        }
    }

    /**
     * Check if a command should continue with conversation
     */
    shouldContinueWithConversation(
        commandName: string,
        flags: Record<string, any>,
        templateId?: string
    ): boolean {
        // Handle null or undefined flags
        if (!flags) {
            flags = {};
        }
        
        // Check for explicit conversation flags
        if (flags['with-conversation'] || flags['wc']) {
            return true;
        }
        
        // Check for explicit no-conversation flags
        if (flags['no-conversation'] || flags['nc']) {
            return false;
        }
        
        // Auto-start for structured templates with placeholders
        if (flags['with-placeholders'] || flags['wp']) {
            return true;
        }
        
        // Check command-specific mappings
        const mapping = this.commandMappings.get(commandName);
        if (mapping && templateId) {
            const templateMapping = mapping.templateMappings[templateId];
            if (templateMapping) {
                return templateMapping.autoStart;
            }
        }
        
        // Auto-start for specific templates that benefit from conversations
        const conversationTemplates = ['prd', 'requirements', 'design', 'specification'];
        if (templateId && conversationTemplates.includes(templateId)) {
            return true;
        }
        
        // Default to no conversation for basic templates
        return false;
    }

    /**
     * Get conversation configuration for a command/template combination
     */
    getConversationConfig(
        commandName: string,
        templateId?: string
    ): ConversationConfig | null {
        const mapping = this.commandMappings.get(commandName);
        if (!mapping) {
            return null;
        }

        let agentName: string;
        let questions: Question[] = [];

        if (templateId && mapping.templateMappings[templateId]) {
            const templateMapping = mapping.templateMappings[templateId];
            agentName = templateMapping.agentName;
            questions = templateMapping.questions;
        } else if (mapping.defaultAgent) {
            agentName = mapping.defaultAgent;
        } else {
            return null;
        }

        // This will be populated by the calling code with specific values
        return {
            agentName,
            templateId: templateId || 'basic',
            documentPath: '', // Will be set by caller
            title: '', // Will be set by caller
            initialQuestions: questions,
            conversationContext: {
                documentType: templateId || 'basic',
                workflowPhase: this.getWorkflowPhaseForTemplate(templateId),
                documentPath: '', // Will be set by caller
                title: '', // Will be set by caller
                workspaceRoot: '', // Will be set by caller
                extensionContext: null as any // Will be set by caller
            }
        };
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Build conversation started feedback content
     */
    private buildConversationStartedContent(config: ConversationConfig, options: FeedbackOptions): string {
        let content = '🤖 **Starting AI Conversation**\n';
        content += `**Agent:** ${AgentUtils.getAgentDisplayName(config.agentName)}\n`;
        content += `**Document:** ${config.title || 'New Document'}\n`;
        
        if (config.documentPath) {
            content += `**Path:** \`${config.documentPath}\`\n`;
        }

        content += '\n💬 **What happens next:**\n';
        content += '- The AI agent will ask you questions to gather requirements\n';
        content += '- Answer the questions to help create better documentation\n';
        content += '- You can ask for clarification or provide additional details\n';

        if (options.showConversationTips) {
            content += this.buildConversationTipsContent(config);
        }

        if (options.includeNextSteps && config.initialQuestions?.length) {
            content += '\n📋 **Initial questions to expect:**\n';
            const firstFewQuestions = config.initialQuestions.slice(0, 3);
            firstFewQuestions.forEach((question, index) => {
                content += `${index + 1}. ${question.text}\n`;
            });
            
            if (config.initialQuestions.length > 3) {
                content += `... and ${config.initialQuestions.length - 3} more questions\n`;
            }
        }

        return content;
    }

    /**
     * Build conversation failed feedback content
     */
    private buildConversationFailedContent(error: Error, commandResult: CommandResult, options: FeedbackOptions): string {
        let content = '⚠️ **Command completed, but conversation could not start**\n\n';
        content += '📄 **Your document was created/updated successfully**, but the AI conversation feature encountered an issue.\n\n';

        content += '❌ **Issue:** ';
        if (error.message.includes('network') || error.message.includes('timeout')) {
            content += 'Network connectivity issue\n';
        } else if (error.message.includes('auth') || error.message.includes('unauthorized')) {
            content += 'Authentication issue with GitHub Copilot\n';
        } else if (error.message.includes('rate limit')) {
            content += 'Rate limit exceeded\n';
        } else {
            content += `${error.message}\n`;
        }

        if (options.includeRecoveryOptions) {
            content += this.buildRecoveryOptionsContent(error, commandResult);
        }

        content += '\n🔧 **You can still work on your document manually:**\n';
        content += '- Open the document and edit it directly\n';
        content += '- Use other Docu commands to help with specific sections\n';
        content += '- Try starting a conversation later with `/chat`\n';

        return content;
    }

    /**
     * Build conversation state feedback content
     */
    private buildConversationStateContent(stateInfo: ConversationStateInfo, options: FeedbackOptions): string {
        let content = '';

        if (stateInfo.isActive) {
            content += '💬 **Active Conversation**\n';
            if (stateInfo.agentName) {
                content += `**Agent:** ${AgentUtils.getAgentDisplayName(stateInfo.agentName)}\n`;
            }
            if (stateInfo.documentPath) {
                content += `**Document:** \`${stateInfo.documentPath}\`\n`;
            }
            if (stateInfo.phase) {
                content += `**Phase:** ${stateInfo.phase}\n`;
            }

            if (options.showProgressIndicator) {
                content += '\n📊 **Progress:** Gathering requirements and feedback\n';
            }

            if (stateInfo.nextSteps?.length) {
                content += '\n📋 **Next steps:**\n';
                stateInfo.nextSteps.forEach((step, index) => {
                    content += `${index + 1}. ${step}\n`;
                });
            }
        } else {
            content += '💤 **No active conversation**\n';
            content += 'Start a conversation with a command like `/new` or `/chat`\n';
        }

        return content;
    }

    /**
     * Build conversation tips content
     */
    private buildConversationTipsContent(config: ConversationConfig): string {
        let content = '\n💡 **Conversation Tips:**\n';
        
        switch (config.agentName) {
            case 'prd-creator':
                content += '- Focus on the product vision and user needs\n';
                content += '- Describe the problem you\'re solving\n';
                content += '- Think about your target users and their goals\n';
                break;
            case 'requirements-gatherer':
                content += '- Be specific about functional requirements\n';
                content += '- Consider edge cases and error scenarios\n';
                content += '- Think about performance and security needs\n';
                break;
            case 'solution-architect':
                content += '- Describe your technical constraints\n';
                content += '- Consider scalability and maintainability\n';
                content += '- Think about integration points\n';
                break;
            case 'quality-reviewer':
                content += '- Be open to feedback and suggestions\n';
                content += '- Ask questions if something is unclear\n';
                content += '- Consider different perspectives\n';
                break;
            default:
                content += '- Provide detailed and specific answers\n';
                content += '- Ask for clarification if needed\n';
                content += '- Share relevant context and constraints\n';
        }

        return content;
    }

    /**
     * Build recovery options content
     */
    private buildRecoveryOptionsContent(error: Error, commandResult: CommandResult): string {
        let content = '\n🔄 **Recovery Options:**\n';

        if (error.message.includes('network') || error.message.includes('timeout')) {
            content += '- Check your internet connection\n';
            content += '- Try again in a few moments\n';
            content += '- Use `/chat` to start a conversation manually\n';
        } else if (error.message.includes('auth') || error.message.includes('unauthorized')) {
            content += '- Sign in to GitHub Copilot\n';
            content += '- Check your Copilot subscription status\n';
            content += '- Restart VS Code and try again\n';
        } else if (error.message.includes('rate limit')) {
            content += '- Wait a few minutes before trying again\n';
            content += '- Use manual editing for now\n';
            content += '- Try again during off-peak hours\n';
        } else {
            content += '- Try restarting VS Code\n';
            content += '- Check the VS Code output panel for more details\n';
            content += '- Use `/chat` to start a conversation manually\n';
        }

        if (commandResult.conversationConfig) {
            content += `- Use \`/agent set ${commandResult.conversationConfig.agentName}\` to set the agent manually\n`;
        }

        return content;
    }

    /**
     * Recover from conversation start failure
     */
    private async recoverFromStartFailure(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        // Try to set the agent manually and provide guidance
        const fallbackOptions = [
            'Try setting the agent manually with `/agent set <agent-name>`',
            'Check available agents with `/agent list`',
            'Use `/chat <message>` to start a conversation',
            'Verify that AI services are available'
        ];

        // Check if it's an offline issue
        if (this.offlineManager?.isOffline()) {
            fallbackOptions.unshift('AI services are currently offline - try again when online');
        }

        return {
            success: false,
            message: `Failed to start conversation: ${error.message}`,
            fallbackOptions,
            recoveryAction: 'manual_agent_setup'
        };
    }

    /**
     * Recover from conversation continue failure
     */
    private async recoverFromContinueFailure(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        const fallbackOptions = [
            'Try rephrasing your response',
            'Use `/agent current` to check the active agent',
            'Start a new conversation with `/chat <message>`',
            'Check if your response is clear and complete'
        ];

        return {
            success: false,
            message: `Failed to continue conversation: ${error.message}`,
            fallbackOptions,
            recoveryAction: 'retry_response'
        };
    }

    /**
     * Recover from session loss
     */
    private async recoverFromSessionLoss(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        const fallbackOptions = [
            'Start a new conversation with `/chat <message>`',
            'Set an agent with `/agent set <agent-name>`',
            'Check active sessions with `/agent current`',
            'Your previous conversation data may be lost'
        ];

        return {
            success: false,
            message: 'Conversation session was lost or expired',
            fallbackOptions,
            recoveryAction: 'new_conversation'
        };
    }

    /**
     * Recover from inactive session
     */
    private async recoverFromInactiveSession(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        const fallbackOptions = [
            'Start a new conversation with `/chat <message>`',
            'The previous conversation may have timed out',
            'Set an agent with `/agent set <agent-name>`'
        ];

        return {
            success: false,
            message: 'Conversation session is no longer active',
            fallbackOptions,
            recoveryAction: 'new_conversation'
        };
    }

    /**
     * Recover from question error
     */
    private async recoverFromQuestionError(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        const fallbackOptions = [
            'Try asking a direct question with `/chat <your question>`',
            'Start a new conversation flow',
            'Check if the agent is properly configured'
        ];

        return {
            success: false,
            message: 'No current question available in conversation',
            fallbackOptions,
            recoveryAction: 'direct_chat'
        };
    }

    /**
     * Recover from generic error
     */
    private async recoverFromGenericError(
        error: ConversationError,
        context: CommandContext
    ): Promise<RecoveryResult> {
        const fallbackOptions = [
            'Try restarting the conversation with `/chat <message>`',
            'Check if AI services are available',
            'Use `/agent list` to see available agents',
            'Contact support if the issue persists'
        ];

        return {
            success: false,
            message: `Conversation error: ${error.message}`,
            fallbackOptions,
            recoveryAction: 'manual_restart'
        };
    }

    /**
     * Provide offline fallback options
     */
    private async provideOfflineFallback(
        failedConfig: ConversationConfig,
        context: CommandContext
    ): Promise<void> {
        context.stream.markdown('⚠️ **AI services are currently offline.**\n\n');
        context.stream.markdown('**Offline Options:**\n');
        context.stream.markdown('- Continue working on your document manually\n');
        context.stream.markdown('- Use the document template as a guide\n');
        context.stream.markdown('- Try the conversation again when AI services return\n');
        context.stream.markdown('- Check your internet connection\n\n');

        // Provide template-specific guidance
        const templateGuidance = this.getTemplateGuidance(failedConfig.templateId);
        if (templateGuidance) {
            context.stream.markdown('**Document Structure Guidance:**\n');
            context.stream.markdown(templateGuidance + '\n');
        }
    }

    /**
     * Provide online fallback options
     */
    private async provideOnlineFallback(
        failedConfig: ConversationConfig,
        context: CommandContext
    ): Promise<void> {
        context.stream.markdown('🔧 **AI services are available but conversation failed to start.**\n\n');
        context.stream.markdown('**Troubleshooting Steps:**\n');
        context.stream.markdown('1. Check if the agent is available\n');
        context.stream.markdown('2. Try a different agent if needed\n');
        context.stream.markdown('3. Restart VS Code if issues persist\n');
        context.stream.markdown('4. Check extension logs for details\n\n');

        // Try to set the agent anyway
        try {
            this.agentManager?.setCurrentAgent(failedConfig.agentName);
            context.stream.markdown(`✅ **${failedConfig.agentName} agent is now active** for manual conversation.\n`);
        } catch (agentError) {
            context.stream.markdown(`❌ **Failed to set ${failedConfig.agentName} agent.** Try selecting a different agent.\n`);
        }
    }

    /**
     * Get template-specific guidance for offline mode
     */
    private getTemplateGuidance(templateId: string): string | null {
        const guidanceMap: Record<string, string> = {
            'prd': `
- **Executive Summary**: Brief product overview
- **Problem Statement**: What problem does this solve?
- **Target Users**: Who will use this product?
- **Goals & Success Metrics**: How will you measure success?
- **Functional Requirements**: What features are needed?
- **Non-Functional Requirements**: Performance, security, etc.`,

            'requirements': `
- **Introduction**: Project overview and scope
- **User Stories**: As a [user], I want [feature] so that [benefit]
- **Functional Requirements**: Specific system behaviors
- **Non-Functional Requirements**: Performance, security, usability
- **Acceptance Criteria**: How to verify requirements`,

            'design': `
- **System Architecture**: High-level system structure
- **Components**: Major system components
- **Data Models**: Key data structures
- **APIs**: Interface definitions
- **Security Considerations**: Authentication, authorization`,

            'specification': `
- **Implementation Tasks**: Detailed development tasks
- **Timeline**: Project schedule and milestones
- **Resource Requirements**: Team, tools, infrastructure
- **Dependencies**: Task dependencies
- **Testing Strategy**: Validation approach`
        };

        return guidanceMap[templateId] || null;
    }

    /**
     * Initialize command-to-conversation mappings
     */
    private initializeCommandMappings(): void {
        // New command mappings
        this.commandMappings.set('new', {
            commandName: 'new',
            templateMappings: {
                'prd': {
                    agentName: 'prd-creator',
                    autoStart: true,
                    questions: this.getPRDQuestions()
                },
                'requirements': {
                    agentName: 'requirements-gatherer',
                    autoStart: true,
                    questions: this.getRequirementsQuestions()
                },
                'design': {
                    agentName: 'solution-architect',
                    autoStart: true,
                    questions: this.getDesignQuestions()
                },
                'specification': {
                    agentName: 'specification-writer',
                    autoStart: true,
                    questions: this.getSpecificationQuestions()
                }
            },
            defaultAgent: 'prd-creator',
            conversationFlags: ['with-conversation', 'wc', 'no-conversation', 'nc']
        });

        // Update command mappings
        this.commandMappings.set('update', {
            commandName: 'update',
            templateMappings: {},
            defaultAgent: 'quality-reviewer',
            conversationFlags: ['with-conversation', 'wc', 'no-conversation', 'nc']
        });

        // Review command mappings
        this.commandMappings.set('review', {
            commandName: 'review',
            templateMappings: {},
            defaultAgent: 'quality-reviewer',
            conversationFlags: ['with-conversation', 'wc', 'no-conversation', 'nc']
        });
    }

    /**
     * Get workflow phase for template
     */
    private getWorkflowPhaseForTemplate(templateId?: string): string {
        const phaseMap: Record<string, string> = {
            'prd': 'planning',
            'requirements': 'requirements',
            'design': 'design',
            'specification': 'implementation',
            'basic': 'planning'
        };
        
        return phaseMap[templateId || 'basic'] || 'planning';
    }

    /**
     * Get PRD-specific questions
     */
    private getPRDQuestions(): Question[] {
        return [
            {
                id: 'prd_problem',
                text: 'What problem does this product solve?',
                type: 'open-ended',
                examples: [
                    'Users struggle to manage their card collections efficiently',
                    'Current solutions are too complex for casual collectors'
                ],
                required: true,
                followupTriggers: ['problem', 'issue', 'challenge'],
                category: 'problem',
                priority: 1
            },
            {
                id: 'prd_users',
                text: 'Who are the target users for this product?',
                type: 'open-ended',
                examples: [
                    'Card game enthusiasts and collectors',
                    'Small business owners selling trading cards'
                ],
                required: true,
                followupTriggers: ['users', 'customers', 'audience'],
                category: 'users',
                priority: 2
            },
            {
                id: 'prd_goals',
                text: 'What are the main goals and success criteria?',
                type: 'open-ended',
                examples: [
                    'Increase user engagement by 50%',
                    'Reduce time to complete tasks by 30%'
                ],
                required: true,
                followupTriggers: ['goals', 'objectives', 'success'],
                category: 'goals',
                priority: 3
            }
        ];
    }

    /**
     * Get requirements-specific questions
     */
    private getRequirementsQuestions(): Question[] {
        return [
            {
                id: 'req_functional',
                text: 'What are the key functional requirements?',
                type: 'open-ended',
                examples: [
                    'User authentication and authorization',
                    'Inventory management system'
                ],
                required: true,
                followupTriggers: ['functional', 'features', 'capabilities'],
                category: 'functional',
                priority: 1
            },
            {
                id: 'req_nonfunctional',
                text: 'What are the non-functional requirements (performance, security, etc.)?',
                type: 'open-ended',
                examples: [
                    'System must handle 1000 concurrent users',
                    'Response time under 200ms'
                ],
                required: true,
                followupTriggers: ['performance', 'security', 'scalability'],
                category: 'non-functional',
                priority: 2
            }
        ];
    }

    /**
     * Get design-specific questions
     */
    private getDesignQuestions(): Question[] {
        return [
            {
                id: 'design_architecture',
                text: 'What is the overall system architecture?',
                type: 'open-ended',
                examples: [
                    'Microservices with API gateway',
                    'Monolithic web application'
                ],
                required: true,
                followupTriggers: ['architecture', 'system', 'structure'],
                category: 'architecture',
                priority: 1
            },
            {
                id: 'design_components',
                text: 'What are the main system components?',
                type: 'open-ended',
                examples: [
                    'User service, inventory service, payment service',
                    'Frontend, backend API, database'
                ],
                required: true,
                followupTriggers: ['components', 'modules', 'services'],
                category: 'components',
                priority: 2
            }
        ];
    }

    /**
     * Get specification-specific questions
     */
    private getSpecificationQuestions(): Question[] {
        return [
            {
                id: 'spec_tasks',
                text: 'What are the main implementation tasks?',
                type: 'open-ended',
                examples: [
                    'Set up database schema',
                    'Implement user authentication'
                ],
                required: true,
                followupTriggers: ['tasks', 'implementation', 'development'],
                category: 'tasks',
                priority: 1
            },
            {
                id: 'spec_timeline',
                text: 'What is the expected timeline?',
                type: 'open-ended',
                examples: [
                    '2 weeks for MVP',
                    '3 months for full implementation'
                ],
                required: true,
                followupTriggers: ['timeline', 'schedule', 'deadline'],
                category: 'timeline',
                priority: 2
            }
        ];
    }
}