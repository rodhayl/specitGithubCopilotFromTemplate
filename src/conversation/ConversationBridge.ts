import * as vscode from 'vscode';
import { CommandResult, ConversationConfig, CommandContext } from '../commands/types';
import { ConversationFlowHandler } from './ConversationFlowHandler';
import { ConversationManager } from './ConversationManager';
import { AgentManager } from '../agents/AgentManager';
import { Logger } from '../logging/Logger';
import { OutputCoordinator } from '../commands/OutputCoordinator';

export interface ConversationBridgeConfig {
    enableAutoTransition: boolean;
    defaultAgent: string;
    conversationTimeout: number;
    retryAttempts: number;
}

export interface ConversationTransitionResult {
    success: boolean;
    sessionId?: string;
    error?: string;
    fallbackOptions?: string[];
}

/**
 * Handles the bridge between command execution and conversation initiation
 * Centralizes logic for determining when and how to start conversations
 */
export class ConversationBridge {
    private static instance: ConversationBridge;
    private logger: Logger;
    private config: ConversationBridgeConfig;

    constructor(
        private conversationFlowHandler: ConversationFlowHandler,
        private conversationManager: ConversationManager,
        private agentManager: AgentManager,
        private outputCoordinator: OutputCoordinator
    ) {
        this.logger = Logger.getInstance();
        this.config = {
            enableAutoTransition: true,
            defaultAgent: 'brainstormer',
            conversationTimeout: 30000, // 30 seconds
            retryAttempts: 3
        };
    }

    static getInstance(): ConversationBridge {
        if (!ConversationBridge.instance) {
            throw new Error('ConversationBridge not initialized. Call initialize() first.');
        }
        return ConversationBridge.instance;
    }

    static initialize(
        conversationFlowHandler: ConversationFlowHandler,
        conversationManager: ConversationManager,
        agentManager: AgentManager,
        outputCoordinator: OutputCoordinator
    ): ConversationBridge {
        ConversationBridge.instance = new ConversationBridge(
            conversationFlowHandler,
            conversationManager,
            agentManager,
            outputCoordinator
        );
        return ConversationBridge.instance;
    }

    /**
     * Determine if a conversation should be started based on command result
     */
    shouldStartConversation(commandResult: CommandResult, commandName: string): boolean {
        // Don't start conversation if explicitly disabled
        if (commandResult.shouldContinueConversation === false) {
            return false;
        }

        // Start conversation if explicitly requested
        if (commandResult.shouldContinueConversation === true) {
            return true;
        }

        // Start conversation if conversation config is provided
        if (commandResult.conversationConfig) {
            return true;
        }

        // Check command-specific rules
        return this.getCommandConversationRules(commandName, commandResult);
    }

