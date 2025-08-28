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

    async execute(params: ListTemplatesParams, context: ToolContext): Promise<ToolResult> {
        try {
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

            return {
                success: true,
                data: {
                    templates: templateData,
                    count: templateData.length,
                    filteredBy: params.agentName ? `agent: ${params.agentName}` : 'none'
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