// Base agent implementation
import * as vscode from 'vscode';
import { Agent, ChatRequest, AgentContext, AgentResponse, WorkflowPhase } from './types';
import { Logger } from '../logging/Logger';
import { 
    ConversationManager, 
    ConversationContext, 
    ConversationSession,
    ConversationResponse
} from '../conversation/types';

/**
 * BaseAgent - Abstract base class for all AI agents
 *
 * Provides common functionality for agent implementations including conversation management,
 * logging, offline mode handling, and request processing. All specialized agents extend this class.
 *
 * @example
 * ```typescript
 * class MyAgent extends BaseAgent {
 *     async handleRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
 *         // Implementation
 *     }
 * }
 * ```
 */
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
        // Check if we're in offline mode and handle accordingly
        const { OfflineManager } = await import('../offline/OfflineManager.js');
        const offlineManager = OfflineManager.getInstance();
        
        if (offlineManager.isOffline()) {
            return await this.handleOfflineRequest(request, context);
        }

        // Check if this is a conversation-based request
        if (this.conversationManager && this.shouldUseConversation(request, context)) {
            return await this.handleConversationalRequest(request, context);
        }

        // Fall back to direct handling
        return await this.handleDirectRequest(request, context);
    }

    /**
     * Handle requests when in offline mode
     */
    async handleOfflineRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        try {
            // Check if this is a basic command that can work offline
            if (request.command && this.canHandleOfflineCommand(request.command)) {
                return await this.handleOfflineCommand(request, context);
            }

            // Generate structured offline fallback response
            const fallbackResponse = await this.generateOfflineFallback(request, context);
            
            return this.createResponse(
                fallbackResponse,
                [],
                this.generateOfflineFollowups(request, context)
            );
        } catch (error) {
            return this.createResponse(
                `I'm currently in offline mode and encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `While offline, I can still help with basic document operations and provide structured templates.`,
                [],
                ['Create a basic document template', 'Get offline mode help', 'Check what features are available']
            );
        }
    }

    /**
     * Handle direct requests (to be implemented by subclasses)
     */
    protected abstract handleDirectRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse>;

    /**
     * Handle conversation-based requests
     */
    protected async handleConversationalRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        if (!this.conversationManager) {
            // Conversation manager not available, use direct agent response
            this.log('Conversation manager not available, using direct agent response', 'warn');
            return await this.handleDirectRequest(request, context);
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
                
                // Generate document updates based on the conversation
                const documentUpdates = await this.generateDocumentUpdatesFromConversation(session, response, context);
                
                // Apply document updates if any
                if (documentUpdates.length > 0) {
                    const toolCalls = documentUpdates.map(update => ({
                        tool: 'updateDocument',
                        parameters: update
                    }));
                    
                    // Add tool calls to response
                    const formattedResponse = this.formatConversationResponse(session, response, false);
                    formattedResponse.toolCalls = toolCalls;
                    return formattedResponse;
                }
                
                return this.formatConversationResponse(session, response, false);
            }

        } catch (error) {
            this.log(`Conversation error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            
            // Fall back to direct handling on conversation errors
            return await this.handleDirectRequest(request, context);
        }
    }

    /**
     * Determine if this request should use conversation mode
     */
    protected shouldUseConversation(request: ChatRequest, context: AgentContext): boolean {
        // Always use conversation mode for chat commands and when conversation manager is available
        if (this.conversationManager && (request.command === 'chat' || !request.command)) {
            return true;
        }
        
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
     * Generate document updates from conversation responses
     */
    protected async generateDocumentUpdatesFromConversation(
        session: ConversationSession, 
        response: ConversationResponse | null, 
        context: AgentContext
    ): Promise<any[]> {
        if (!response || !response.documentUpdates) {
            return [];
        }

        const updates: Array<Record<string, unknown>> = [];
        
        // Process each document update from the conversation
        for (const update of response.documentUpdates) {
            try {
                // Get the document path
                const documentPath = this.getDocumentPath(context);
                
                // Create update parameters
                const updateParams = {
                    path: documentPath,
                    section: update.section || 'content',
                    content: update.content || '',
                    updateType: update.updateType || 'append'
                };
                
                updates.push(updateParams);
                
                this.log(`Generated document update for section: ${update.section}`, 'info');
                
            } catch (error) {
                this.log(`Error generating document update: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            }
        }
        
        return updates;
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
    protected createResponse(content: string, toolCalls?: import('./types').ToolCall[], followups?: string[]): AgentResponse {
        return {
            content,
            toolCalls,
            followupSuggestions: followups
        };
    }

    /**
     * Log agent activity
     */
    protected log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
        const logger = Logger.getInstance();
        const prefixedMessage = `[${this.name}] ${message}`;
        switch (level) {
            case 'debug':
                logger.extension.debug(prefixedMessage);
                break;
            case 'info':
                logger.extension.info(prefixedMessage);
                break;
            case 'warn':
                logger.extension.warn(prefixedMessage);
                break;
            case 'error':
                logger.extension.error(prefixedMessage, new Error(message));
                break;
        }
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

    /**
     * Generate structured offline fallback response
     */
    protected async generateOfflineFallback(request: ChatRequest, context: AgentContext): Promise<string> {
        const operation = this.inferOperationType(request);
        const templateType = this.inferDocumentType(context);
        
        // Get agent-specific offline response
        const agentResponse = await this.getAgentSpecificOfflineResponse(operation, templateType, context);
        
        if (agentResponse) {
            return agentResponse;
        }

        // Default structured offline response
        return this.getDefaultOfflineResponse(operation, templateType, context);
    }

    /**
     * Get agent-specific offline response (to be overridden by subclasses)
     */
    protected async getAgentSpecificOfflineResponse(
        operation: string, 
        templateType: string, 
        context: AgentContext
    ): Promise<string | null> {
        // Base implementation returns null - subclasses should override
        return null;
    }

    /**
     * Get default structured offline response
     */
    protected getDefaultOfflineResponse(operation: string, templateType: string, context: AgentContext): string {
        const agentName = this.name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        let response = `🔌 **Offline Mode - ${agentName}**\n\n`;
        response += `I'm currently in offline mode, which means AI-powered features aren't available. However, I can still help you with structured document creation and basic operations.\n\n`;

        // Add operation-specific guidance
        switch (operation) {
            case 'document-creation':
                response += this.getOfflineDocumentCreationGuidance(templateType, context);
                break;
            case 'document-review':
                response += this.getOfflineDocumentReviewGuidance(templateType);
                break;
            case 'conversation':
                response += this.getOfflineConversationGuidance(templateType);
                break;
            default:
                response += this.getGeneralOfflineGuidance(templateType);
                break;
        }

        response += `\n\n📋 **What I can still do offline:**\n`;
        response += `• Create structured document templates\n`;
        response += `• Provide document frameworks and outlines\n`;
        response += `• Offer best practice guidance\n`;
        response += `• Help organize existing content\n\n`;

        response += `🌐 **When back online:**\n`;
        response += `• AI-powered content generation\n`;
        response += `• Interactive conversations and Q&A\n`;
        response += `• Intelligent suggestions and improvements\n`;
        response += `• Context-aware recommendations\n\n`;

        response += `💡 **Tip:** You can still create documents using templates, and I'll enhance them with AI features once connectivity is restored.`;

        return response;
    }

    /**
     * Get offline document creation guidance
     */
    protected getOfflineDocumentCreationGuidance(templateType: string, context: AgentContext): string {
        let guidance = `**Creating ${templateType.toUpperCase()} Documents Offline**\n\n`;
        
        switch (templateType) {
            case 'prd':
                guidance += `I can create a structured PRD template with:\n`;
                guidance += `• Executive Summary section\n`;
                guidance += `• Product Objectives framework\n`;
                guidance += `• User Personas template\n`;
                guidance += `• Requirements structure\n`;
                guidance += `• Success Metrics placeholder\n\n`;
                guidance += `**Manual steps to complete:**\n`;
                guidance += `1. Fill in your product vision and goals\n`;
                guidance += `2. Define your target users and their needs\n`;
                guidance += `3. List core features and requirements\n`;
                guidance += `4. Set measurable success criteria\n`;
                break;
                
            case 'requirements':
                guidance += `I can create a requirements template with:\n`;
                guidance += `• User story framework\n`;
                guidance += `• Acceptance criteria structure\n`;
                guidance += `• Functional requirements outline\n`;
                guidance += `• Non-functional requirements template\n\n`;
                guidance += `**Manual steps to complete:**\n`;
                guidance += `1. Write user stories in "As a... I want... So that..." format\n`;
                guidance += `2. Define specific acceptance criteria for each story\n`;
                guidance += `3. Prioritize requirements by importance\n`;
                guidance += `4. Add technical constraints and dependencies\n`;
                break;
                
            case 'design':
                guidance += `I can create a design document template with:\n`;
                guidance += `• Architecture overview structure\n`;
                guidance += `• Component design framework\n`;
                guidance += `• Data model templates\n`;
                guidance += `• Interface specifications outline\n\n`;
                guidance += `**Manual steps to complete:**\n`;
                guidance += `1. Define system architecture and components\n`;
                guidance += `2. Specify data models and relationships\n`;
                guidance += `3. Design APIs and interfaces\n`;
                guidance += `4. Plan error handling and edge cases\n`;
                break;
                
            default:
                guidance += `I can create a structured document template with:\n`;
                guidance += `• Clear section headings\n`;
                guidance += `• Placeholder content\n`;
                guidance += `• Best practice structure\n`;
                guidance += `• Helpful examples and guidance\n\n`;
                guidance += `**Manual steps to complete:**\n`;
                guidance += `1. Replace placeholders with your content\n`;
                guidance += `2. Follow the provided structure\n`;
                guidance += `3. Use examples as inspiration\n`;
                guidance += `4. Review and refine as needed\n`;
                break;
        }
        
        return guidance;
    }

    /**
     * Get offline document review guidance
     */
    protected getOfflineDocumentReviewGuidance(templateType: string): string {
        let guidance = `**Reviewing ${templateType.toUpperCase()} Documents Offline**\n\n`;
        guidance += `While I can't provide AI-powered analysis, here's a structured review checklist:\n\n`;
        
        switch (templateType) {
            case 'prd':
                guidance += `**PRD Review Checklist:**\n`;
                guidance += `□ Clear problem statement and value proposition\n`;
                guidance += `□ Well-defined target users and personas\n`;
                guidance += `□ Specific, measurable objectives\n`;
                guidance += `□ Comprehensive feature list with priorities\n`;
                guidance += `□ Success metrics and KPIs defined\n`;
                guidance += `□ Technical and business constraints identified\n`;
                break;
                
            case 'requirements':
                guidance += `**Requirements Review Checklist:**\n`;
                guidance += `□ User stories follow proper format\n`;
                guidance += `□ Acceptance criteria are specific and testable\n`;
                guidance += `□ Requirements are prioritized\n`;
                guidance += `□ Dependencies are identified\n`;
                guidance += `□ Non-functional requirements included\n`;
                guidance += `□ Edge cases and error scenarios covered\n`;
                break;
                
            case 'design':
                guidance += `**Design Review Checklist:**\n`;
                guidance += `□ Architecture is clearly documented\n`;
                guidance += `□ Components and interfaces are well-defined\n`;
                guidance += `□ Data models are complete\n`;
                guidance += `□ Error handling is planned\n`;
                guidance += `□ Performance considerations addressed\n`;
                guidance += `□ Security requirements included\n`;
                break;
                
            default:
                guidance += `**General Review Checklist:**\n`;
                guidance += `□ Document structure is logical\n`;
                guidance += `□ Content is clear and complete\n`;
                guidance += `□ Formatting is consistent\n`;
                guidance += `□ All sections are filled out\n`;
                guidance += `□ Grammar and spelling checked\n`;
                guidance += `□ References and links are valid\n`;
                break;
        }
        
        return guidance;
    }

    /**
     * Get offline conversation guidance
     */
    protected getOfflineConversationGuidance(templateType: string): string {
        let guidance = `**Offline Conversation Mode**\n\n`;
        guidance += `I can't have dynamic conversations right now, but I can provide structured guidance for ${templateType} development:\n\n`;
        
        guidance += `**Self-guided questions to consider:**\n`;
        
        switch (templateType) {
            case 'prd':
                guidance += `• What problem are you solving and for whom?\n`;
                guidance += `• What makes your solution unique?\n`;
                guidance += `• How will you measure success?\n`;
                guidance += `• What are your key constraints?\n`;
                guidance += `• Who are your primary users?\n`;
                break;
                
            case 'requirements':
                guidance += `• What does the user want to accomplish?\n`;
                guidance += `• What are the specific acceptance criteria?\n`;
                guidance += `• What are the priority levels?\n`;
                guidance += `• What are the dependencies?\n`;
                guidance += `• What could go wrong?\n`;
                break;
                
            case 'design':
                guidance += `• What are the main system components?\n`;
                guidance += `• How do components interact?\n`;
                guidance += `• What data needs to be stored?\n`;
                guidance += `• How will errors be handled?\n`;
                guidance += `• What are the performance requirements?\n`;
                break;
                
            default:
                guidance += `• What is the main purpose of this document?\n`;
                guidance += `• Who is the intended audience?\n`;
                guidance += `• What key information must be included?\n`;
                guidance += `• How will this be used?\n`;
                guidance += `• What questions should it answer?\n`;
                break;
        }
        
        guidance += `\n**Tip:** Work through these questions systematically, and I'll help enhance your answers when back online!`;
        
        return guidance;
    }

    /**
     * Get general offline guidance
     */
    protected getGeneralOfflineGuidance(templateType: string): string {
        return `**Working with ${templateType.toUpperCase()} documents offline**\n\n` +
               `I can help you create structured templates and provide guidance, but interactive features require an online connection.\n\n` +
               `**Available offline features:**\n` +
               `• Template creation with placeholders\n` +
               `• Document structure and organization\n` +
               `• Best practice guidelines\n` +
               `• Manual review checklists\n`;
    }

    /**
     * Check if a command can be handled offline
     */
    protected canHandleOfflineCommand(command: string): boolean {
        const offlineCommands = ['new', 'template', 'help', 'status'];
        return offlineCommands.includes(command);
    }

    /**
     * Handle offline commands
     */
    protected async handleOfflineCommand(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        const params = this.parseParameters(request);
        
        switch (request.command) {
            case 'new':
                return await this.handleOfflineNewCommand(params, context);
            case 'template':
                return await this.handleOfflineTemplateCommand(params, context);
            case 'help':
                return this.handleOfflineHelpCommand(context);
            case 'status':
                return this.handleOfflineStatusCommand(context);
            default:
                return this.createResponse(
                    `Command "${request.command}" is not available in offline mode. Available commands: new, template, help, status`,
                    [],
                    ['Create new document', 'Get help', 'Check status']
                );
        }
    }

    /**
     * Handle offline new command
     */
    protected async handleOfflineNewCommand(params: Record<string, string>, context: AgentContext): Promise<AgentResponse> {
        const title = params.title || 'New Document';
        const templateType = this.inferDocumentType(context);
        
        const content = await this.createOfflineTemplate(title, templateType, context);
        const fileName = this.sanitizeFileName(title);
        const filePath = `${context.userPreferences.defaultDirectory}/${fileName}.md`;

        const toolCalls = [
            {
                tool: 'writeFile',
                parameters: {
                    path: filePath,
                    content: content,
                    createIfMissing: true
                }
            },
            {
                tool: 'openInEditor',
                parameters: {
                    path: filePath,
                    preview: false
                }
            }
        ];

        return this.createResponse(
            `📄 **Offline Document Created: ${title}**\n\n` +
            `I've created a structured ${templateType} template with:\n` +
            `• Complete document framework\n` +
            `• Helpful placeholders and examples\n` +
            `• Best practice guidance\n` +
            `• Manual completion instructions\n\n` +
            `The document has been saved to \`${filePath}\` and opened for editing.\n\n` +
            `💡 **Next steps:**\n` +
            `1. Fill in the placeholder content\n` +
            `2. Follow the provided structure\n` +
            `3. Use examples as inspiration\n` +
            `4. I'll enhance it with AI features when back online!`,
            toolCalls,
            ['Fill in the template', 'Get completion guidance', 'Check what\'s available offline']
        );
    }

    /**
     * Handle offline template command
     */
    protected async handleOfflineTemplateCommand(params: Record<string, string>, context: AgentContext): Promise<AgentResponse> {
        const templateType = params.type || this.inferDocumentType(context);
        
        return this.createResponse(
            `📋 **${templateType.toUpperCase()} Template (Offline Mode)**\n\n` +
            `I can create structured templates for:\n` +
            `• PRD (Product Requirements Document)\n` +
            `• Requirements (User Stories & Acceptance Criteria)\n` +
            `• Design (Architecture & Technical Specifications)\n` +
            `• Implementation (Tasks & Development Plans)\n\n` +
            `**Template features in offline mode:**\n` +
            `• Complete document structure\n` +
            `• Helpful placeholders and examples\n` +
            `• Best practice guidelines\n` +
            `• Manual completion checklists\n\n` +
            `Use \`/new <title>\` to create a document with the appropriate template.`,
            [],
            ['Create new PRD', 'Create requirements doc', 'Create design doc', 'Get help']
        );
    }

    /**
     * Handle offline help command
     */
    protected handleOfflineHelpCommand(context: AgentContext): AgentResponse {
        const agentName = this.name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return this.createResponse(
            `🔌 **${agentName} - Offline Mode Help**\n\n` +
            `I'm currently in offline mode, but I can still help with:\n\n` +
            `**Available Commands:**\n` +
            `• \`/new <title>\` - Create structured document templates\n` +
            `• \`/template\` - View available template types\n` +
            `• \`/help\` - Show this help message\n` +
            `• \`/status\` - Check offline mode status\n\n` +
            `**What works offline:**\n` +
            `• Document template creation\n` +
            `• Structured frameworks and outlines\n` +
            `• Best practice guidance\n` +
            `• Manual completion checklists\n\n` +
            `**What requires online mode:**\n` +
            `• AI-powered conversations\n` +
            `• Dynamic content generation\n` +
            `• Intelligent suggestions\n` +
            `• Context-aware recommendations\n\n` +
            `💡 **Tip:** Create your document structure now, and I'll enhance it with AI features when connectivity returns!`,
            [],
            ['Create a new document', 'Check available templates', 'Learn about offline features']
        );
    }

    /**
     * Handle offline status command
     */
    protected handleOfflineStatusCommand(context: AgentContext): AgentResponse {
        return this.createResponse(
            `📊 **Offline Mode Status**\n\n` +
            `🔌 **Current Status:** Offline Mode Active\n` +
            `🤖 **Agent:** ${this.name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n` +
            `📁 **Workspace:** ${context.workspaceRoot}\n` +
            `📋 **Phase:** ${context.workflowState.currentPhase || 'Not set'}\n\n` +
            `**Available Capabilities:**\n` +
            `✅ File operations (read, write, update)\n` +
            `✅ Template processing\n` +
            `✅ Document structure creation\n` +
            `✅ Basic commands\n\n` +
            `**Temporarily Unavailable:**\n` +
            `❌ AI-powered content generation\n` +
            `❌ Interactive conversations\n` +
            `❌ Dynamic suggestions\n` +
            `❌ Context-aware responses\n\n` +
            `**To restore full functionality:**\n` +
            `1. Check GitHub Copilot authentication\n` +
            `2. Verify internet connection\n` +
            `3. Restart VS Code if needed\n\n` +
            `I'll automatically return to full functionality when conditions improve!`,
            [],
            ['Create document anyway', 'Get offline help', 'Learn about available features']
        );
    }

    /**
     * Generate offline-specific followup suggestions
     */
    protected generateOfflineFollowups(request: ChatRequest, context: AgentContext): string[] {
        const followups = [
            'Create a document template',
            'Get offline mode help',
            'Check what features are available'
        ];

        // Add context-specific followups
        const templateType = this.inferDocumentType(context);
        switch (templateType) {
            case 'prd':
                followups.unshift('Create PRD template');
                break;
            case 'requirements':
                followups.unshift('Create requirements template');
                break;
            case 'design':
                followups.unshift('Create design template');
                break;
        }

        return followups.slice(0, 3);
    }

    /**
     * Infer operation type from request
     */
    protected inferOperationType(request: ChatRequest): string {
        if (request.command === 'new') {
            return 'document-creation';
        }
        
        if (request.command === 'review') {
            return 'document-review';
        }
        
        if (request.prompt.toLowerCase().includes('create') || request.prompt.toLowerCase().includes('new')) {
            return 'document-creation';
        }
        
        if (request.prompt.toLowerCase().includes('review') || request.prompt.toLowerCase().includes('check')) {
            return 'document-review';
        }
        
        return 'conversation';
    }

    /**
     * Create offline template content
     */
    protected async createOfflineTemplate(title: string, templateType: string, context: AgentContext): Promise<string> {
        const date = new Date().toISOString().split('T')[0];
        const agentName = this.name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        let template = `---
title: ${title}
type: ${templateType}
created: ${date}
agent: ${this.name}
mode: offline
status: template
---

# ${title}

> 📝 **Offline Template Created by ${agentName}**
> 
> This document was created in offline mode. Fill in the sections below with your content.
> When back online, I can help enhance and refine this document with AI-powered features.

`;

        // Add template-specific content
        template += await this.getTemplateSpecificContent(templateType, title, context);
        
        template += `

---

## 📋 Completion Checklist

Use this checklist to ensure your document is complete:

`;

        template += this.getCompletionChecklist(templateType);
        
        template += `

---

## 💡 Tips for Enhancement

When back online, I can help you:
- Generate content based on your inputs
- Provide intelligent suggestions and improvements
- Review and refine your document
- Ask strategic questions to deepen your thinking
- Connect ideas across different sections

**Next Steps:**
1. Fill in all the sections above
2. Use the completion checklist to verify completeness
3. When online, ask me to review and enhance the content

*Created in offline mode by Docu extension ${agentName} agent*`;

        return template;
    }

    /**
     * Get template-specific content (to be overridden by subclasses)
     */
    protected async getTemplateSpecificContent(templateType: string, title: string, context: AgentContext): Promise<string> {
        // Default implementation - subclasses should override for specific templates
        return `## Overview

*Provide a brief overview of ${title}*

## Key Points

1. *First key point*
2. *Second key point*
3. *Third key point*

## Details

*Add detailed information here*

## Next Steps

*List action items and next steps*`;
    }

    /**
     * Get completion checklist for template type
     */
    protected getCompletionChecklist(templateType: string): string {
        switch (templateType) {
            case 'prd':
                return `- [ ] Executive summary completed
- [ ] Product objectives defined
- [ ] Target users and personas described
- [ ] Core features listed and prioritized
- [ ] Success metrics specified
- [ ] Technical constraints identified
- [ ] Business constraints documented
- [ ] Timeline and milestones outlined`;
                
            case 'requirements':
                return `- [ ] User stories written in proper format
- [ ] Acceptance criteria defined for each story
- [ ] Requirements prioritized (Must-have, Should-have, Could-have)
- [ ] Dependencies identified
- [ ] Non-functional requirements included
- [ ] Edge cases and error scenarios covered
- [ ] Assumptions documented`;
                
            case 'design':
                return `- [ ] System architecture documented
- [ ] Component interactions defined
- [ ] Data models specified
- [ ] API interfaces designed
- [ ] Error handling planned
- [ ] Performance requirements addressed
- [ ] Security considerations included
- [ ] Testing strategy outlined`;
                
            default:
                return `- [ ] All main sections completed
- [ ] Content is clear and specific
- [ ] Examples and details provided
- [ ] Action items identified
- [ ] Next steps defined
- [ ] Document reviewed for completeness`;
        }
    }

    /**
     * Sanitize filename for safe file creation
     */
    protected sanitizeFileName(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
}