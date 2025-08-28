// Base agent implementation
import * as vscode from 'vscode';
import { Agent, ChatRequest, AgentContext, AgentResponse, WorkflowPhase } from './types';
import { 
    ConversationManager, 
    ConversationContext, 
    ConversationSession,
    ConversationResponse 
} from '../conversation/types';

export abstract class BaseAgent implements Agent {
    public readonly name: string;
    public readonly systemPrompt: string;
    public readonly allowedTools: string[];
    public readonly workflowPhase: WorkflowPhase;
    protected conversationManager?: ConversationManager;

    constructor(
        name: string,
        systemPrompt: string,
        allowedTools: string[],
        workflowPhase: WorkflowPhase
    ) {
        this.name = name;
        this.systemPrompt = systemPrompt;
        this.allowedTools = allowedTools;
        this.workflowPhase = workflowPhase;
    }

    /**
     * Set the conversation manager for this agent
     */
    setConversationManager(conversationManager: ConversationManager): void {
        this.conversationManager = conversationManager;
    }

    /**
     * Handle a chat request - enhanced with conversation capabilities
     */
    async handleRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        // Check if this is a conversation-based request
        if (this.conversationManager && this.shouldUseConversation(request, context)) {
            return await this.handleConversationalRequest(request, context);
        }

