import * as vscode from 'vscode';
import { LLMMessage, LLMRequest, LLMResponse, LLMStreamChunk, ModelInfo, LLMServiceConfig } from './types';

export class LLMService {
    private config: LLMServiceConfig;
    private availableModels: vscode.LanguageModelChat[] = [];

    constructor(config?: Partial<LLMServiceConfig>) {
        this.config = {
            defaultMaxTokens: 4000,
            defaultTemperature: 0.7,
            timeout: 30000,
            ...config
        };
    }

    /**
     * Initialize the service and discover available models
     */
    async initialize(): Promise<void> {
        try {
            // Get available Copilot models
            this.availableModels = await vscode.lm.selectChatModels({
                vendor: 'copilot'
            });

            console.log(`LLM Service initialized with ${this.availableModels.length} available models`);
        } catch (error) {
            console.error('Failed to initialize LLM Service:', error);
            throw new Error('GitHub Copilot is not available. Please ensure you have Copilot enabled.');
        }
    }

    /**
     * Get information about available models
     */
    getAvailableModels(): ModelInfo[] {
        return this.availableModels.map(model => ({
            id: model.id,
            name: model.name,
            vendor: model.vendor,
            family: model.family,
            maxTokens: model.maxInputTokens,
            available: true
        }));
    }

    /**
     * Select the best available model
     */
    private selectModel(): vscode.LanguageModelChat | null {
        if (this.availableModels.length === 0) {
            return null;
        }

        // If a preferred model is configured, try to use it
        if (this.config.preferredModel) {
            const preferred = this.availableModels.find(model => 
                model.id === this.config.preferredModel || 
                model.name === this.config.preferredModel
            );
            if (preferred) {
                return preferred;
            }
        }

        // Default to GPT-4 family if available, otherwise use the first available model
        const gpt4Model = this.availableModels.find(model => 
            model.family.toLowerCase().includes('gpt-4')
        );
        
        return gpt4Model || this.availableModels[0];
    }

    /**
     * Send a request to the language model
     */
    async sendRequest(
        request: LLMRequest, 
        cancellationToken?: vscode.CancellationToken
    ): Promise<LLMResponse> {
        const model = this.selectModel();
        if (!model) {
            throw new Error('No language models available');
        }

        try {
            // Convert our message format to VS Code's format
            const messages = request.messages.map(msg => 
                vscode.LanguageModelChatMessage.User(msg.content, msg.role)
            );

            // Create request options
            const options: vscode.LanguageModelChatRequestOptions = {
                justification: 'Generating documentation content for the Docu extension'
            };

            // Send the request
            const chatRequest = await model.sendRequest(messages, options, cancellationToken);
            
            let content = '';
            let finishReason: 'stop' | 'length' | 'cancelled' | 'error' = 'stop';

            // Read the response stream
            for await (const fragment of chatRequest.text) {
                if (cancellationToken?.isCancellationRequested) {
                    finishReason = 'cancelled';
                    break;
                }
                content += fragment;
            }

            return {
                content: content.trim(),
                finishReason,
                usage: {
                    promptTokens: 0, // VS Code API doesn't provide token counts
                    completionTokens: 0,
                    totalTokens: 0
                }
            };

        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                switch (error.code) {
                    case 'blocked':
                        throw new Error('Request was blocked by content filters');
                    case 'no-permissions':
                        throw new Error('No permissions to access language model');
                    default:
                        throw new Error(`Language model error: ${error.message}`);
                }
            }
            
            throw new Error(`Language model request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Send a streaming request to the language model
     */
    async sendStreamingRequest(
        request: LLMRequest,
        onChunk: (chunk: LLMStreamChunk) => void,
        cancellationToken?: vscode.CancellationToken
    ): Promise<void> {
        const model = this.selectModel();
        if (!model) {
            throw new Error('No language models available');
        }

        try {
            // Convert our message format to VS Code's format
            const messages = request.messages.map(msg => 
                vscode.LanguageModelChatMessage.User(msg.content, msg.role)
            );

            // Create request options
            const options: vscode.LanguageModelChatRequestOptions = {
                justification: 'Generating documentation content for the Docu extension'
            };

            // Send the request
            const chatRequest = await model.sendRequest(messages, options, cancellationToken);
            
            // Stream the response
            for await (const fragment of chatRequest.text) {
                if (cancellationToken?.isCancellationRequested) {
                    onChunk({ content: '', done: true });
                    return;
                }
                
                onChunk({ content: fragment, done: false });
            }

            // Signal completion
            onChunk({ content: '', done: true });

        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                switch (error.code) {
                    case 'blocked':
                        throw new Error('Request was blocked by content filters');
                    case 'no-permissions':
                        throw new Error('No permissions to access language model');
                    default:
                        throw new Error(`Language model error: ${error.message}`);
                }
            }
            
            throw new Error(`Language model request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create a simple text completion request
     */
    async complete(
        prompt: string,
        systemPrompt?: string,
        cancellationToken?: vscode.CancellationToken
    ): Promise<string> {
        const messages: LLMMessage[] = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        
        messages.push({ role: 'user', content: prompt });

        const response = await this.sendRequest({ messages }, cancellationToken);
        return response.content;
    }

    /**
     * Check if the service is available
     */
    isAvailable(): boolean {
        return this.availableModels.length > 0;
    }

    /**
     * Update service configuration
     */
    updateConfig(config: Partial<LLMServiceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): LLMServiceConfig {
        return { ...this.config };
    }
}