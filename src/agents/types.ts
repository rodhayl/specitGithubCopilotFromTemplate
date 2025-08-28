// Agent system type definitions
import * as vscode from 'vscode';

export type WorkflowPhase = 'prd' | 'requirements' | 'design' | 'implementation';

export interface Agent {
    name: string;
    systemPrompt: string;
    allowedTools: string[];
    workflowPhase: WorkflowPhase;
    handleRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse>;
}

export interface ChatRequest {
    command?: string;
    prompt: string;
    parameters: Record<string, string>;
    originalRequest: vscode.ChatRequest;
}

export interface AgentContext {
    workspaceRoot: string;
    currentDocument?: string;
    previousOutputs: string[];
    userPreferences: UserPreferences;
    workflowState: WorkflowState;
    extensionContext: vscode.ExtensionContext;
    toolManager?: any; // ToolManager instance
    toolContext?: any; // Tool execution context
}

export interface AgentResponse {
    content?: string;
    toolCalls?: ToolCall[];
    followupSuggestions?: string[];
    workflowTransition?: WorkflowPhase;
    success?: boolean;
    message?: string;
    data?: any;
}

export interface ToolCall {
    tool: string;
    parameters: Record<string, any>;
}

export interface WorkflowState {
    projectId: string;
    currentPhase: WorkflowPhase;
    activeAgent: string;
    documents: {
        prd?: string;
        requirements?: string;
        design?: string;
        tasks?: string;
    };
    context: Record<string, any>;
    history: WorkflowEvent[];
}

export interface WorkflowEvent {
    timestamp: Date;
    event: string;
    data: Record<string, any>;
}

export interface UserPreferences {
    defaultDirectory: string;
    defaultAgent: string;
    templateDirectory?: string;
}

export interface AgentConfiguration {
    name: string;
    systemPrompt: string;
    allowedTools: string[];
    workflowPhase: WorkflowPhase;
    description?: string;
    enabled?: boolean;
}