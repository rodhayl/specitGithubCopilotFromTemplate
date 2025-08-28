// Tool for creating new template files
import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult } from './types';

export interface CreateTemplateParams {
    id: string;
    name?: string;
    description?: string;
    content?: string;
    variables?: Array<{
        name: string;
        description: string;
        required?: boolean;
        type?: string;
        defaultValue?: any;
    }>;
    agentRestrictions?: string[];
    interactive?: boolean;
}

export class CreateTemplateTool extends BaseTool {
    constructor() {
        super(
            'createTemplate',
            'Create a new user-defined template file',
            [
                {
                    name: 'id',
                    description: 'Unique identifier for the template',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'name',
                    description: 'Display name for the template',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'description',
                    description: 'Description of the template',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'content',
                    description: 'Template content with variables',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'variables',
                    description: 'JSON string of template variables',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'agentRestrictions',
                    description: 'JSON array of agent names that can use this template',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'interactive',
                    description: 'Whether to open interactive template creation wizard',
                    required: false,
                    type: 'boolean',
                    default: false
                }
            ]
        );
    }

    async execute(params: CreateTemplateParams, context: ToolContext): Promise<ToolResult> {
        this.log(`Creating template: ${params.id}`);

        // Validate parameters
        const validation = this.validateParameters(params);
        if (!validation.valid) {
            return this.createErrorResult(`Parameter validation failed: ${validation.errors.join(', ')}`);
        }

        // Validate template ID
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(params.id)) {
            return this.createErrorResult('Template ID must start with a letter and contain only letters, numbers, hyphens, and underscores');
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return this.createErrorResult('No workspace folder available to create template');
            }

