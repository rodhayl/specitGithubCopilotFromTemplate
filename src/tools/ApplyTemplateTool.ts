import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult } from './types';
import { TemplateManager, TemplateRenderContext } from '../templates';

export interface ApplyTemplateParams {
    templateId: string;
    variables: Record<string, any> | string;
    outputPath?: string;
}

export class ApplyTemplateTool extends BaseTool {
    constructor(private templateManager: TemplateManager) {
        super(
            'applyTemplate',
            'Apply a template with variable substitution and generate content',
            [
                {
                    name: 'templateId',
                    description: 'ID of the template to apply',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'variables',
                    description: 'Variables to substitute in the template (JSON object)',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'outputPath',
                    description: 'Optional path where to save the rendered template',
                    required: false,
                    type: 'string'
                }
            ]
        );
    }

    protected getRequirements() {
        return {
            requiresWorkspace: true,
            requiresFileSystem: true,
            workspaceOptional: false
        };
    }

    async execute(params: ApplyTemplateParams, context: ToolContext): Promise<ToolResult> {
        try {
            // Additional workspace validation with specific guidance for document creation
            if (!context.workspaceRoot || context.workspaceRoot.trim() === '') {
                return {
                    success: false,
                    error: 'Document creation requires a workspace folder to be open',
                    metadata: {
                        workspaceRequired: true,
                        guidance: {
                            action: 'Open a folder or workspace in VS Code to create documents',
                            alternatives: [
                                'Use File → Open Folder to open a project directory',
                                'Use File → Open Workspace to open a saved workspace file',
                                'Create a new folder and open it as a workspace'
                            ],
                            helpCommand: '/help workspace'
                        }
                    }
                };
            }

            // Validate template exists
            const template = this.templateManager.getTemplate(params.templateId);
            if (!template) {
                return {
                    success: false,
                    error: `Template '${params.templateId}' not found. Available templates: ${this.templateManager.getTemplates().map(t => t.id).join(', ')}`
                };
            }

            // Parse variables if they're provided as a string
            let variables: Record<string, any> = {};
            if (typeof params.variables === 'string') {
                try {
                    variables = JSON.parse(params.variables);
                } catch (parseError) {
                    return {
                        success: false,
                        error: `Invalid JSON in variables parameter: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
                    };
                }
            } else if (typeof params.variables === 'object' && params.variables !== null) {
                variables = params.variables;
            }

            // Prepare render context
            const renderContext: TemplateRenderContext = {
                variables,
                workspaceRoot: context.workspaceRoot,
                currentDate: new Date(),
                userInfo: {
                    name: vscode.workspace.getConfiguration('git').get('user.name'),
                    email: vscode.workspace.getConfiguration('git').get('user.email')
                }
            };

            // Render template
            const result = this.templateManager.renderTemplate(params.templateId, renderContext);
            if (!result) {
                return {
                    success: false,
                    error: 'Failed to render template'
                };
            }

            // If output path is specified, write to file
            if (params.outputPath) {
                const outputUri = vscode.Uri.file(params.outputPath);
                
                // Validate path is within workspace
                const relativePath = vscode.workspace.asRelativePath(outputUri);
                if (relativePath === params.outputPath) {
                    return {
                        success: false,
                        error: 'Output path must be within the workspace'
                    };
                }

                // Create front matter + content
                let fileContent = '';
                if (Object.keys(result.frontMatter).length > 0) {
                    const yaml = require('js-yaml');
                    fileContent = '---\n' + yaml.dump(result.frontMatter) + '---\n\n' + result.content;
                } else {
                    fileContent = result.content;
                }

                // Write file
                try {
                    await vscode.workspace.fs.writeFile(outputUri, Buffer.from(fileContent, 'utf8'));
                    
                    return {
                        success: true,
                        data: {
                            templateId: params.templateId,
                            outputPath: params.outputPath,
                            content: result.content,
                            frontMatter: result.frontMatter,
                            metadata: result.metadata,
                            bytesWritten: Buffer.byteLength(fileContent, 'utf8')
                        }
                    };
                } catch (writeError) {
                    return {
                        success: false,
                        error: `Failed to write file: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`
                    };
                }
            } else {
                // Return rendered content without writing to file
                return {
                    success: true,
                    data: {
                        templateId: params.templateId,
                        content: result.content,
                        frontMatter: result.frontMatter,
                        metadata: result.metadata
                    }
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}