    /**
     * Handle the transition from command execution to conversation
     */
    async handleCommandToConversationTransition(
        commandResult: CommandResult,
        commandName: string,
        context: CommandContext
    ): Promise<ConversationTransitionResult> {
        try {
            this.logger.info('conversation-bridge', 'Handling command to conversation transition', {
                commandName,
                hasConversationConfig: !!commandResult.conversationConfig,
                shouldContinue: commandResult.shouldContinueConversation
            });

            // Check if conversation should be started
            if (!this.shouldStartConversation(commandResult, commandName)) {
                this.logger.debug('conversation-bridge', 'Conversation not needed for this command');
                return { success: true };
            }

            // Get or create conversation configuration
            const conversationConfig = commandResult.conversationConfig || 
                this.createDefaultConversationConfig(commandResult, commandName, context);

            if (!conversationConfig) {
                return {
                    success: false,
                    error: 'Unable to create conversation configuration',
                    fallbackOptions: [
                        'Start a conversation manually with /chat',
                        'Use specific agent commands like /agent set <agent-name>',
                        'Continue working on the document manually'
                    ]
                };
            }

            // Validate agent availability
            const agentValidation = await this.validateAgent(conversationConfig.agentName);
            if (!agentValidation.valid) {
                return {
                    success: false,
                    error: `Agent '${conversationConfig.agentName}' is not available: ${agentValidation.reason}`,
                    fallbackOptions: [
                        'Use /agent list to see available agents',
                        'Set a different agent with /agent set <agent-name>',
                        'Continue with manual document editing'
                    ]
                };
            }

            // Start the conversation flow
            const sessionId = await this.startConversationFlow(conversationConfig, context);

            this.logger.info('conversation-bridge', 'Conversation transition successful', {
                sessionId,
                agentName: conversationConfig.agentName
            });

            return {
                success: true,
                sessionId
            };

        } catch (error) {
            this.logger.error('conversation-bridge', 'Failed to handle conversation transition', 
                error instanceof Error ? error : new Error(String(error)));

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                fallbackOptions: [
                    'Try starting the conversation manually with /chat',
                    'Check your internet connection',
                    'Restart VS Code if the issue persists'
                ]
            };
        }
    }

    /**
     * Create default conversation configuration for a command
     */
    private createDefaultConversationConfig(
        commandResult: CommandResult,
        commandName: string,
        context: CommandContext
    ): ConversationConfig | null {
        try {
            // Get recommended agent for the command
            const agentName = commandResult.agentName || 
                this.getRecommendedAgentForCommand(commandName) || 
                this.config.defaultAgent;

            // Determine document path
            const documentPath = commandResult.data?.filePath || 
                commandResult.documentPath || 
                this.generateDefaultDocumentPath(commandName, context);

            if (!documentPath) {
                this.logger.warn('conversation-bridge', 'Cannot create conversation config without document path');
                return null;
            }

            // Create conversation configuration
            const conversationConfig: ConversationConfig = {
                agentName,
                templateId: this.getTemplateIdForCommand(commandName, commandResult),
                documentPath,
                title: commandResult.data?.title || `Document from ${commandName} command`,
                conversationContext: {
                    documentType: this.getTemplateIdForCommand(commandName, commandResult),
                    workflowPhase: 'creation',
                    documentPath,
                    title: commandResult.data?.title || `Document from ${commandName} command`,
                    workspaceRoot: context.workspaceRoot,
                    extensionContext: context.extensionContext
                }
            };

            this.logger.debug('conversation-bridge', 'Created default conversation config', {
                agentName,
                documentPath,
                templateId: conversationConfig.templateId
            });

            return conversationConfig;

        } catch (error) {
            this.logger.error('conversation-bridge', 'Failed to create default conversation config', 
                error instanceof Error ? error : new Error(String(error)));
            return null;
        }
    }

    /**
     * Start the conversation flow with the given configuration
     */
    private async startConversationFlow(
        conversationConfig: ConversationConfig,
        context: CommandContext
    ): Promise<string> {
        // Set the current agent
        await this.agentManager.setCurrentAgent(conversationConfig.agentName);

        // Start the conversation flow
        await this.conversationFlowHandler.startConversationFlow(conversationConfig, context);

        // Generate session ID (this would typically come from the conversation manager)
        const sessionId = this.generateSessionId();
        
        return sessionId;
    }

    /**
     * Validate that an agent is available and ready
     */
    private async validateAgent(agentName: string): Promise<{ valid: boolean; reason?: string }> {
        try {
            const agents = this.agentManager.listAgents();
            const agent = agents.find(a => a.name === agentName);
            
            if (!agent) {
                return {
                    valid: false,
                    reason: `Agent '${agentName}' not found`
                };
            }

            if (!agent.active) {
                return {
                    valid: false,
                    reason: `Agent '${agentName}' is disabled`
                };
            }

            return { valid: true };

        } catch (error) {
            return {
                valid: false,
                reason: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get command-specific conversation rules
     */
    private getCommandConversationRules(commandName: string, commandResult: CommandResult): boolean {
        const conversationEnabledCommands = ['new', 'create', 'init', 'start'];
        
        // Enable conversation for document creation commands
        if (conversationEnabledCommands.includes(commandName)) {
            return true;
        }

        // Enable conversation if document was created
        if (commandResult.data?.filePath) {
            return true;
        }

        return false;
    }

    /**
     * Get recommended agent for a command
     */
    private getRecommendedAgentForCommand(commandName: string): string | null {
        const commandAgentMap: Record<string, string> = {
            'new': 'brainstormer',
            'create': 'brainstormer',
            'prd': 'prd-creator',
            'requirements': 'requirements-gatherer',
            'design': 'solution-architect',
            'review': 'quality-reviewer',
            'spec': 'specification-writer'
        };

        return commandAgentMap[commandName] || null;
    }

    /**
     * Get template ID for a command
     */
    private getTemplateIdForCommand(commandName: string, commandResult: CommandResult): string {
        // Check if template ID is in command result
        if (commandResult.data?.templateId) {
            return commandResult.data.templateId;
        }

        // Map command to template
        const commandTemplateMap: Record<string, string> = {
            'new': 'basic',
            'prd': 'prd',
            'requirements': 'requirements',
            'design': 'design',
            'spec': 'specification'
        };

        return commandTemplateMap[commandName] || 'basic';
    }

    /**
     * Generate default document path for a command
     */
    private generateDefaultDocumentPath(commandName: string, context: CommandContext): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${commandName}-document-${timestamp}.md`;
        return `${context.workspaceRoot}/docs/${filename}`;
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update bridge configuration
     */
    updateConfig(config: Partial<ConversationBridgeConfig>): void {
        this.config = { ...this.config, ...config };
        this.logger.debug('conversation-bridge', 'Configuration updated', this.config);
    }

    /**
     * Get current bridge configuration
     */
    getConfig(): ConversationBridgeConfig {
        return { ...this.config };
    }
}