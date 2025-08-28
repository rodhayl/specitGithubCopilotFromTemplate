// Command system types
import * as vscode from 'vscode';

export interface ParsedCommand {
    command: string;
    subcommand?: string;
    arguments: string[];
    flags: Record<string, string | boolean>;
    rawInput: string;
}

export interface CommandDefinition {
    name: string;
    description: string;
    usage: string;
    examples: string[];
    subcommands?: SubcommandDefinition[];
    flags?: FlagDefinition[];
    handler: CommandHandler;
}

export interface SubcommandDefinition {
    name: string;
    description: string;
    usage: string;
    examples: string[];
    flags?: FlagDefinition[];
}

export interface FlagDefinition {
    name: string;
    shortName?: string;
    description: string;
    type: 'string' | 'boolean' | 'number';
    required?: boolean;
    defaultValue?: any;
}

export interface CommandContext {
    request: vscode.ChatRequest;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
    workspaceRoot: string;
    extensionContext: vscode.ExtensionContext;
}

export interface CommandResult {
    success: boolean;
    message?: string;
    data?: any;
    error?: string;
    metadata?: {
        recoveryOptions?: string[];
        [key: string]: any;
    };
}

export type CommandHandler = (
    parsedCommand: ParsedCommand,
    context: CommandContext
) => Promise<CommandResult>;