// Tool system type definitions
import * as vscode from 'vscode';

export interface Tool {
    name: string;
    description: string;
    parameters: ToolParameter[];
    execute(params: any, context: ToolContext): Promise<ToolResult>;
}

export interface ToolParameter {
    name: string;
    type: 'string' | 'boolean' | 'number' | 'array';
    description: string;
    required: boolean;
    default?: any;
}

export interface ToolContext {
    workspaceRoot: string;
    extensionContext: vscode.ExtensionContext;
    cancellationToken?: vscode.CancellationToken;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
    metadata?: Record<string, any>;
}

export interface FileMetadata {
    path: string;
    size: number;
    mtime: Date;
    exists: boolean;
    isDirectory: boolean;
}

export interface FileOperationResult extends ToolResult {
    path?: string;
    bytes?: number;
    created?: boolean;
    modified?: boolean;
}