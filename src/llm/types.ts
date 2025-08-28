// Language Model service types
import * as vscode from 'vscode';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMRequest {
    messages: LLMMessage[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface LLMResponse {
    content: string;
    finishReason: 'stop' | 'length' | 'cancelled' | 'error';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMStreamChunk {
    content: string;
    done: boolean;
}

export interface ModelInfo {
    id: string;
    name: string;
    vendor: string;
    family: string;
    maxTokens: number;
    available: boolean;
}

export interface PromptTemplate {
    systemPrompt: string;
    userPromptTemplate: string;
    variables: Record<string, string>;
}

export interface LLMServiceConfig {
    preferredModel?: string;
    defaultMaxTokens: number;
    defaultTemperature: number;
    timeout: number;
}