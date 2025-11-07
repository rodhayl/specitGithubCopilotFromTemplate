// Tool for opening template files in editor
import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult } from './types';
import { TemplateManager } from '../templates';

export interface OpenTemplateParams {
    templateId: string;
    mode?: 'edit' | 'view';
}

/**
 * OpenTemplateTool - Opens template files for editing
 *
 * Opens template files in the VS Code editor for customization and management.
 * Supports both built-in and custom templates.
 */
export class OpenTemplateTool extends BaseTool {
    constructor(private templateManager: TemplateManager) {
        super(
            'openTemplate',
            'Open a template file in the editor for viewing or editing',
            [
                {
                    name: 'templateId',
                    description: 'ID of the template to open',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'mode',
                    description: 'Open mode: edit or view',
                    required: false,
                    type: 'string',
                    default: 'view'
                }
            ]
        );
    }

    protected getRequirements() {
        return {
            requiresWorkspace: false,
            requiresFileSystem: true,
            workspaceOptional: true,
            gracefulDegradation: {
                withoutWorkspace: ['Built-in templates only'],
                withWorkspace: ['Built-in and user templates']
            }
        };
    }

    async execute(params: OpenTemplateParams, context: ToolContext): Promise<ToolResult> {
        this.log(`Opening template: ${params.templateId}`);

        // Validate parameters
        const validation = this.validateParameters(params);
        if (!validation.valid) {
            return this.createErrorResult(`Parameter validation failed: ${validation.errors.join(', ')}`);
        }

        try {
            const template = this.templateManager.getTemplate(params.templateId);
            if (!template) {
                return this.createErrorResult(`Template '${params.templateId}' not found`);
            }

            const templates = this.templateManager.getTemplates();
            const templateMetadata = templates.find(t => t.id === params.templateId);
            const isBuiltIn = templateMetadata?.builtIn || false;

            let documentUri: vscode.Uri;
            let documentContent: string;

            if (isBuiltIn) {
                // For built-in templates, create a temporary document
                documentContent = this.formatTemplateForViewing(template, isBuiltIn);
                documentUri = vscode.Uri.parse(`untitled:Template-${params.templateId}.md`);
                
                // Create and show the document
                const document = await vscode.workspace.openTextDocument({
                    content: documentContent,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(document, {
                    preview: params.mode === 'view',
                    viewColumn: vscode.ViewColumn.One
                });

                return this.createSuccessResult({
                    templateId: params.templateId,
                    mode: params.mode,
                    isBuiltIn: true,
                    opened: true,
                    message: 'Built-in template opened in read-only mode'
                });

            } else {
                // For user templates, try to find the actual file
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    return this.createErrorResult('No workspace folder available to locate user template');
                }

                // Look for the template file in the templates directory
                const templateDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'docu', 'templates');
                const possibleExtensions = ['.md', '.yaml', '.yml'];
                
                let templateFileUri: vscode.Uri | null = null;
                
                for (const ext of possibleExtensions) {
                    const candidateUri = vscode.Uri.joinPath(templateDir, `${params.templateId}${ext}`);
                    try {
                        await vscode.workspace.fs.stat(candidateUri);
                        templateFileUri = candidateUri;
                        break;
                    } catch {
                        // File doesn't exist, try next extension
                    }
                }

                if (templateFileUri) {
                    // Open the actual template file
                    const document = await vscode.workspace.openTextDocument(templateFileUri);
                    await vscode.window.showTextDocument(document, {
                        preview: params.mode === 'view',
                        viewColumn: vscode.ViewColumn.One
                    });

                    return this.createSuccessResult({
                        templateId: params.templateId,
                        mode: params.mode,
                        isBuiltIn: false,
                        filePath: templateFileUri.fsPath,
                        opened: true,
                        message: 'User template file opened for editing'
                    });
                } else {
                    // Template exists in memory but file not found, create a temporary document
                    documentContent = this.formatTemplateForViewing(template, false);
                    documentUri = vscode.Uri.parse(`untitled:Template-${params.templateId}.md`);
                    
                    const document = await vscode.workspace.openTextDocument({
                        content: documentContent,
                        language: 'markdown'
                    });
                    
                    await vscode.window.showTextDocument(document, {
                        preview: params.mode === 'view',
                        viewColumn: vscode.ViewColumn.One
                    });

                    return this.createSuccessResult({
                        templateId: params.templateId,
                        mode: params.mode,
                        isBuiltIn: false,
                        opened: true,
                        message: 'Template opened in temporary document (original file not found)'
                    });
                }
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error opening template: ${errorMessage}`, 'error');
            return this.createErrorResult(`Failed to open template '${params.templateId}': ${errorMessage}`);
        }
    }

    private formatTemplateForViewing(template: any, isBuiltIn: boolean): string {
        let content = '';
        
        // Add header with template information
        content += `<!-- Template: ${template.name} -->\n`;
        content += `<!-- ID: ${template.id} -->\n`;
        content += `<!-- Description: ${template.description} -->\n`;
        content += `<!-- Built-in: ${isBuiltIn ? 'Yes' : 'No'} -->\n`;
        
        if (template.agentRestrictions && template.agentRestrictions.length > 0) {
            content += `<!-- Agent Restrictions: ${template.agentRestrictions.join(', ')} -->\n`;
        }
        
        content += `\n`;

        // Add variables documentation
        if (template.variables && template.variables.length > 0) {
            content += `<!-- Variables:\n`;
            for (const variable of template.variables) {
                const required = variable.required ? ' (required)' : ' (optional)';
                const defaultValue = variable.defaultValue ? ` [default: ${variable.defaultValue}]` : '';
                content += `  - ${variable.name} (${variable.type})${required}: ${variable.description}${defaultValue}\n`;
            }
            content += `-->\n\n`;
        }

        // Add the actual template content
        content += template.content;

        return content;
    }
}