// Tool for validating template files
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult } from './types';
import { TemplateManager } from '../templates';

export interface ValidateTemplateParams {
    templateId?: string;
    filePath?: string;
    content?: string;
}

export interface ValidationIssue {
    type: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    suggestion?: string;
}

export class ValidateTemplateTool extends BaseTool {
    constructor(private templateManager: TemplateManager) {
        super(
            'validateTemplate',
            'Validate template syntax, variables, and structure',
            [
                {
                    name: 'templateId',
                    description: 'ID of existing template to validate',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'filePath',
                    description: 'Path to template file to validate',
                    required: false,
                    type: 'string'
                },
                {
                    name: 'content',
                    description: 'Template content to validate directly',
                    required: false,
                    type: 'string'
                }
            ]
        );
    }

    async execute(params: ValidateTemplateParams, context: ToolContext): Promise<ToolResult> {
        this.log('Validating template');

        // Validate parameters - at least one must be provided
        if (!params.templateId && !params.filePath && !params.content) {
            return this.createErrorResult('At least one of templateId, filePath, or content must be provided');
        }

        try {
            let templateContent: string;
            let templateId: string;
            let source: string;

            if (params.templateId) {
                const template = this.templateManager.getTemplate(params.templateId);
                if (!template) {
                    return this.createErrorResult(`Template '${params.templateId}' not found`);
                }
                templateContent = this.reconstructTemplateFile(template);
                templateId = params.templateId;
                source = `template: ${templateId}`;
            } else if (params.filePath) {
                const pathValidation = this.validateWorkspacePath(params.filePath, context.workspaceRoot);
                if (!pathValidation.valid) {
                    return this.createErrorResult(pathValidation.error!);
                }

                const fileUri = vscode.Uri.file(params.filePath);
                const fileData = await vscode.workspace.fs.readFile(fileUri);
                templateContent = Buffer.from(fileData).toString('utf8');
                templateId = params.filePath;
                source = `file: ${params.filePath}`;
            } else {
                templateContent = params.content!;
                templateId = 'inline';
                source = 'inline content';
            }

            const issues = this.validateTemplateContent(templateContent);
            const isValid = !issues.some(issue => issue.type === 'error');

            return this.createSuccessResult({
                valid: isValid,
                issues,
                source,
                templateId,
                summary: {
                    errors: issues.filter(i => i.type === 'error').length,
                    warnings: issues.filter(i => i.type === 'warning').length,
                    info: issues.filter(i => i.type === 'info').length
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error validating template: ${errorMessage}`, 'error');
            return this.createErrorResult(`Template validation failed: ${errorMessage}`);
        }
    }

    private validateTemplateContent(content: string): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const lines = content.split('\n');

        // Check for YAML front matter
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        
        if (frontMatterMatch) {
            const frontMatterContent = frontMatterMatch[1];
            const templateBody = frontMatterMatch[2];

            // Validate YAML syntax
            try {
                const frontMatter = yaml.load(frontMatterContent) as any;
                this.validateFrontMatter(frontMatter, issues);
            } catch (error) {
                issues.push({
                    type: 'error',
                    message: `Invalid YAML front matter: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    suggestion: 'Check YAML syntax and indentation'
                });
            }

            // Validate template body
            this.validateTemplateBody(templateBody, issues);
        } else {
            // No front matter, validate entire content as template body
            this.validateTemplateBody(content, issues);
            issues.push({
                type: 'info',
                message: 'Template has no YAML front matter',
                suggestion: 'Consider adding front matter with template metadata'
            });
        }

        // Check for common issues
        this.checkCommonIssues(content, issues);

        return issues;
    }

    private validateFrontMatter(frontMatter: any, issues: ValidationIssue[]): void {
        // Check required fields
        if (!frontMatter.id) {
            issues.push({
                type: 'warning',
                message: 'Template ID not specified in front matter',
                suggestion: 'Add "id" field to front matter'
            });
        }

        if (!frontMatter.name) {
            issues.push({
                type: 'warning',
                message: 'Template name not specified in front matter',
                suggestion: 'Add "name" field to front matter'
            });
        }

        if (!frontMatter.description) {
            issues.push({
                type: 'info',
                message: 'Template description not specified',
                suggestion: 'Add "description" field to front matter'
            });
        }

        // Validate variables array
        if (frontMatter.variables) {
            if (!Array.isArray(frontMatter.variables)) {
                issues.push({
                    type: 'error',
                    message: 'Variables field must be an array',
                    suggestion: 'Change variables to array format'
                });
            } else {
                for (let i = 0; i < frontMatter.variables.length; i++) {
                    const variable = frontMatter.variables[i];
                    this.validateVariable(variable, i, issues);
                }
            }
        }

        // Validate agent restrictions
        if (frontMatter.agentRestrictions && !Array.isArray(frontMatter.agentRestrictions)) {
            issues.push({
                type: 'error',
                message: 'Agent restrictions must be an array',
                suggestion: 'Change agentRestrictions to array format'
            });
        }
    }

