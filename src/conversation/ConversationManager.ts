// ConversationManager implementation
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
    ProgressTracker
} from './types';

export class ConversationManager implements IConversationManager {
    private sessions: Map<string, ConversationSession> = new Map();
    private conversationHistory: Map<string, ConversationTurn[]> = new Map();
    private activeSessionsByAgent: Map<string, string> = new Map();

    constructor(
        private questionEngine: QuestionEngine,
        private responseProcessor: ResponseProcessor,
        private contentCapture: ContentCapture,
        private workflowOrchestrator: WorkflowOrchestrator,
        private progressTracker: ProgressTracker,
        private extensionContext: vscode.ExtensionContext
    ) {}

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
            const initialQuestions = this.questionEngine.generateInitialQuestions(agentName, context);
            
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
                lastUpdated: new Date()
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
            this.progressTracker.updateProgress(sessionId, {
                currentPhase: context.workflowPhase,
                completionPercentage: 0,
                completedSections: [],
                pendingSections: await this.getRequiredSections(context),
                nextSteps: initialQuestions.slice(0, 3).map(q => q.text),
                estimatedTimeRemaining: this.estimateSessionDuration(initialQuestions.length)
            });

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
                            progressUpdate: this.progressTracker.calculateProgress(sessionId),
                            conversationComplete: false
                        };
                    }
                }
                throw new ConversationError('No current question found', 'NO_CURRENT_QUESTION', sessionId);
            }

            // Process the response
            const analysis = this.responseProcessor.analyzeResponse(userResponse, currentQuestion);
            
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
            const followupQuestions = this.questionEngine.generateFollowupQuestions(
                session.agentName,
                userResponse,
                this.conversationHistory.get(sessionId) || []
            );

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
                    workflowSuggestions = [await this.workflowOrchestrator.suggestNextPhase(
                        session.state.phase,
                        completionStatus
                    )];
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
            const progressUpdate = this.progressTracker.calculateProgress(sessionId);

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
        // This would integrate with ContentCapture to generate actual document updates
        // For now, return empty array - will be implemented in ContentCapture task
        return [];
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
}