        // Fall back to legacy handling
        return await this.handleLegacyRequest(request, context);
    }

    /**
     * Handle legacy requests (to be implemented by subclasses)
     */
    protected abstract handleLegacyRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse>;

    /**
     * Handle conversation-based requests
     */
    protected async handleConversationalRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        if (!this.conversationManager) {
            throw new Error('Conversation manager not available');
        }

        try {
            // Check for existing active session
            let session = this.conversationManager.getActiveSession(this.name);
            
            if (!session) {
                // Start new conversation
                const conversationContext: ConversationContext = {
                    documentType: this.inferDocumentType(context),
                    documentPath: this.getDocumentPath(context),
                    workflowPhase: this.workflowPhase,
                    workspaceRoot: context.workspaceRoot,
                    extensionContext: context.extensionContext
                };

                session = await this.conversationManager.startConversation(this.name, conversationContext);
                
                // Return initial conversation response
                return this.formatConversationResponse(session, null, true);
            } else {
                // Continue existing conversation
                const response = await this.conversationManager.continueConversation(session.sessionId, request.prompt);
                return this.formatConversationResponse(session, response, false);
            }

        } catch (error) {
            return this.createResponse(
                `I encountered an error during our conversation: ${error instanceof Error ? error.message : 'Unknown error'}. Let's try starting fresh.`,
                [],
                ['Start a new conversation', 'Try a different approach']
            );
        }
    }

    /**
     * Determine if this request should use conversation mode
     */
    protected shouldUseConversation(request: ChatRequest, context: AgentContext): boolean {
        // Use conversation mode for non-command requests
        return !request.command || request.command === 'chat';
    }

    /**
     * Format conversation response for VSCode chat
     */
    protected formatConversationResponse(
        session: ConversationSession, 
        response: ConversationResponse | null, 
        isInitial: boolean
    ): AgentResponse {
        let content = '';
        let followupSuggestions: string[] = [];

        if (isInitial) {
            // Initial conversation start
            content = this.generateInitialConversationMessage(session);
            followupSuggestions = this.generateInitialFollowups();
        } else if (response) {
            // Ongoing conversation
            content = response.agentMessage;
            
            // Add progress update if available
            if (response.progressUpdate) {
                content += `\n\n📊 **Progress:** ${Math.round(response.progressUpdate.completionPercentage)}% complete`;
            }

            // Add workflow suggestions if available
            if (response.workflowSuggestions && response.workflowSuggestions.length > 0) {
                const suggestion = response.workflowSuggestions[0];
                content += `\n\n🚀 **Next Phase:** ${suggestion.reason}`;
                content += `\n\n*Use \`/agent set ${suggestion.recommendedAgent}\` to transition to ${suggestion.nextPhase} phase*`;
            }

            // Add document updates notification
            if (response.documentUpdates && response.documentUpdates.length > 0) {
                content += `\n\n✅ **Document Updated:** ${response.documentUpdates.length} section(s) updated automatically`;
            }

            followupSuggestions = this.generateConversationFollowups(response);
        }

        return this.createResponse(content, [], followupSuggestions);
    }

    /**
     * Generate initial conversation message
     */
    protected generateInitialConversationMessage(session: ConversationSession): string {
        const questions = session.currentQuestionSet.slice(0, 1); // Show first question
        
        let message = `Hi! I'm the ${this.name.replace('-', ' ')} agent. I'm here to help you with ${this.workflowPhase} phase development.\n\n`;
        
        if (questions.length > 0) {
            message += `Let's start with this question:\n\n**${questions[0].text}**`;
            
            if (questions[0].examples && questions[0].examples.length > 0) {
                message += `\n\n*Examples:*\n`;
                questions[0].examples.slice(0, 2).forEach(example => {
                    message += `- ${example}\n`;
                });
            }
        }

        return message;
    }

    /**
     * Generate initial followup suggestions
     */
    protected generateInitialFollowups(): string[] {
        return [
            'Tell me about your idea',
            'I need help getting started',
            'What questions will you ask me?'
        ];
    }

    /**
     * Generate conversation followup suggestions
     */
    protected generateConversationFollowups(response: ConversationResponse): string[] {
        const followups: string[] = [];

        // Add question-based followups
        if (response.followupQuestions && response.followupQuestions.length > 0) {
            followups.push('Continue with next question');
        }

        // Add workflow-based followups
        if (response.workflowSuggestions && response.workflowSuggestions.length > 0) {
            followups.push('Move to next phase');
        }

        // Add generic followups
        followups.push('I need clarification');
        followups.push('Let me provide more detail');

        return followups.slice(0, 3); // Limit to 3 followups
    }

    /**
     * Infer document type from context
     */
    protected inferDocumentType(context: AgentContext): string {
        // Map workflow phases to document types
        const typeMap: Record<string, string> = {
            'prd': 'prd',
            'requirements': 'requirements',
            'design': 'design',
            'implementation': 'implementation'
        };

        return typeMap[this.workflowPhase] || 'document';
    }

    /**
     * Get document path from context
     */
    protected getDocumentPath(context: AgentContext): string {
        // Try to get from workflow state first
        if (context.workflowState?.documents) {
            const docType = this.inferDocumentType(context);
            const existingPath = (context.workflowState.documents as any)[docType];
            if (existingPath) {
                return existingPath;
            }
        }

        // Generate default path
        const docType = this.inferDocumentType(context);
        return `${context.userPreferences.defaultDirectory}/${docType}.md`;
    }

    /**
     * Check if this agent can use a specific tool
     */
    protected canUseTool(toolName: string): boolean {
        return this.allowedTools.includes(toolName);
    }

    /**
     * Build a system prompt with context
     */
    protected buildSystemPrompt(context: AgentContext): string {
        let prompt = this.systemPrompt;
        
        // Add workflow context
        if (context.workflowState.currentPhase) {
            prompt += `\n\nCurrent workflow phase: ${context.workflowState.currentPhase}`;
        }

        // Add workspace context
        if (context.workspaceRoot) {
            prompt += `\nWorkspace root: ${context.workspaceRoot}`;
        }

        // Add previous outputs context
        if (context.previousOutputs.length > 0) {
            prompt += `\nPrevious outputs available for context.`;
        }

        return prompt;
    }

    /**
     * Create a basic response structure
     */
    protected createResponse(content: string, toolCalls?: any[], followups?: string[]): AgentResponse {
        return {
            content,
            toolCalls,
            followupSuggestions: followups
        };
    }

    /**
     * Log agent activity
     */
    protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
    }

    /**
     * Validate that required tools are available
     */
    protected validateTools(requiredTools: string[]): boolean {
        return requiredTools.every(tool => this.canUseTool(tool));
    }

    /**
     * Parse command parameters from request
     */
    protected parseParameters(request: ChatRequest): Record<string, string> {
        // Basic parameter parsing - can be enhanced
        const params: Record<string, string> = {};
        
        if (request.command) {
            params.command = request.command;
        }

        // Parse --key value patterns
        const paramPattern = /--(\w+)\s+([^\s--]+)/g;
        let match;
        while ((match = paramPattern.exec(request.prompt)) !== null) {
            params[match[1]] = match[2];
        }

        return { ...params, ...request.parameters };
    }

    /**
     * Generate follow-up suggestions based on current phase
     */
    protected generateFollowups(context: AgentContext): string[] {
        const followups: string[] = [];
        
        switch (context.workflowState.currentPhase) {
            case 'prd':
                followups.push('Continue with requirements gathering');
                followups.push('Switch to brainstormer agent');
                break;
            case 'requirements':
                followups.push('Move to design phase');
                followups.push('Review requirements');
                break;
            case 'design':
                followups.push('Create implementation plan');
                followups.push('Review design');
                break;
            case 'implementation':
                followups.push('Review implementation');
                followups.push('Generate documentation');
                break;
        }

        return followups;
    }
}