    private validateVariable(variable: any, index: number, issues: ValidationIssue[]): void {
        const prefix = `Variable ${index + 1}`;

        if (!variable.name) {
            issues.push({
                type: 'error',
                message: `${prefix}: Missing variable name`,
                suggestion: 'Add "name" field to variable'
            });
        } else if (typeof variable.name !== 'string') {
            issues.push({
                type: 'error',
                message: `${prefix}: Variable name must be a string`,
                suggestion: 'Change variable name to string'
            });
        } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable.name)) {
            issues.push({
                type: 'error',
                message: `${prefix}: Invalid variable name '${variable.name}'`,
                suggestion: 'Variable names must start with letter and contain only letters, numbers, and underscores'
            });
        }

        if (!variable.description) {
            issues.push({
                type: 'warning',
                message: `${prefix}: Missing variable description`,
                suggestion: 'Add "description" field to variable'
            });
        }

        if (variable.type && !['string', 'number', 'boolean'].includes(variable.type)) {
            issues.push({
                type: 'warning',
                message: `${prefix}: Unknown variable type '${variable.type}'`,
                suggestion: 'Use one of: string, number, boolean'
            });
        }

        if (variable.required !== undefined && typeof variable.required !== 'boolean') {
            issues.push({
                type: 'error',
                message: `${prefix}: Required field must be boolean`,
                suggestion: 'Set required to true or false'
            });
        }
    }

    private validateTemplateBody(body: string, issues: ValidationIssue[]): void {
        // Find all variables in template
        const variablePattern = /\{\{(\w+)\}\}/g;
        const foundVariables = new Set<string>();
        let match;

        while ((match = variablePattern.exec(body)) !== null) {
            foundVariables.add(match[1]);
        }

        // Check for system variables
        const systemVariables = ['currentDate', 'currentDateTime', 'workspaceRoot', 'author'];
        const userVariables = Array.from(foundVariables).filter(v => !systemVariables.includes(v));

        if (userVariables.length === 0) {
            issues.push({
                type: 'info',
                message: 'Template contains no user-defined variables',
                suggestion: 'Consider adding variables to make template more flexible'
            });
        }

        // Check for unclosed variable brackets
        const unclosedPattern = /\{\{[^}]*$/gm;
        const unclosedMatches = body.match(unclosedPattern);
        if (unclosedMatches) {
            issues.push({
                type: 'error',
                message: `Found ${unclosedMatches.length} unclosed variable bracket(s)`,
                suggestion: 'Ensure all {{ are matched with }}'
            });
        }

        // Check for malformed variables
        const malformedPattern = /\{\{[^a-zA-Z0-9_\s]*\}\}/g;
        const malformedMatches = body.match(malformedPattern);
        if (malformedMatches) {
            issues.push({
                type: 'warning',
                message: `Found potentially malformed variables: ${malformedMatches.join(', ')}`,
                suggestion: 'Variable names should contain only letters, numbers, and underscores'
            });
        }
    }

    private checkCommonIssues(content: string, issues: ValidationIssue[]): void {
        // Check for very long lines
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > 120) {
                issues.push({
                    type: 'info',
                    message: `Line ${i + 1} is very long (${lines[i].length} characters)`,
                    line: i + 1,
                    suggestion: 'Consider breaking long lines for better readability'
                });
            }
        }

        // Check for empty template
        if (content.trim().length === 0) {
            issues.push({
                type: 'error',
                message: 'Template is empty',
                suggestion: 'Add template content'
            });
        }

        // Check for missing title variable
        if (!content.includes('{{title}}')) {
            issues.push({
                type: 'info',
                message: 'Template does not include {{title}} variable',
                suggestion: 'Consider adding {{title}} for document titles'
            });
        }
    }

    private reconstructTemplateFile(template: any): string {
        let content = '';

        // Reconstruct front matter
        const frontMatter: any = {
            id: template.id,
            name: template.name,
            description: template.description
        };

        if (template.variables && template.variables.length > 0) {
            frontMatter.variables = template.variables;
        }

        if (template.agentRestrictions && template.agentRestrictions.length > 0) {
            frontMatter.agentRestrictions = template.agentRestrictions;
        }

        if (template.frontMatter && Object.keys(template.frontMatter).length > 0) {
            frontMatter.frontMatter = template.frontMatter;
        }

        content += '---\n';
        content += yaml.dump(frontMatter);
        content += '---\n';
        content += template.content;

        return content;
    }
}