// Tool management system
import { Tool, ToolContext, ToolResult } from './types';
import { ReadFileTool } from './ReadFileTool';
import { WriteFileTool } from './WriteFileTool';
import { ListFilesTool } from './ListFilesTool';
import { OpenInEditorTool } from './OpenInEditorTool';
import { ApplyTemplateTool } from './ApplyTemplateTool';
import { ListTemplatesTool } from './ListTemplatesTool';
import { OpenTemplateTool } from './OpenTemplateTool';
import { ValidateTemplateTool } from './ValidateTemplateTool';
import { CreateTemplateTool } from './CreateTemplateTool';
import { InsertSectionTool } from './InsertSectionTool';
import { TemplateManager } from '../templates';
import { Logger } from '../logging/Logger';

export class ToolManager {
    private tools: Map<string, Tool> = new Map();
    private logger: Logger;

    constructor(private templateManager?: TemplateManager) {
        this.logger = Logger.getInstance();
        this.registerBuiltinTools();
    }

    /**
     * Register a tool with the manager
     */
    registerTool(tool: Tool): void {
        this.tools.set(tool.name, tool);
        this.logger.extension.debug(`Registered tool: ${tool.name}`);
    }

    /**
     * Get a tool by name
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Check if a tool exists
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * List all available tools
     */
    listTools(): Array<{ name: string; description: string; parameters: import('./types').ToolParameter[] }> {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    /**
     * Execute a tool with parameters and comprehensive error handling
     */
    async executeTool(toolName: string, parameters: any, context: ToolContext): Promise<ToolResult> {
        const tool = this.tools.get(toolName);
        
        if (!tool) {
            return {
                success: false,
                error: `Tool '${toolName}' not found`,
                metadata: {
                    availableTools: Array.from(this.tools.keys()),
                    requestedTool: toolName
                }
            };
        }

        try {
            // Use enhanced error handling if available (BaseTool subclasses)
            if ('executeWithErrorHandling' in tool && typeof tool.executeWithErrorHandling === 'function') {
                const result = await (tool as any).executeWithErrorHandling(parameters, context);
                return this.standardizeResult(result, toolName);
            }
            
            // Fallback to regular execution
            const result = await tool.execute(parameters, context);
            return this.standardizeResult(result, toolName);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.logger.extension.error(`Tool execution error [${toolName}]`, error as Error);

            return {
                success: false,
                error: `Tool '${toolName}' execution failed: ${errorMessage}`,
                metadata: {
                    toolName,
                    errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Standardize tool execution results
     */
    private standardizeResult(result: ToolResult, toolName: string): ToolResult {
        return {
            success: result.success !== false, // Default to true if not explicitly false
            data: result.data,
            error: result.error,
            metadata: {
                ...result.metadata,
                toolName,
                executionTime: Date.now()
            }
        };
    }

    /**
     * Validate that all required tools are available
     */
    validateToolAvailability(requiredTools: string[]): { valid: boolean; missing: string[] } {
        const missing = requiredTools.filter(toolName => !this.tools.has(toolName));
        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Get tool documentation
     */
    getToolDocumentation(toolName: string): string | undefined {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return undefined;
        }

        let doc = `**${tool.name}**\n${tool.description}\n\n**Parameters:**\n`;
        
        for (const param of tool.parameters) {
            const required = param.required ? ' (required)' : ' (optional)';
            const defaultValue = param.default !== undefined ? ` [default: ${param.default}]` : '';
            doc += `- **${param.name}** (${param.type})${required}: ${param.description}${defaultValue}\n`;
        }

        return doc;
    }

    private registerBuiltinTools(): void {
        // Register all built-in tools
        this.registerTool(new ReadFileTool());
        this.registerTool(new WriteFileTool());
        this.registerTool(new ListFilesTool());
        this.registerTool(new OpenInEditorTool());
        this.registerTool(new InsertSectionTool(
            'insertSection',
            'Insert or update a section in a markdown document',
            [
                { name: 'path', type: 'string', required: true, description: 'Path to the markdown file' },
                { name: 'header', type: 'string', required: true, description: 'Section header to insert or update' },
                { name: 'content', type: 'string', required: true, description: 'Content to insert' },
                { name: 'mode', type: 'string', required: false, description: 'Insert mode: replace, append, or prepend' }
            ]
        ));
        
        // Register template tools if template manager is available
        if (this.templateManager) {
            try {
                // Verify template manager is ready
                this.templateManager.getTemplates();

                this.registerTool(new ListTemplatesTool(this.templateManager));
                this.registerTool(new ValidateTemplateTool(this.templateManager));
                this.registerTool(new OpenTemplateTool(this.templateManager));
                this.registerTool(new ApplyTemplateTool(this.templateManager));
            } catch (error) {
                this.logger.extension.warn('Template tools registration failed', error as Error);
                // Continue with basic tools only
            }
        }
        
        // Register CreateTemplateTool (doesn't need template manager)
        this.registerTool(new CreateTemplateTool());
    }
}