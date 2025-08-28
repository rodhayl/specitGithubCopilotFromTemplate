import { LLMMessage, PromptTemplate } from './types';

export class PromptBuilder {
    private messages: LLMMessage[] = [];

    /**
     * Add a system message
     */
    system(content: string): PromptBuilder {
        this.messages.push({ role: 'system', content });
        return this;
    }

    /**
     * Add a user message
     */
    user(content: string): PromptBuilder {
        this.messages.push({ role: 'user', content });
        return this;
    }

    /**
     * Add an assistant message
     */
    assistant(content: string): PromptBuilder {
        this.messages.push({ role: 'assistant', content });
        return this;
    }

    /**
     * Apply a template with variable substitution
     */
    template(template: PromptTemplate, variables: Record<string, string> = {}): PromptBuilder {
        // Substitute variables in system prompt
        let systemPrompt = template.systemPrompt;
        for (const [key, value] of Object.entries({ ...template.variables, ...variables })) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            systemPrompt = systemPrompt.replace(regex, value);
        }

        // Substitute variables in user prompt template
        let userPrompt = template.userPromptTemplate;
        for (const [key, value] of Object.entries({ ...template.variables, ...variables })) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            userPrompt = userPrompt.replace(regex, value);
        }

        this.system(systemPrompt);
        this.user(userPrompt);
        return this;
    }

    /**
     * Add context from previous conversation
     */
    context(previousMessages: LLMMessage[]): PromptBuilder {
        this.messages.push(...previousMessages);
        return this;
    }

    /**
     * Add file content as context
     */
    fileContext(fileName: string, content: string, description?: string): PromptBuilder {
        const contextMessage = description 
            ? `Here is the content of ${fileName} (${description}):\n\n\`\`\`\n${content}\n\`\`\``
            : `Here is the content of ${fileName}:\n\n\`\`\`\n${content}\n\`\`\``;
        
        this.user(contextMessage);
        return this;
    }

    /**
     * Add workspace context
     */
    workspaceContext(workspaceInfo: {
        rootPath: string;
        files?: string[];
        currentFile?: string;
        projectType?: string;
    }): PromptBuilder {
        let contextMessage = `Workspace context:\n- Root path: ${workspaceInfo.rootPath}`;
        
        if (workspaceInfo.projectType) {
            contextMessage += `\n- Project type: ${workspaceInfo.projectType}`;
        }
        
        if (workspaceInfo.currentFile) {
            contextMessage += `\n- Current file: ${workspaceInfo.currentFile}`;
        }
        
        if (workspaceInfo.files && workspaceInfo.files.length > 0) {
            contextMessage += `\n- Available files: ${workspaceInfo.files.join(', ')}`;
        }

        this.user(contextMessage);
        return this;
    }

    /**
     * Add agent-specific instructions
     */
    agentInstructions(agentName: string, instructions: string): PromptBuilder {
        const message = `Instructions for ${agentName} agent:\n${instructions}`;
        this.system(message);
        return this;
    }

    /**
     * Add task-specific context
     */
    taskContext(task: string, requirements?: string[], constraints?: string[]): PromptBuilder {
        let contextMessage = `Task: ${task}`;
        
        if (requirements && requirements.length > 0) {
            contextMessage += `\n\nRequirements:\n${requirements.map(req => `- ${req}`).join('\n')}`;
        }
        
        if (constraints && constraints.length > 0) {
            contextMessage += `\n\nConstraints:\n${constraints.map(constraint => `- ${constraint}`).join('\n')}`;
        }

        this.user(contextMessage);
        return this;
    }

    /**
     * Build the final message array
     */
    build(): LLMMessage[] {
        return [...this.messages];
    }

    /**
     * Clear all messages
     */
    clear(): PromptBuilder {
        this.messages = [];
        return this;
    }

    /**
     * Get message count
     */
    getMessageCount(): number {
        return this.messages.length;
    }

    /**
     * Get estimated token count (rough approximation)
     */
    getEstimatedTokenCount(): number {
        const totalChars = this.messages.reduce((total, msg) => total + msg.content.length, 0);
        // Rough approximation: 1 token ≈ 4 characters
        return Math.ceil(totalChars / 4);
    }

    /**
     * Create a new builder instance
     */
    static create(): PromptBuilder {
        return new PromptBuilder();
    }

    /**
     * Create a builder with a system prompt
     */
    static withSystem(systemPrompt: string): PromptBuilder {
        return new PromptBuilder().system(systemPrompt);
    }

    /**
     * Create a builder from a template
     */
    static fromTemplate(template: PromptTemplate, variables?: Record<string, string>): PromptBuilder {
        return new PromptBuilder().template(template, variables);
    }
}