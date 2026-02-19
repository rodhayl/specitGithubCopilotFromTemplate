// Command system types
import * as vscode from 'vscode';
import { ToolManager } from '../tools/ToolManager';

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
    /**
     * The language model selected by the user in the chat UI (from vscode.ChatRequest.model).
     * Per VS Code API guidelines, chat participants should use this model rather than calling
     * vscode.lm.selectChatModels() independently, so the user's model choice is respected.
     */
    model?: vscode.LanguageModelChat;
    toolManager?: ToolManager;
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
    // Conversation continuation fields
    conversationConfig?: ConversationConfig;
    shouldContinueConversation?: boolean;
    agentName?: string;
    documentPath?: string;
    // Auto-chat integration
    autoChatEnabled?: boolean;
}

export interface ConversationConfig {
    agentName: string;
    templateId: string;
    documentPath: string;
    title: string;
    initialQuestions?: Question[];
    conversationContext: ConversationContext;
}

export interface Question {
    id: string;
    text: string;
    type: 'open-ended' | 'multiple-choice' | 'yes-no' | 'structured';
    examples?: string[];
    required: boolean;
    followupTriggers?: string[];
    category: string;
    priority: number;
}

export interface ConversationContext {
    documentType: string;
    workflowPhase: string;
    documentPath: string;
    title: string;
    workspaceRoot: string;
    extensionContext: vscode.ExtensionContext;
}

export type CommandHandler = (
    parsedCommand: ParsedCommand,
    context: CommandContext
) => Promise<CommandResult>;