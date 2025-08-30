import * as vscode from 'vscode';
import { CommandContext, ConversationConfig } from '../commands/types';
import { ConversationManager } from './ConversationManager';
import { AgentManager } from '../agents/AgentManager';
import { OfflineManager } from '../offline/OfflineManager';
import { ConversationSessionRouter } from './ConversationSessionRouter';
import { Logger } from '../logging';

/**
 * Handles unified conversation flow starting and continuation
 */
export class ConversationFlowHandler {
    private logger: Logger;
    private sessionRouter?: ConversationSessionRouter;

    constructor(
        private conversationManager: ConversationManager,
        private agentManager: AgentManager,
        private offlineManager: OfflineManager
    ) {
        this.logger = Logger.getInstance();
    }

    /**
     * Set the session router for conversation continuation
     */
    setSessionRouter(sessionRouter: ConversationSessionRouter): void {
        this.sessionRouter = sessionRouter;
    }

    /**
     * Start and continue conversation flow seamlessly
     */
    async startConversationFlow(
        config: ConversationConfig,
        context: CommandContext
    ): Promise<void> {
        try {
            this.logger.info('conversation', 'Starting conversation flow', {
                agentName: config.agentName,
                templateId: config.templateId,
                documentPath: config.documentPath
            });

            // Check if we're in offline mode
            const isOffline = this.offlineManager.isOffline();
            
            if (isOffline) {
                await this.startOfflineConversationFlow(config, context);
                return;
            }

            // Set the active agent
            this.agentManager.setCurrentAgent(config.agentName);

            // Display conversation start message
            context.stream.markdown(`\n🚀 **Starting ${this.getAgentDisplayName(config.agentName)} Conversation**\n\n`);
            context.stream.markdown(`I'll help you develop your ${config.templateId.toUpperCase()} document. Let's start with some questions to gather context.\n\n`);

            // Start the conversation session
            const session = await this.conversationManager.startConversation(
                config.agentName,
                config.conversationContext
            );

            // Get the first question from the session
            const firstQuestion = session.currentQuestionSet[0];
            if (firstQuestion) {
                context.stream.markdown(`**Question 1:** ${firstQuestion.text}\n\n`);
                
                if (firstQuestion.examples && firstQuestion.examples.length > 0) {
                    context.stream.markdown('💡 **Examples:**\n');
                    for (const example of firstQuestion.examples) {
                        context.stream.markdown(`• ${example}\n`);
                    }
                    context.stream.markdown('\n');
                }

                context.stream.markdown('💬 **Please respond to this question in your next message.**\n\n');
                
                // Provide continuation guidance using consolidated manager
                await this.conversationManager.provideContinuationGuidance({
                    lastQuestion: firstQuestion.text,
                    agentName: config.agentName,
                    documentType: config.templateId
                });
                
                context.stream.markdown(`🤖 **Active Agent:** ${this.getAgentDisplayName(config.agentName)} - Ready for your response!\n\n`);
            } else {
                // Fallback if no questions available
                context.stream.markdown(`🤖 **${this.getAgentDisplayName(config.agentName)} is now active.** How can I help you with your ${config.templateId} document?\n\n`);
            }

            // Register session with router for proper routing
            if (this.sessionRouter) {
                this.sessionRouter.setActiveSession(session.sessionId, {
                    agentName: config.agentName,
                    documentPath: config.documentPath,
                    templateId: config.templateId,
                    startedAt: session.createdAt,
                    lastActivity: new Date(),
                    questionCount: session.currentQuestionSet.length,
                    responseCount: 0
                });
                
                this.logger.info('conversation', 'Session registered with router', {
                    sessionId: session.sessionId,
                    agentName: config.agentName
                });
            }

            this.logger.info('conversation', 'Conversation flow started successfully', {
                sessionId: session.sessionId,
                agentName: config.agentName
            });

        } catch (error) {
            this.logger.error('conversation', 'Failed to start conversation flow', error instanceof Error ? error : new Error(String(error)));
            await this.handleConversationFlowError(error, config, context);
        }
    }

    /**
     * Continue existing conversation
     */
    async continueConversation(
        sessionId: string,
        userResponse: string,
        context: CommandContext
    ): Promise<void> {
        try {
            this.logger.info('conversation', 'Continuing conversation', { sessionId, responseLength: userResponse.length });

            const response = await this.conversationManager.continueConversation(sessionId, userResponse);

            // Stream the agent response
            if (response.agentMessage) {
                context.stream.markdown(response.agentMessage + '\n\n');
            }

            // Show follow-up questions if available
            if (response.followupQuestions && response.followupQuestions.length > 0) {
                const nextQuestion = response.followupQuestions[0];
                if (nextQuestion.examples && nextQuestion.examples.length > 0) {
                    context.stream.markdown('💡 **Examples:**\n');
                    for (const example of nextQuestion.examples) {
                        context.stream.markdown(`• ${example}\n`);
                    }
                    context.stream.markdown('\n');
                }
            }

            // Show workflow suggestions if available
            if (response.workflowSuggestions && response.workflowSuggestions.length > 0) {
                context.stream.markdown('🎯 **Next Steps:**\n');
                for (const suggestion of response.workflowSuggestions) {
                    context.stream.markdown(`• ${suggestion.reason}\n`);
                }
                context.stream.markdown('\n');
            }

            // Show progress if available
            if (response.progressUpdate) {
                const progress = response.progressUpdate;
                context.stream.markdown(`📊 **Progress:** ${progress.completionPercentage}% complete\n\n`);
                
                // Check if conversation is completed
                if (progress.completionPercentage >= 100) {
                    await this.conversationManager.provideConversationCompletedFeedback(
                        'document' // Use generic document path since response.documentPath doesn't exist
                    );
                }
            }

            // Check for conversation completion signals in user response
            const completionSignals = ['done', 'finished', 'complete', 'that\'s all', 'no more questions'];
            const isCompleted = completionSignals.some(signal => 
                userResponse.toLowerCase().includes(signal)
            );

            if (isCompleted && !response.followupQuestions?.length) {
                await this.conversationManager.provideConversationCompletedFeedback(
                    'document' // Use generic document path since response.documentPath doesn't exist
                );
            }

        } catch (error) {
            this.logger.error('conversation', 'Failed to continue conversation', error instanceof Error ? error : new Error(String(error)));
            context.stream.markdown(`❌ **Conversation Error:** ${error instanceof Error ? error.message : String(error)}\n\n`);
            context.stream.markdown('**Recovery Options:**\n');
            context.stream.markdown('- Try rephrasing your response\n');
            context.stream.markdown('- Use `/agent current` to check active agent\n');
            context.stream.markdown('- Use `/help` for available commands\n\n');
        }
    }