            // Ensure templates directory exists
            const templateDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'docu', 'templates');
            try {
                await vscode.workspace.fs.createDirectory(templateDir);
            } catch {
                // Directory might already exist
            }

            // Check if template already exists
            const templatePath = vscode.Uri.joinPath(templateDir, `${params.id}.md`);
            try {
                await vscode.workspace.fs.stat(templatePath);
                return this.createErrorResult(`Template '${params.id}' already exists`);
            } catch {
                // Template doesn't exist, which is good
            }

            let templateContent: string;
            let variables: any[] = [];
            let agentRestrictions: string[] = [];

            // Parse variables if provided
            if (params.variables) {
                if (Array.isArray(params.variables)) {
                    variables = params.variables;
                } else if (typeof params.variables === 'string') {
                    try {
                        variables = JSON.parse(params.variables);
                    } catch (error) {
                        return this.createErrorResult('Invalid variables JSON format');
                    }
                }
            }

            // Parse agent restrictions if provided
            if (params.agentRestrictions) {
                if (Array.isArray(params.agentRestrictions)) {
                    agentRestrictions = params.agentRestrictions;
                } else if (typeof params.agentRestrictions === 'string') {
                    try {
                        agentRestrictions = JSON.parse(params.agentRestrictions);
                    } catch (error) {
                        return this.createErrorResult('Invalid agentRestrictions JSON format');
                    }
                }
            }

            if (params.interactive) {
                // Interactive mode - create a basic template and open for editing
                templateContent = this.createInteractiveTemplate(params, variables, agentRestrictions);
            } else {
                // Direct mode - create template with provided content
                templateContent = this.createTemplateContent(params, variables, agentRestrictions);
            }

            // Write template file
            const contentBuffer = Buffer.from(templateContent, 'utf8');
            await vscode.workspace.fs.writeFile(templatePath, contentBuffer);

            this.log(`Template created: ${templatePath.fsPath}`);

            // Open the template file for editing if interactive
            if (params.interactive) {
                const document = await vscode.workspace.openTextDocument(templatePath);
                await vscode.window.showTextDocument(document, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.One
                });
            }

            return this.createSuccessResult({
                templateId: params.id,
                filePath: templatePath.fsPath,
                relativePath: path.relative(context.workspaceRoot, templatePath.fsPath),
                interactive: params.interactive,
                variableCount: variables.length,
                hasAgentRestrictions: agentRestrictions.length > 0
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error creating template: ${errorMessage}`, 'error');
            return this.createErrorResult(`Failed to create template '${params.id}': ${errorMessage}`);
        }
    }

    private createTemplateContent(params: CreateTemplateParams, variables: any[], agentRestrictions: string[]): string {
        // Create front matter
        const frontMatter: any = {
            id: params.id,
            name: params.name || params.id,
            description: params.description || 'User-defined template'
        };

        if (variables.length > 0) {
            frontMatter.variables = variables;
        }

        if (agentRestrictions.length > 0) {
            frontMatter.agentRestrictions = agentRestrictions;
        }

        // Create template content
        let content = '---\n';
        content += yaml.dump(frontMatter);
        content += '---\n';
        
        if (params.content) {
            content += params.content;
        } else {
            // Default template content
            content += `# {{title}}\n\n`;
            content += `Created: {{currentDate}}\n`;
            content += `Author: {{author}}\n\n`;
            content += `## Overview\n\n`;
            content += `{{overview}}\n\n`;
            content += `## Details\n\n`;
            content += `{{details}}\n\n`;
            content += `## Next Steps\n\n`;
            content += `{{nextSteps}}\n`;

            // Add default variables if none provided
            if (variables.length === 0) {
                frontMatter.variables = [
                    {
                        name: 'title',
                        description: 'Document title',
                        required: true,
                        type: 'string'
                    },
                    {
                        name: 'overview',
                        description: 'Document overview',
                        required: true,
                        type: 'string'
                    },
                    {
                        name: 'details',
                        description: 'Detailed information',
                        required: false,
                        type: 'string',
                        defaultValue: 'Add details here...'
                    },
                    {
                        name: 'nextSteps',
                        description: 'Next steps or action items',
                        required: false,
                        type: 'string',
                        defaultValue: 'Define next steps...'
                    }
                ];

                // Regenerate content with updated front matter
                content = '---\n';
                content += yaml.dump(frontMatter);
                content += '---\n';
                content += `# {{title}}\n\n`;
                content += `Created: {{currentDate}}\n`;
                content += `Author: {{author}}\n\n`;
                content += `## Overview\n\n`;
                content += `{{overview}}\n\n`;
                content += `## Details\n\n`;
                content += `{{details}}\n\n`;
                content += `## Next Steps\n\n`;
                content += `{{nextSteps}}\n`;
            }
        }

        return content;
    }

    private createInteractiveTemplate(params: CreateTemplateParams, variables: any[], agentRestrictions: string[]): string {
        // Create a template with helpful comments for interactive editing
        const frontMatter: any = {
            id: params.id,
            name: params.name || params.id,
            description: params.description || 'User-defined template'
        };

        if (variables.length > 0) {
            frontMatter.variables = variables;
        } else {
            // Add example variables with comments
            frontMatter.variables = [
                {
                    name: 'title',
                    description: 'Document title',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'overview',
                    description: 'Document overview',
                    required: true,
                    type: 'string'
                }
                // Add more variables as needed
            ];
        }

        if (agentRestrictions.length > 0) {
            frontMatter.agentRestrictions = agentRestrictions;
        }

        let content = '---\n';
        content += yaml.dump(frontMatter);
        content += '---\n\n';
        
        // Add helpful comments
        content += `<!-- Template: ${params.name || params.id} -->\n`;
        content += `<!-- Edit this template to customize it for your needs -->\n`;
        content += `<!-- Variables are defined in the front matter above -->\n`;
        content += `<!-- Use {{variableName}} to insert variables in your content -->\n\n`;
        
        if (params.content) {
            content += params.content;
        } else {
            // Interactive template with examples
            content += `# {{title}}\n\n`;
            content += `<!-- Replace this with your template content -->\n`;
            content += `<!-- Example variables: -->\n`;
            content += `Created: {{currentDate}}\n`;
            content += `Author: {{author}}\n\n`;
            content += `## Overview\n\n`;
            content += `{{overview}}\n\n`;
            content += `<!-- Add more sections as needed -->\n`;
            content += `<!-- Remember to define variables in the front matter above -->\n`;
        }

        return content;
    }
}