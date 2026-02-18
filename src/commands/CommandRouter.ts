import { CommandParser } from './CommandParser';
import { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from './types';
import { ConversationFlowHandler } from '../conversation/ConversationFlowHandler';
import { CommandTipProvider } from './CommandTipProvider';
import { OutputCoordinator } from './OutputCoordinator';
import { NewCommandHandler } from './NewCommandHandler';
import { AgentUtils } from '../utils/AgentUtils';
import { ConversationManager } from '../conversation/ConversationManager';
import { ErrorHandler, ErrorCategory, withErrorHandling } from '../utils/ErrorHandler';
import { PerformanceMonitor, withPerformanceMonitoring } from '../utils/PerformanceMonitor';
import { ConversationBridge } from '../conversation/ConversationBridge';
import { ErrorHandler as EnhancedErrorHandler } from '../error/ErrorHandler';
import { createHelpCommandDefinition } from './HelpCommand';
import { createStatusCommandDefinition } from './StatusCommand';
import { createWorkflowCommandDefinitions } from './WorkflowCommands';

export type { CommandContext } from './types';

export class CommandRouter {
    private parser: CommandParser;
    private conversationFlowHandler?: ConversationFlowHandler;
    private conversationManager?: ConversationManager;
    private outputCoordinator: OutputCoordinator;
    private newCommandHandler: NewCommandHandler;
    private conversationBridge?: ConversationBridge;
    private agentManager: import('../agents/AgentManager').AgentManager;

    constructor(agentManager: import('../agents/AgentManager').AgentManager) {
        this.parser = new CommandParser();
        this.outputCoordinator = OutputCoordinator.getInstance();
        this.newCommandHandler = new NewCommandHandler();
        this.agentManager = agentManager;
        this.registerBuiltInCommands();
    }

    /**
     * Set conversation handlers for command-to-conversation flow
     */
    setConversationHandlers(
        flowHandler: ConversationFlowHandler,
        conversationManager: ConversationManager
    ): void {
        this.conversationFlowHandler = flowHandler;
        this.conversationManager = conversationManager;
        
        // Initialize ConversationBridge if all dependencies are available
        if (this.conversationFlowHandler && this.conversationManager && this.agentManager) {
            this.conversationBridge = ConversationBridge.initialize(
                this.conversationFlowHandler,
                this.conversationManager,
                this.agentManager,
                this.outputCoordinator
            );
        }
    }

    /**
     * Set auto-chat integration for enhanced workflow
     */
    setAutoChatIntegration(
        autoChatManager: import('../conversation/AutoChatStateManager').AutoChatStateManager,
        documentUpdateEngine: import('../conversation/DocumentUpdateEngine').DocumentUpdateEngine
    ): void {
        this.newCommandHandler.setAutoChatManager(autoChatManager);
        this.newCommandHandler.setDocumentUpdateEngine(documentUpdateEngine);
    }

    /**
     * Register context-aware workflow commands (/prd, /requirements, /design, /spec, /review, /status, /context)
     * and replace the static /help with a smart, project-aware version.
     *
     * Call this once after the AgentManager is ready and WorkflowStateManager is initialized.
     */
    registerWorkflowCommands(
        workflowStateManager: import('../state/WorkflowStateManager').WorkflowStateManager
    ): void {
        // Replace static /help with context-aware version
        this.parser.registerCommand(createHelpCommandDefinition(workflowStateManager, this.agentManager));

        // Register /status
        this.parser.registerCommand(createStatusCommandDefinition(workflowStateManager));

        // Register /prd, /requirements, /design, /spec, /review, /context
        for (const def of createWorkflowCommandDefinitions(workflowStateManager, this.agentManager)) {
            this.parser.registerCommand(def);
        }
    }

    /**
     * Register a command with the router
     */
    registerCommand(definition: CommandDefinition): void {
        this.parser.registerCommand(definition);
    }

    /**
     * Route and execute a command
     */
    async routeCommand(input: string, context: CommandContext): Promise<CommandResult> {
        let parsedCommand: ParsedCommand | undefined;
        try {
            // Clear previous output state
            this.outputCoordinator.clear();

            // Parse the command
            parsedCommand = this.parser.parseCommand(input);

            // Validate the command
            const validation = this.parser.validateCommand(parsedCommand);
            if (!validation.valid) {
                this.outputCoordinator.registerPrimaryOutput('command-router', {
                    type: 'error',
                    title: 'Command Validation Failed',
                    message: 'The command has validation errors.',
                    details: validation.errors,
                    nextSteps: ['Check command syntax', 'Use /help for available commands']
                });
                await this.outputCoordinator.render(context.stream);
                
                return {
                    success: false,
                    error: `Command validation failed: ${validation.errors.join(', ')}`
                };
            }

            // Find and execute the command handler
            const commandDef = this.parser.getCommands().find(cmd => cmd.name === parsedCommand?.command);
            if (!commandDef) {
                this.outputCoordinator.registerPrimaryOutput('command-router', {
                    type: 'error',
                    title: 'Command Not Found',
                    message: `Command '${parsedCommand?.command || 'unknown'}' is not recognized.`,
                    nextSteps: ['Use /help to see available commands', 'Check command spelling']
                });
                await this.outputCoordinator.render(context.stream);
                
                return {
                    success: false,
                    error: `Command '${parsedCommand?.command || 'unknown'}' not found`
                };
            }

            // Execute the command
            const result = await commandDef.handler(parsedCommand, context);

            // Handle post-command feedback coordination
            await this.handlePostCommandFeedback(result, context, parsedCommand);

            return result;

        } catch (error) {
            // Enhanced error handling with recovery options
            const err = error instanceof Error ? error : new Error(String(error));
            const errorContext = {
                operation: 'command-execution',
                userInput: input,
                timestamp: new Date()
            };
            
            // Use enhanced error handler for better recovery
            const errorHandler = EnhancedErrorHandler.getInstance();
            const errorReport = await errorHandler.handleErrorWithRecovery(err, errorContext, 2);
            
            // Provide contextual error information
            const errorDetails = [errorReport.technicalDetails];
            const nextSteps = errorReport.recoveryOptions.map(option => option.description);
            
            // Add command-specific recovery suggestions
            if (parsedCommand?.command) {
                nextSteps.push(`Try '/help ${parsedCommand.command}' for command usage`);
            }
            nextSteps.push('Check the VS Code output panel for details');
            
            this.outputCoordinator.registerPrimaryOutput('command-router', {
                type: 'error',
                title: errorReport.severity === 'critical' ? 'Critical Error' : 'Command Error',
                message: errorReport.userMessage,
                details: errorDetails,
                nextSteps
            });
            await this.outputCoordinator.render(context.stream);
            
            return {
                success: false,
                error: errorReport.userMessage,
                metadata: {
                    errorCategory: errorReport.severity,
                    recoveryOptions: errorReport.recoveryOptions.map(opt => opt.label),
                    canRetry: errorReport.recoveryOptions.some(opt => opt.label.toLowerCase().includes('retry'))
                }
            };
        }
    }

    /**
     * Get help for a command or list all commands
     */
    getHelp(commandName?: string, subcommand?: string): string {
        if (commandName) {
            return this.parser.getCommandHelp(commandName, subcommand);
        }

        // List all commands
        const commands = this.parser.getCommands();
        let help = '# Available Commands\n\n';

        for (const cmd of commands) {
            help += `## /${cmd.name}\n`;
            help += `${cmd.description}\n\n`;
            help += `**Usage:** ${cmd.usage}\n\n`;

            if (cmd.subcommands && cmd.subcommands.length > 0) {
                help += '**Subcommands:**\n';
                for (const sc of cmd.subcommands) {
                    help += `- **${sc.name}**: ${sc.description}\n`;
                }
                help += '\n';
            }

            if (cmd.examples.length > 0) {
                help += '**Examples:**\n';
                for (const example of cmd.examples) {
                    help += `- ${example}\n`;
                }
                help += '\n';
            }

            help += '---\n\n';
        }

        return help;
    }

    /**
     * Parse a command string and return the parsed command
     */
    parseCommand(input: string): ParsedCommand {
        return this.parser.parseCommand(input);
    }

    /**
     * Check if input looks like a command
     */
    isCommand(input: string): boolean {
        const trimmed = input.trim();
        
        // Must start with / and have content after it
        if (!trimmed.startsWith('/')) {
            return false;
        }
        
        // Must have at least one character after the /
        if (trimmed.length <= 1) {
            return false;
        }
        
        // Must not be just whitespace after /
        const afterSlash = trimmed.substring(1).trim();
        if (afterSlash.length === 0) {
            return false;
        }
        
        // Must not be a comment (// pattern)
        if (trimmed.startsWith('//')) {
            return false;
        }
        
        return true;
    }

    /**
     * Register built-in commands
     */
    private registerBuiltInCommands(): void {
        // Help command
        this.registerCommand({
            name: 'help',
            description: 'Show help information for commands',
            usage: '/help [command] [subcommand]',
            examples: [
                '/help',
                '/help new',
                '/help agent list'
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                const commandName = parsedCommand.arguments[0];
                const subcommand = parsedCommand.arguments[1];
                
                if (!commandName) {
                    // Register overview help with output coordinator
                    this.outputCoordinator.registerPrimaryOutput('help-command', {
                        type: 'info',
                        title: '🤖 Docu Assistant Help',
                        message: 'Docu helps you create and manage documentation through AI-powered conversations.',
                        details: [
                            '🚀 **Quick Start:**',
                            '1. `/agent set prd-creator` - Set an active agent',
                            '2. `/new "My PRD" --with-conversation` - Create document with automatic conversation',
                            '3. Respond naturally to continue the conversation',
                            '',
                            '📋 **Available Commands:**',
                            '• `/new "Title" --with-conversation` - Create documents with AI assistance',
                            '• `/agent set <name>` - Set active AI agent',
                            '• `/chat <message>` - Start conversations manually',
                            '• `/templates list` - View available templates',
                            '• `/update --file <path> --section <name>` - Update document sections',
                            '• `/review --file <path>` - Review document quality',
                            '• `/diagnostic` - Show conversation and agent status'
                        ],
                        nextSteps: [
                            'Use `--with-conversation` flag to start conversations automatically',
                            'Once a conversation is active, respond naturally without `/chat`',
                            'Use `/diagnostic --conversation` to check conversation status',
                            'Use `/help <command>` for detailed help on specific commands'
                        ]
                    });
                } else {
                    const helpText = this.getHelp(commandName, subcommand);
                    this.outputCoordinator.registerPrimaryOutput('help-command', {
                        type: 'info',
                        title: `Help: /${commandName}${subcommand ? ` ${subcommand}` : ''}`,
                        message: helpText
                    });
                }
                
                await this.outputCoordinator.render(context.stream);
                return { success: true, message: 'Help displayed' };
            }
        });

        // Templates command
        this.registerCommand({
            name: 'templates',
            description: 'Manage document templates',
            usage: '/templates <subcommand> [options]',
            examples: [
                '/templates list',
                '/templates list --agent prd-creator',
                '/templates show basic'
            ],
            subcommands: [
                {
                    name: 'list',
                    description: 'List available templates',
                    usage: '/templates list [--agent <agent-name>] [--verbose]',
                    examples: [
                        '/templates list',
                        '/templates list --agent prd-creator',
                        '/templates list --verbose'
                    ],
                    flags: [
                        {
                            name: 'agent',
                            shortName: 'a',
                            description: 'Filter templates by agent',
                            type: 'string'
                        },
                        {
                            name: 'verbose',
                            shortName: 'v',
                            description: 'Show detailed template information',
                            type: 'boolean'
                        }
                    ]
                },
                {
                    name: 'show',
                    description: 'Show details of a specific template',
                    usage: '/templates show <template-id>',
                    examples: [
                        '/templates show basic',
                        '/templates show prd'
                    ]
                }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                const subcommand = parsedCommand.arguments[0] || 'list';
                const templateService = (await import('../templates/TemplateService.js')).TemplateService.getInstance();
                
                try {
                    switch (subcommand) {
                        case 'list':
                            const agentFilter = parsedCommand.flags.agent as string;
                            const verbose = parsedCommand.flags.verbose as boolean;
                            const templates = agentFilter 
                                ? templateService.getTemplatesForAgent(agentFilter)
                                : templateService.listTemplates();
                            
                            this.outputCoordinator.registerPrimaryOutput('templates-command', {
                                type: 'success',
                                title: `📄 Available Templates${agentFilter ? ` (${agentFilter} agent)` : ''}`,
                                message: `Found ${templates.length} template${templates.length !== 1 ? 's' : ''} available for use.`,
                                details: templates.map((template: any) => 
                                    verbose 
                                        ? `• **${template.name}** (\`${template.id}\`) - ${template.description} [${template.variables.length} variables]`
                                        : `• **${template.name}** (\`${template.id}\`) - ${template.description}`
                                ),
                                nextSteps: [
                                    'Use `/new "Title" --template <id>` to create a document with a template',
                                    'Use `/templates show <id>` to see template details',
                                    'Use `/templates list --verbose` for detailed information',
                                    agentFilter ? 'Remove `--agent` flag to see all templates' : 'Use `--agent <name>` to filter by agent'
                                ]
                            });
                            break;
                            
                        case 'show':
                            const templateId = parsedCommand.arguments[1];
                            if (!templateId) {
                                this.outputCoordinator.registerPrimaryOutput('templates-command', {
                                    type: 'error',
                                    title: 'Missing Template ID',
                                    message: 'Please specify a template ID to show details.',
                                    nextSteps: [
                                        'Use `/templates show <template-id>`',
                                        'Use `/templates list` to see available template IDs',
                                        'Example: `/templates show prd`'
                                    ]
                                });
                                break;
                            }
                            
                            try {
                                const template = await templateService.getTemplate(templateId);
                                this.outputCoordinator.registerPrimaryOutput('templates-command', {
                                    type: 'success',
                                    title: `📄 Template: ${template.name}`,
                                    message: `Details for template "${template.id}"`,
                                    details: [
                                        `**ID:** \`${template.id}\``,
                                        `**Name:** ${template.name}`,
                                        `**Description:** ${template.description}`,
                                        `**Variables:** ${template.variables.length} required`,
                                        ...template.variables.map((v: any) => `  • \`${v.name}\` (${v.type}) - ${v.description}${v.required ? ' *required*' : ''}`)
                                    ],
                                    nextSteps: [
                                        `Use \`/new "Title" --template ${template.id}\` to create a document`,
                                        'Customize the template variables when creating the document',
                                        'Use `/templates list` to see other available templates'
                                    ]
                                });
                            } catch (error) {
                                this.outputCoordinator.registerPrimaryOutput('templates-command', {
                                    type: 'error',
                                    title: 'Template Not Found',
                                    message: `Template "${templateId}" was not found.`,
                                    nextSteps: [
                                        'Use `/templates list` to see available templates',
                                        'Check the template ID spelling',
                                        'Available templates: basic, prd, requirements, design'
                                    ]
                                });
                            }
                            break;
                            
                        default:
                            this.outputCoordinator.registerPrimaryOutput('templates-command', {
                                type: 'error',
                                title: 'Unknown Subcommand',
                                message: `Unknown templates subcommand: "${subcommand}"`,
                                nextSteps: [
                                    'Use `/templates list` to list templates',
                                    'Use `/templates show <id>` to show template details',
                                    'Use `/help templates` for more information'
                                ]
                            });
                    }
                } catch (error) {
                    this.outputCoordinator.registerPrimaryOutput('templates-command', {
                        type: 'error',
                        title: 'Templates Command Error',
                        message: `Error executing templates command: ${error instanceof Error ? error.message : String(error)}`,
                        nextSteps: [
                            'Try the command again',
                            'Use `/help templates` for command syntax',
                            'Check VS Code output panel for detailed error information'
                        ]
                    });
                }
                
                await this.outputCoordinator.render(context.stream);
                return { success: true };
            }
        });

        // Agent command
        this.registerCommand({
            name: 'agent',
            description: 'Manage AI agents',
            usage: '/agent <subcommand> [options]',
            examples: [
                '/agent list',
                '/agent set prd-creator',
                '/agent current'
            ],
            subcommands: [
                {
                    name: 'list',
                    description: 'List available agents',
                    usage: '/agent list',
                    examples: ['/agent list']
                },
                {
                    name: 'set',
                    description: 'Set the active agent',
                    usage: '/agent set <agent-name>',
                    examples: ['/agent set prd-creator']
                },
                {
                    name: 'current',
                    description: 'Show the current active agent',
                    usage: '/agent current',
                    examples: ['/agent current']
                }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                const subcommand = parsedCommand.arguments[0] || 'current';
                
                try {
                    // Note: AgentManager would be injected in a real implementation
                    // For now, we'll provide meaningful placeholder responses
                    
                    switch (subcommand) {
                        case 'list':
                            try {
                                const agents = this.agentManager.listAgents();
                                const agentDetails = agents.map(agent => `• **${agent.name}** - ${agent.description || 'AI Assistant'}`);
                                
                                this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                    type: 'info',
                                    title: '🤖 Available AI Agents',
                                    message: 'Here are the AI agents available for document assistance:',
                                    details: agentDetails,
                                    nextSteps: [
                                        'Use `/agent set <agent-name>` to activate an agent',
                                        'Use `/new "Title" --with-conversation` to create documents with AI assistance',
                                        'Different templates automatically select appropriate agents',
                                        'Use `/agent current` to see which agent is currently active'
                                    ]
                                });
                            } catch (error) {
                                this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                    type: 'error',
                                    title: 'Agent Manager Error',
                                    message: `Error listing agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                    nextSteps: [
                                        'Try the command again',
                                        'Check VS Code output panel for detailed error information'
                                    ]
                                });
                            }
                            break;
                            
                        case 'set':
                            const agentName = parsedCommand.arguments[1];
                            if (!agentName) {
                                this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                    type: 'error',
                                    title: 'Missing Agent Name',
                                    message: 'Please specify an agent name to set as active.',
                                    nextSteps: [
                                        'Use `/agent set <agent-name>`',
                                        'Use `/agent list` to see available agents',
                                        'Example: `/agent set prd-creator`'
                                    ]
                                });
                                break;
                            }
                            
                            try {
                                const agentManager = this.agentManager;
                                const success = agentManager.setCurrentAgent(agentName);
                                if (success) {
                                    this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                        type: 'success',
                                        title: '🤖 Agent Activated',
                                        message: `Successfully set "${agentName}" as the active agent.`,
                                        details: [
                                            `**Active Agent:** ${agentName}`,
                                            `**Specialization:** ${this.getAgentDescription(agentName)}`,
                                            `**Status:** Ready for conversations and document assistance`
                                        ],
                                        nextSteps: [
                                            'Use `/chat <message>` to start a conversation with this agent',
                                            'Use `/new "Title" --with-conversation` to create documents with AI assistance',
                                            'The agent will provide specialized guidance based on its expertise',
                                            'Use `/agent current` to confirm the active agent'
                                        ]
                                    });
                                } else {
                                    const agents = agentManager.listAgents();
                                    const availableAgents = agents.map((a: any) => a.name);
                                    this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                        type: 'error',
                                        title: 'Invalid Agent Name',
                                        message: `Agent "${agentName}" is not available.`,
                                        details: [
                                            'Available agents:',
                                            ...availableAgents.map((agent: string) => `• ${agent}`)
                                        ],
                                        nextSteps: [
                                            'Use `/agent list` to see all available agents',
                                            'Check the agent name spelling',
                                            'Use `/agent set <valid-agent-name>`'
                                        ]
                                    });
                                }
                            } catch (error) {
                                this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                    type: 'error',
                                    title: 'Agent Manager Error',
                                    message: `Error setting agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                    nextSteps: [
                                        'Try the command again',
                                        'Check VS Code output panel for detailed error information',
                                        'Use `/help agent` for command syntax'
                                    ]
                                });
                            }
                            break;
                            
                        case 'current':
                            try {
                                const currentAgent = this.agentManager.getCurrentAgent();
                                if (currentAgent) {
                                    this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                        type: 'success',
                                        title: '🤖 Current Agent Status',
                                        message: `Agent "${currentAgent.name}" is currently active.`,
                                        details: [
                                            `**Active Agent:** ${currentAgent.name}`,
                                            `**Description:** ${(currentAgent as any).description || 'AI Assistant'}`,
                                            `**Status:** Ready for conversations and document assistance`
                                        ],
                                        nextSteps: [
                                            'Use `/chat <message>` to start a conversation with this agent',
                                            'Use `/new "Title" --with-conversation` to create documents with AI assistance',
                                            'Use `/agent set <name>` to switch to a different agent'
                                        ]
                                    });
                                } else {
                                    this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                        type: 'info',
                                        title: '🤖 Current Agent Status',
                                        message: 'No agent is currently active.',
                                        details: [
                                            '**Status:** No active agent',
                                            '**Impact:** AI conversations and assistance are not available',
                                            '**Recommendation:** Set an agent to enable AI features'
                                        ],
                                        nextSteps: [
                                            'Use `/agent list` to see available agents',
                                            'Use `/agent set <agent-name>` to activate an agent',
                                            'Use `/new "Title" --with-conversation` for automatic agent selection',
                                            'Different document templates will suggest appropriate agents'
                                        ]
                                    });
                                }
                            } catch (error) {
                                this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                    type: 'error',
                                    title: 'Agent Manager Error',
                                    message: `Error getting current agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                    nextSteps: [
                                        'Try the command again',
                                        'Check VS Code output panel for detailed error information'
                                    ]
                                });
                            }
                            break;
                            
                        default:
                            this.outputCoordinator.registerPrimaryOutput('agent-command', {
                                type: 'error',
                                title: 'Unknown Subcommand',
                                message: `Unknown agent subcommand: "${subcommand}"`,
                                nextSteps: [
                                    'Use `/agent list` to list available agents',
                                    'Use `/agent set <name>` to set an active agent',
                                    'Use `/agent current` to check current agent status',
                                    'Use `/help agent` for more information'
                                ]
                            });
                    }
                } catch (error) {
                    this.outputCoordinator.registerPrimaryOutput('agent-command', {
                        type: 'error',
                        title: 'Agent Command Error',
                        message: `Error executing agent command: ${error instanceof Error ? error.message : String(error)}`,
                        nextSteps: [
                            'Try the command again',
                            'Use `/help agent` for command syntax',
                            'Check VS Code output panel for detailed error information'
                        ]
                    });
                }
                
                await this.outputCoordinator.render(context.stream);
                return { success: true };
            }
        });

        // New command
        this.registerCommand({
            name: 'new',
            description: 'Create a new document',
            usage: '/new <title> [--template <template-id>] [--path <output-path>] [--with-conversation]',
            examples: [
                '/new "My Product Requirements"',
                '/new "API Design" --template basic',
                '/new "User Guide" --template basic --path docs/user-guide.md',
                '/new "PRD Document" --template prd --with-conversation'
            ],
            flags: [
                {
                    name: 'template',
                    shortName: 't',
                    description: 'Template to use for the document',
                    type: 'string',
                    defaultValue: 'basic'
                },
                {
                    name: 'path',
                    shortName: 'p',
                    description: 'Output path for the document',
                    type: 'string'
                },
                {
                    name: 'with-conversation',
                    shortName: 'wc',
                    description: 'Start AI conversation after creating document',
                    type: 'boolean',
                    defaultValue: false
                },
                {
                    name: 'no-conversation',
                    shortName: 'nc',
                    description: 'Disable conversation suggestions',
                    type: 'boolean',
                    defaultValue: false
                }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                return await this.newCommandHandler.execute(parsedCommand, context);
            }
        });

        // Update command
        this.registerCommand({
            name: 'update',
            description: 'Update an existing document',
            usage: '/update --file <path> --section <header> [--mode <mode>] <content>',
            examples: [
                '/update --file README.md --section "Installation" "Run npm install"',
                '/update --file docs/api.md --section "Authentication" --mode append "New auth method"'
            ],
            flags: [
                {
                    name: 'file',
                    shortName: 'f',
                    description: 'Path to the file to update',
                    type: 'string',
                    required: true
                },
                {
                    name: 'section',
                    shortName: 's',
                    description: 'Section header to update',
                    type: 'string',
                    required: true
                },
                {
                    name: 'mode',
                    shortName: 'm',
                    description: 'Update mode: replace, append, or prepend',
                    type: 'string',
                    defaultValue: 'replace'
                }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                this.outputCoordinator.registerPrimaryOutput('update-command', {
                    type: 'info',
                    title: 'Update Command',
                    message: 'Update document command implementation is pending.',
                    details: [
                        'This command will allow you to:',
                        '• Update specific sections of existing documents',
                        '• Replace, append, or prepend content to sections',
                        '• Maintain document structure and formatting'
                    ],
                    nextSteps: [
                        'This feature will be available in a future update',
                        'For now, edit documents manually in VS Code',
                        'Use `/new` to create new documents with proper structure'
                    ]
                });
                
                await this.outputCoordinator.render(context.stream);
                return { success: true };
            }
        });

        // Review command
        this.registerCommand({
            name: 'review',
            description: 'Review a document for quality and consistency',
            usage: '/review --file <path> [--level <level>] [--fix]',
            examples: [
                '/review --file README.md',
                '/review --file docs/api.md --level strict',
                '/review --file requirements.md --fix'
            ],
            flags: [
                {
                    name: 'file',
                    shortName: 'f',
                    description: 'Path to the file to review',
                    type: 'string',
                    required: true
                },
                {
                    name: 'level',
                    shortName: 'l',
                    description: 'Review level: light, normal, or strict',
                    type: 'string',
                    defaultValue: 'normal'
                },
                {
                    name: 'fix',
                    description: 'Automatically apply suggested fixes',
                    type: 'boolean'
                }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                this.outputCoordinator.registerPrimaryOutput('review-command', {
                    type: 'info',
                    title: 'Review Command',
                    message: 'Review document command implementation is pending.',
                    details: [
                        'This command will provide:',
                        '• Quality assessment of document content',
                        '• Grammar and spelling checks',
                        '• Structure and completeness analysis',
                        '• Suggestions for improvement'
                    ],
                    nextSteps: [
                        'This feature will be available in a future update',
                        'For now, review documents manually',
                        'Use VS Code extensions for spell checking',
                        'Consider using `/chat` for AI-assisted review when available'
                    ]
                });
                
                await this.outputCoordinator.render(context.stream);
                return { success: true };
            }
        });
    }

    /**
     * Handle post-command feedback coordination
     */
    private async handlePostCommandFeedback(
        result: CommandResult,
        context: CommandContext,
        parsedCommand: ParsedCommand
    ): Promise<void> {
        // Handle conversation continuation using ConversationBridge
        if (result.success && this.conversationBridge) {
            const transitionResult = await this.conversationBridge.handleCommandToConversationTransition(
                result,
                parsedCommand.command,
                context
            );
            
            if (!transitionResult.success && transitionResult.error) {
                this.outputCoordinator.addSecondaryFeedback('conversation-error', {
                    type: 'warning',
                    content: `⚠️ **Conversation could not start:** ${transitionResult.error}`,
                    priority: 3
                });
                
                if (transitionResult.fallbackOptions) {
                    this.outputCoordinator.addSecondaryFeedback('conversation-fallback', {
                        type: 'guidance',
                        content: `🔧 **Alternative options:**\n${transitionResult.fallbackOptions.map(option => `• ${option}`).join('\n')}`,
                        priority: 2
                    });
                }
            } else if (transitionResult.success && transitionResult.sessionId) {
                this.outputCoordinator.addSecondaryFeedback('conversation-success', {
                    type: 'tip',
                    content: `🚀 **Conversation started successfully!** Session ID: ${transitionResult.sessionId}`,
                    priority: 5
                });
            }
        } else if (result.success) {
            // Provide completion guidance through coordinated feedback
            await this.provideCoordinatedCompletionGuidance(parsedCommand);
        }
    }

    /**
     * Handle conversation continuation after command execution (Legacy method - now uses ConversationBridge)
     * @deprecated Use ConversationBridge.handleCommandToConversationTransition instead
     */
    private async handleConversationContinuation(
        result: CommandResult,
        context: CommandContext
    ): Promise<void> {
        // This method is kept for backward compatibility but delegates to ConversationBridge
        if (this.conversationBridge) {
            const transitionResult = await this.conversationBridge.handleCommandToConversationTransition(
                result,
                'legacy-command',
                context
            );
            
            if (!transitionResult.success) {
                this.outputCoordinator.addSecondaryFeedback('conversation-fallback', {
                    type: 'guidance',
                    content: '💡 **Conversation could not start automatically.** You can start a conversation manually with `/chat <message>`',
                    priority: 10
                });
            }
            return;
        }

        // Fallback to old logic if ConversationBridge is not available
        if (!this.conversationFlowHandler || !this.conversationManager) {
            this.outputCoordinator.addSecondaryFeedback('conversation-fallback', {
                type: 'guidance',
                content: '💡 **Conversation handlers not available.** You can start a conversation manually with `/chat <message>`',
                priority: 10
            });
            return;
        }

        try {
            if (result.conversationConfig) {
                this.outputCoordinator.addSecondaryFeedback('conversation-start', {
                    type: 'conversation',
                    content: await this.formatConversationStartFeedback(result),
                    priority: 5
                });

                await this.conversationFlowHandler.startConversationFlow(
                    result.conversationConfig,
                    context
                );
            }
        } catch (error) {
            this.outputCoordinator.addSecondaryFeedback('conversation-error', {
                type: 'warning',
                content: await this.formatConversationErrorFeedback(error),
                priority: 3
            });

            if (result.conversationConfig && this.conversationManager) {
                await this.conversationManager.provideFallbackOptions(
                    result.conversationConfig,
                    context
                );
            }
        }
    }

    /**
     * Provide coordinated completion guidance
     */
    private async provideCoordinatedCompletionGuidance(
        parsedCommand: ParsedCommand
    ): Promise<void> {
        // Check if tips should be shown using consolidated OutputCoordinator
        const shouldShowTips = this.outputCoordinator.shouldShowTips(
            parsedCommand.command,
            parsedCommand.flags
        );

        if (shouldShowTips) {
            const tipProvider = CommandTipProvider.getInstance();
            const tips = tipProvider.getTipsForCommand(
                parsedCommand.command,
                parsedCommand.flags.template as string,
                parsedCommand.flags
            );

            if (tips.length > 0) {
                this.outputCoordinator.addTips('command-tips', tips);
            }
        }
    }

    /**
     * Format conversation start feedback
     */
    private async formatConversationStartFeedback(result: CommandResult): Promise<string> {
        const config = result.conversationConfig!;
        return `🚀 **Starting AI Conversation**
**Agent:** ${AgentUtils.getAgentDisplayName(config.agentName)}
**Document:** ${config.title || 'New Document'}

💬 **What happens next:**
- The AI agent will ask you questions to gather requirements
- Answer the questions to help create better documentation
- You can ask for clarification or provide additional details`;
    }

    /**
     * Format conversation error feedback
     */
    private async formatConversationErrorFeedback(error: any): Promise<string> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `⚠️ **Conversation could not start**

❌ **Issue:** ${errorMessage}

🔧 **You can still work on your document manually:**
- Open the document and edit it directly
- Use other Docu commands to help with specific sections
- Try starting a conversation later with \`/chat\``;
    }

    /**
     * Get agent description for display
     */
    private getAgentDescription(agentName: string): string {
        const descriptions: Record<string, string> = {
            'prd-creator': 'Specialized in Product Requirements Documents and product planning',
            'brainstormer': 'Expert in ideation, creative thinking, and brainstorming sessions',
            'requirements-gatherer': 'Focused on technical requirements gathering and analysis',
            'solution-architect': 'Designs system architecture and technical solutions',
            'quality-reviewer': 'Reviews documents for quality, completeness, and consistency',
            'specification-writer': 'Creates detailed implementation specifications and plans'
        };
        return descriptions[agentName] || 'AI assistant for document creation and management';
    }
}