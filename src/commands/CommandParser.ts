import { ParsedCommand, CommandDefinition, FlagDefinition } from './types';

export class CommandParser {
    private commands: Map<string, CommandDefinition> = new Map();

    /**
     * Register a command definition
     */
    registerCommand(definition: CommandDefinition): void {
        this.commands.set(definition.name, definition);
    }

    /**
     * Parse a command string into a structured command object
     */
    parseCommand(input: string): ParsedCommand {
        const trimmedInput = input.trim();
        
        // Check if it starts with a slash
        if (!trimmedInput.startsWith('/')) {
            throw new Error('Commands must start with a forward slash (/)');
        }

        // Remove the leading slash and split into tokens
        const tokens = this.tokenize(trimmedInput.substring(1));
        
        if (tokens.length === 0) {
            throw new Error('Empty command');
        }

        const command = tokens[0];
        let subcommand: string | undefined;
        let argumentStart = 1;

        // Check if the second token is a subcommand
        const commandDef = this.commands.get(command);
        if (commandDef && commandDef.subcommands && tokens.length > 1) {
            const potentialSubcommand = tokens[1];
            const subcommandDef = commandDef.subcommands.find(sc => sc.name === potentialSubcommand);
            if (subcommandDef) {
                subcommand = potentialSubcommand;
                argumentStart = 2;
            }
        }

        // Parse flags and arguments
        const { flags, arguments: args } = this.parseFlags(tokens.slice(argumentStart));

        return {
            command,
            subcommand,
            arguments: args,
            flags,
            rawInput: trimmedInput
        };
    }

    /**
     * Tokenize input string, respecting quoted strings
     */
    private tokenize(input: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            const nextChar = input[i + 1];

            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        return tokens;
    }

    /**
     * Parse flags and arguments from tokens
     */
    private parseFlags(tokens: string[]): { flags: Record<string, string | boolean>; arguments: string[] } {
        const flags: Record<string, string | boolean> = {};
        const args: string[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (token.startsWith('--')) {
                // Long flag
                const flagName = token.substring(2);
                const nextToken = tokens[i + 1];

                if (nextToken && !nextToken.startsWith('-')) {
                    // Flag with value
                    flags[flagName] = nextToken;
                    i++; // Skip next token
                } else {
                    // Boolean flag
                    flags[flagName] = true;
                }
            } else if (token.startsWith('-') && token.length > 1) {
                // Short flag(s)
                const flagChars = token.substring(1);
                
                for (let j = 0; j < flagChars.length; j++) {
                    const flagChar = flagChars[j];
                    
                    if (j === flagChars.length - 1) {
                        // Last flag in the group, might have a value
                        const nextToken = tokens[i + 1];
                        if (nextToken && !nextToken.startsWith('-')) {
                            flags[flagChar] = nextToken;
                            i++; // Skip next token
                        } else {
                            flags[flagChar] = true;
                        }
                    } else {
                        // Boolean flag in the middle of a group
                        flags[flagChar] = true;
                    }
                }
            } else {
                // Regular argument
                args.push(token);
            }
        }

        return { flags, arguments: args };
    }

    /**
     * Validate a parsed command against its definition
     */
    validateCommand(parsedCommand: ParsedCommand): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const commandDef = this.commands.get(parsedCommand.command);

        if (!commandDef) {
            errors.push(`Unknown command: ${parsedCommand.command}`);
            return { valid: false, errors };
        }

        // Validate subcommand if present
        if (parsedCommand.subcommand) {
            if (!commandDef.subcommands) {
                errors.push(`Command '${parsedCommand.command}' does not support subcommands`);
            } else {
                const subcommandDef = commandDef.subcommands.find(sc => sc.name === parsedCommand.subcommand);
                if (!subcommandDef) {
                    const availableSubcommands = commandDef.subcommands.map(sc => sc.name).join(', ');
                    errors.push(`Unknown subcommand '${parsedCommand.subcommand}' for command '${parsedCommand.command}'. Available: ${availableSubcommands}`);
                }
            }
        }

