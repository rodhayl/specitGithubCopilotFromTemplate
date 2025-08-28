import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult } from './types';
import { TemplateManager } from '../templates';

export interface ListTemplatesParams {
    agentName?: string;
    includeVariables?: boolean;
}

export class ListTemplatesTool extends BaseTool {
    constructor(private templateManager: TemplateManager) {
        super(
            'listTemplates',
            'List available templates, optionally filtered by agent',
            [
                {
                    name: 'agentName',
                    description: 'Optional agent name to filter templates',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'includeVariables',
                    description: 'Whether to include template variables in the response',
                    required: false,
                    type: 'boolean'
                }
            ]
        );
    }

    protected getRequirements() {
        return {
            requiresWorkspace: false,
            requiresFileSystem: false,
            workspaceOptional: true,
            gracefulDegradation: {
                withoutWorkspace: ['Built-in templates only'],
                withWorkspace: ['Built-in and user templates']
            }
        };
    }

    async execute(params: ListTemplatesParams, context: ToolContext): Promise<ToolResult> {
        try {
            // Check if workspace is available for user templates
            const hasWorkspace = !!(context.workspaceRoot && context.workspaceRoot.trim() !== '');
            
            // Load user templates if workspace is available
            if (hasWorkspace) {
                try {
                    await this.templateManager.loadUserTemplates();
                } catch (error) {
                    // Log warning but continue with built-in templates
                    this.log(`Warning: Could not load user templates: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn');
                }
            }

            let templates;
            
            if (params.agentName) {
                templates = this.templateManager.getTemplatesForAgent(params.agentName);
            } else {
                templates = this.templateManager.getTemplates();
            }

            const templateData = templates.map(template => {
                const data: any = {
                    id: template.id,
                    name: template.name,
                    description: template.description,
                    builtIn: template.builtIn
                };

                if (params.includeVariables) {
                    data.variables = template.variables.map(variable => ({
                        name: variable.name,
                        description: variable.description,
                        required: variable.required,
                        type: variable.type,
                        defaultValue: variable.defaultValue
                    }));
                }

                return data;
            });

            // Add workspace status information
            const builtInCount = templateData.filter(t => t.builtIn).length;
            const userCount = templateData.filter(t => !t.builtIn).length;

            return {
                success: true,
                data: {
                    templates: templateData,
                    count: templateData.length,
                    builtInCount,
                    userCount,
                    hasWorkspace,
                    workspaceStatus: hasWorkspace ? 'available' : 'not-available',
                    filteredBy: params.agentName ? `agent: ${params.agentName}` : 'none'
                },
                metadata: {
                    workspaceOptional: true,
                    gracefulDegradation: !hasWorkspace
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}