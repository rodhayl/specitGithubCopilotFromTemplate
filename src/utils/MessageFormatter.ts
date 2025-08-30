import * as vscode from 'vscode';

export interface MessageContent {
    type: 'success' | 'error' | 'info' | 'warning' | 'progress';
    title: string;
    message: string;
    details?: string[];
    metadata?: Record<string, any>;
    actions?: MessageAction[];
}

export interface MessageAction {
    label: string;
    command?: string;
    args?: any[];
    primary?: boolean;
}

export interface ProgressMessage {
    title: string;
    message: string;
    progress?: number; // 0-100
    indeterminate?: boolean;
}

export interface MessageTheme {
    icons: Record<string, string>;
    colors: Record<string, string>;
    formatting: {
        headerLevel: number;
        useEmoji: boolean;
        includeDividers: boolean;
    };
}

/**
 * Unified message formatting system for consistent output across all components
 */
export class MessageFormatter {
    private static instance: MessageFormatter;
    private theme: MessageTheme;

    private constructor() {
        this.theme = this.getDefaultTheme();
    }

    static getInstance(): MessageFormatter {
        if (!MessageFormatter.instance) {
            MessageFormatter.instance = new MessageFormatter();
        }
        return MessageFormatter.instance;
    }

    /**
     * Formats a standard message for chat output
     */
    formatMessage(content: MessageContent): string {
        const icon = this.theme.icons[content.type] || this.theme.icons.info;
        const headerLevel = '#'.repeat(this.theme.formatting.headerLevel);
        let formatted = `${icon} ${headerLevel} ${content.title}\n\n`;
        formatted += `${content.message}\n`;

        // Add details if present
        if (content.details && content.details.length > 0) {
            formatted += '\n**Details:**\n';
            for (const detail of content.details) {
                formatted += `- ${detail}\n`;
            }
        }

        // Add metadata if present
        if (content.metadata && Object.keys(content.metadata).length > 0) {
            formatted += '\n**Information:**\n';
            for (const [key, value] of Object.entries(content.metadata)) {
                formatted += `- **${key}:** ${value}\n`;
            }
        }

        // Add actions if present
        if (content.actions && content.actions.length > 0) {
            formatted += '\n**Actions:**\n';
            for (const action of content.actions) {
                const actionIcon = action.primary ? '🔹' : '▫️';
                formatted += `${actionIcon} ${action.label}\n`;
            }
        }

        // Add divider if enabled
        if (this.theme.formatting.includeDividers) {
            formatted += '\n---\n';
        }

        return formatted;
    }

    /**
     * Formats a progress message
     */
    formatProgress(progress: ProgressMessage): string {
        const icon = this.theme.icons.progress;
        let formatted = `${icon} **${progress.title}**\n\n`;
        formatted += `${progress.message}\n`;

        if (progress.progress !== undefined && !progress.indeterminate) {
            const progressBar = this.createProgressBar(progress.progress);
            formatted += `\n${progressBar} ${progress.progress}%\n`;
        } else if (progress.indeterminate) {
            formatted += '\n⏳ Processing...\n';
        }

        return formatted;
    }

    /**
     * Formats an error message with recovery suggestions
     */
    formatError(error: Error, suggestions?: string[]): string {
        const content: MessageContent = {
            type: 'error',
            title: 'Error Occurred',
            message: error.message,
            details: suggestions ? ['**Recovery Suggestions:**', ...suggestions] : undefined
        };
        return this.formatMessage(content);
    }

    /**
     * Formats a success message with optional next steps
     */
    formatSuccess(title: string, message: string, nextSteps?: string[]): string {
        const content: MessageContent = {
            type: 'success',
            title,
            message,
            details: nextSteps ? ['**Next Steps:**', ...nextSteps] : undefined
        };
        return this.formatMessage(content);
    }

    /**
     * Formats a list of items with consistent styling
     */
    formatList(title: string, items: string[], type: 'ordered' | 'unordered' = 'unordered'): string {
        let formatted = `**${title}:**\n\n`;
        items.forEach((item, index) => {
            const prefix = type === 'ordered' ? `${index + 1}.` : '-';
            formatted += `${prefix} ${item}\n`;
        });
        return formatted;
    }

    /**
     * Formats a code block with syntax highlighting
     */
    formatCodeBlock(code: string, language?: string): string {
        const lang = language || '';
        return `\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }

    /**
     * Formats inline code
     */
    formatInlineCode(code: string): string {
        return `\`${code}\``;
    }

    /**
     * Formats a table from data
     */
    formatTable(headers: string[], rows: string[][]): string {
        let table = `| ${headers.join(' | ')} |\n`;
        table += `| ${headers.map(() => '---').join(' | ')} |\n`;
        for (const row of rows) {
            table += `| ${row.join(' | ')} |\n`;
        }
        return table;
    }

    /**
     * Formats a collapsible section
     */
    formatCollapsible(title: string, content: string): string {
        return `<details>\n<summary>${title}</summary>\n\n${content}\n</details>\n`;
    }

    /**
     * Formats multiple messages into a single coordinated output
     */
    formatMultipleMessages(messages: MessageContent[]): string {
        let formatted = '';
        messages.forEach((message, index) => {
            formatted += this.formatMessage(message);
            // Add spacing between messages except for the last one
            if (index < messages.length - 1) {
                formatted += '\n';
            }
        });
        return formatted;
    }

    /**
     * Renders formatted content to a chat stream
     */
    async renderToStream(stream: vscode.ChatResponseStream, content: string): Promise<void> {
        // Split content into chunks for better streaming experience
        const chunks = this.splitIntoChunks(content, 500);
        for (const chunk of chunks) {
            stream.markdown(chunk);
            // Small delay for better streaming effect
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    /**
     * Sets a custom theme
     */
    setTheme(theme: Partial<MessageTheme>): void {
        this.theme = { ...this.theme, ...theme };
    }

    /**
     * Gets the current theme
     */
    getTheme(): MessageTheme {
        return { ...this.theme };
    }

    private getDefaultTheme(): MessageTheme {
        return {
            icons: {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️',
                progress: '⏳'
            },
            colors: {
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                progress: '#6f42c1'
            },
            formatting: {
                headerLevel: 2,
                useEmoji: true,
                includeDividers: true
            }
        };
    }

    private createProgressBar(progress: number): string {
        const width = 20;
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    }

    private splitIntoChunks(content: string, maxChunkSize: number): string[] {
        const chunks: string[] = [];
        const lines = content.split('\n');
        let currentChunk = '';

        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        return chunks;
    }
}