    /**
     * Start offline conversation flow
     */
    private async startOfflineConversationFlow(
        config: ConversationConfig,
        context: CommandContext
    ): Promise<void> {
        this.logger.info('conversation', 'Starting offline conversation flow', {
            agentName: config.agentName,
            templateId: config.templateId
        });

        context.stream.markdown(`🤖 **${this.getAgentDisplayName(config.agentName)} (Offline Mode)**\n\n`);
        context.stream.markdown('⚠️ **AI features are currently unavailable.** Here\'s how you can continue:\n\n');

        // Provide offline guidance based on template type
        const offlineGuidance = this.getOfflineGuidance(config.templateId, config.agentName);
        context.stream.markdown(offlineGuidance);

        // Set the agent as active for when online mode returns
        this.agentManager.setCurrentAgent(config.agentName);
        
        context.stream.markdown(`\n💡 **Tip:** The ${this.getAgentDisplayName(config.agentName)} agent is now active. When AI services return, you can continue the conversation by simply typing your questions or responses.\n`);
    }

    /**
     * Handle conversation flow errors
     */
    private async handleConversationFlowError(
        error: any,
        config: ConversationConfig,
        context: CommandContext
    ): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        context.stream.markdown(`❌ **Failed to start conversation:** ${errorMessage}\n\n`);
        context.stream.markdown('**What you can try:**\n');
        context.stream.markdown(`- Use \`/agent set ${config.agentName}\` to set the agent manually\n`);
        context.stream.markdown('- Use `/chat <your message>` to start a conversation\n');
        context.stream.markdown('- Check available agents with `/agent list`\n\n');

        // Try to set the agent anyway for manual conversation
        try {
            this.agentManager.setCurrentAgent(config.agentName);
            context.stream.markdown(`🤖 **${this.getAgentDisplayName(config.agentName)} agent is now active** for manual conversation.\n`);
        } catch (agentError) {
            this.logger.error('conversation', 'Failed to set agent after conversation error', agentError instanceof Error ? agentError : new Error(String(agentError)));
        }
    }

    /**
     * Get display name for agent
     */
    private getAgentDisplayName(agentName: string): string {
        const displayNames: Record<string, string> = {
            'prd-creator': 'PRD Creator',
            'requirements-gatherer': 'Requirements Gatherer',
            'solution-architect': 'Solution Architect',
            'specification-writer': 'Specification Writer',
            'quality-reviewer': 'Quality Reviewer',
            'brainstormer': 'Brainstormer'
        };
        
        return displayNames[agentName] || agentName;
    }

    /**
     * Get offline guidance for template type
     */
    private getOfflineGuidance(templateId: string, agentName: string): string {
        const guidanceMap: Record<string, string> = {
            'prd': `**For your PRD document, consider these sections:**
- Executive Summary: Brief overview of the product
- Problem Statement: What problem does this solve?
- Target Users: Who will use this product?
- Goals & Success Metrics: What defines success?
- Functional Requirements: What features are needed?
- Non-Functional Requirements: Performance, security, etc.
- Constraints & Assumptions: What limitations exist?`,

            'requirements': `**For your requirements document, include:**
- Introduction: Project overview and scope
- User Stories: As a [user], I want [feature] so that [benefit]
- Functional Requirements: Specific system behaviors
- Non-Functional Requirements: Performance, security, usability
- Acceptance Criteria: How to verify requirements are met
- Dependencies: External systems or requirements`,

            'design': `**For your design document, cover:**
- System Architecture: High-level system structure
- Components: Major system components and their responsibilities
- Data Models: Key data structures and relationships
- APIs: Interface definitions and contracts
- Security Considerations: Authentication, authorization, data protection
- Performance Considerations: Scalability and optimization`,

            'specification': `**For your specification document, include:**
- Implementation Tasks: Detailed development tasks
- Timeline: Project schedule and milestones
- Resource Requirements: Team members, tools, infrastructure
- Dependencies: Task dependencies and critical path
- Testing Strategy: How to validate implementation
- Deployment Plan: How to release the solution`
        };

        return guidanceMap[templateId] || `**Continue working on your ${templateId} document by adding relevant sections and content.**`;
    }
}