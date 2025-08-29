import { CommandParser } from './CommandParser';
import { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from './types';

export type { CommandContext } from './types';

export class CommandRouter {
    private parser: CommandParser;

    constructor() {
        this.parser = new CommandParser();
        this.registerBuiltInCommands();
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
        try {
            // Parse the command
            const parsedCommand = this.parser.parseCommand(input);

            // Validate the command
            const validation = this.parser.validateCommand(parsedCommand);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Command validation failed:\n${validation.errors.map(e => `- ${e}`).join('\n')}`
                };
            }

            // Find and execute the command handler
            const commandDef = this.parser.getCommands().find(cmd => cmd.name === parsedCommand.command);
            if (!commandDef) {
                return {
                    success: false,
                    error: `Command '${parsedCommand.command}' not found`
                };
            }

            // Execute the command
            return await commandDef.handler(parsedCommand, context);

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
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
                    // Show overview help
                    context.stream.markdown('# 🤖 Docu Assistant Help\n\n');
                    context.stream.markdown('Docu helps you create and manage documentation through specific commands.\n\n');
                    context.stream.markdown('## 🚀 Quick Start\n\n');
                    context.stream.markdown('1. `/agent set <name>` - Set an active agent\n');
                    context.stream.markdown('2. `/new "Document Title"` - Create a document\n');
                    context.stream.markdown('3. `/chat <message>` - Start conversation with agent\n\n');
                    context.stream.markdown('## 📋 Available Commands\n\n');
                    context.stream.markdown('- `/new` - Create new documents\n');
                    context.stream.markdown('- `/agent` - Manage AI agents\n');
                    context.stream.markdown('- `/chat` - Converse with active agent\n');
                    context.stream.markdown('- `/templates` - Manage templates\n');
                    context.stream.markdown('- `/update` - Update document sections\n');
                    context.stream.markdown('- `/review` - Review document quality\n');
                    context.stream.markdown('- `/summarize` - Generate summaries\n');
                    context.stream.markdown('- `/catalog` - Create document catalogs\n\n');
                    context.stream.markdown('💡 Use `/help <command>` for detailed help on specific commands.\n');
                } else {
                    const helpText = this.getHelp(commandName, subcommand);
                    context.stream.markdown(helpText);
                }
                
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
                // This will be implemented when we integrate with the template system
                context.stream.markdown('Templates command - implementation pending');
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
                // This will be implemented when we integrate with the agent system
                context.stream.markdown('Agent command - implementation pending');
                return { success: true };
            }
        });

        // New command
        this.registerCommand({
            name: 'new',
            description: 'Create a new document',
            usage: '/new <title> [--template <template-id>] [--path <output-path>] [--with-placeholders]',
            examples: [
                '/new "My Product Requirements"',
                '/new "API Design" --template basic',
                '/new "User Guide" --template basic --path docs/user-guide.md',
                '/new "PRD Document" --template prd --with-placeholders'
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
                    name: 'with-placeholders',
                    shortName: 'wp',
                    description: 'Create document with placeholder values for missing required variables',
                    type: 'boolean',
                    defaultValue: false
                }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
                // This will be implemented in the next task
                context.stream.markdown('New document command - implementation pending');
                return { success: true };
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
                // This will be implemented later
                context.stream.markdown('Update document command - implementation pending');
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
                // This will be implemented later
                context.stream.markdown('Review document command - implementation pending');
                return { success: true };
            }
        });
    }
}