        // Get applicable flags (command + subcommand flags)
        const applicableFlags = this.getApplicableFlags(commandDef, parsedCommand.subcommand);

        // Validate flags
        for (const [flagName, flagValue] of Object.entries(parsedCommand.flags)) {
            const flagDef = applicableFlags.find(f => f.name === flagName || f.shortName === flagName);
            
            if (!flagDef) {
                errors.push(`Unknown flag: --${flagName}`);
                continue;
            }

            // Validate flag type
            if (flagDef.type === 'boolean' && typeof flagValue !== 'boolean') {
                errors.push(`Flag --${flagName} should be a boolean`);
            } else if (flagDef.type === 'string' && typeof flagValue !== 'string') {
                errors.push(`Flag --${flagName} should be a string`);
            } else if (flagDef.type === 'number' && typeof flagValue === 'string') {
                if (isNaN(Number(flagValue))) {
                    errors.push(`Flag --${flagName} should be a number`);
                }
            }
        }

        // Check required flags
        for (const flagDef of applicableFlags) {
            if (flagDef.required) {
                const flagPresent = parsedCommand.flags[flagDef.name] !== undefined || 
                                 (flagDef.shortName && parsedCommand.flags[flagDef.shortName] !== undefined);
                
                if (!flagPresent) {
                    errors.push(`Required flag --${flagDef.name} is missing`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Get applicable flags for a command and optional subcommand
     */
    private getApplicableFlags(commandDef: CommandDefinition, subcommand?: string): FlagDefinition[] {
        let flags = commandDef.flags || [];

        if (subcommand && commandDef.subcommands) {
            const subcommandDef = commandDef.subcommands.find(sc => sc.name === subcommand);
            if (subcommandDef && subcommandDef.flags) {
                flags = [...flags, ...subcommandDef.flags];
            }
        }

        return flags;
    }

    /**
     * Get help text for a command
     */
    getCommandHelp(commandName: string, subcommand?: string): string {
        const commandDef = this.commands.get(commandName);
        if (!commandDef) {
            return `Unknown command: ${commandName}`;
        }

        let help = `**${commandName}** - ${commandDef.description}\n\n`;
        help += `**Usage:** ${commandDef.usage}\n\n`;

        if (subcommand && commandDef.subcommands) {
            const subcommandDef = commandDef.subcommands.find(sc => sc.name === subcommand);
            if (subcommandDef) {
                help += `**Subcommand:** ${subcommand} - ${subcommandDef.description}\n`;
                help += `**Usage:** ${subcommandDef.usage}\n\n`;
            }
        }

        // Show flags
        const applicableFlags = this.getApplicableFlags(commandDef, subcommand);
        if (applicableFlags.length > 0) {
            help += '**Flags:**\n';
            for (const flag of applicableFlags) {
                const shortName = flag.shortName ? `, -${flag.shortName}` : '';
                const required = flag.required ? ' (required)' : '';
                const defaultValue = flag.defaultValue !== undefined ? ` [default: ${flag.defaultValue}]` : '';
                help += `- --${flag.name}${shortName} (${flag.type})${required}: ${flag.description}${defaultValue}\n`;
            }
            help += '\n';
        }

        // Show subcommands
        if (!subcommand && commandDef.subcommands && commandDef.subcommands.length > 0) {
            help += '**Subcommands:**\n';
            for (const sc of commandDef.subcommands) {
                help += `- **${sc.name}**: ${sc.description}\n`;
            }
            help += '\n';
        }

        // Show examples
        const examples = subcommand && commandDef.subcommands ? 
            commandDef.subcommands.find(sc => sc.name === subcommand)?.examples || [] :
            commandDef.examples;

        if (examples.length > 0) {
            help += '**Examples:**\n';
            for (const example of examples) {
                help += `- ${example}\n`;
            }
        }

        return help;
    }

    /**
     * Get all registered commands
     */
    getCommands(): CommandDefinition[] {
        return Array.from(this.commands.values());
    }

    /**
     * Check if a command exists
     */
    hasCommand(commandName: string): boolean {
        return this.commands.has(commandName);
    }
}