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

export interface ToolRequirements {
    requiresWorkspace: boolean;
    requiresFileSystem: boolean;
    workspaceOptional?: boolean;
    gracefulDegradation?: {
        withoutWorkspace: string[];
        withWorkspace: string[];
    };
}

export interface WorkspaceErrorResult extends ToolResult {
    success: false;
    error: string;
    errorType: 'workspace-required' | 'workspace-permissions' | 'workspace-invalid';
    guidance: {
        action: string;
        alternatives?: string[];
        helpCommand?: string;
    };
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