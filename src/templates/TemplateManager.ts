import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Template, TemplateMetadata, TemplateRenderContext, TemplateRenderResult, TemplateVariable } from './types';

export class TemplateManager {
    private templates: Map<string, Template> = new Map();
    private builtInTemplates: Map<string, Template> = new Map();
    private userTemplates: Map<string, Template> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.initializeBuiltInTemplates();
    }

    /**
     * Initialize built-in templates
     */
    private initializeBuiltInTemplates(): void {
        // PRD Template
        const prdTemplate: Template = {
            id: 'prd',
            name: 'Product Requirements Document',
            description: 'Template for creating Product Requirements Documents',
            content: `---
title: {{title}}
type: PRD
created: {{currentDate}}
author: {{author}}
version: 1.0
---

# {{title}}

## Executive Summary

{{executiveSummary}}

## Product Objectives

### Primary Goals
- {{primaryGoal1}}
- {{primaryGoal2}}
- {{primaryGoal3}}

### Success Criteria
- {{successCriteria1}}
- {{successCriteria2}}

## User Personas

### Primary User: {{primaryPersona}}
- **Role**: {{primaryPersonaRole}}
- **Goals**: {{primaryPersonaGoals}}
- **Pain Points**: {{primaryPersonaPainPoints}}

## Scope and Constraints

### In Scope
- {{inScope1}}
- {{inScope2}}

### Out of Scope
- {{outOfScope1}}
- {{outOfScope2}}

### Constraints
- {{constraint1}}
- {{constraint2}}

## Acceptance Criteria

1. {{acceptanceCriteria1}}
2. {{acceptanceCriteria2}}
3. {{acceptanceCriteria3}}
`,
            variables: [
                { name: 'title', description: 'Document title', required: true, type: 'string' },
                { name: 'author', description: 'Document author', required: false, defaultValue: 'Unknown', type: 'string' },
                { name: 'executiveSummary', description: 'Executive summary', required: true, type: 'string' },
                { name: 'primaryGoal1', description: 'First primary goal', required: true, type: 'string' },
                { name: 'primaryGoal2', description: 'Second primary goal', required: false, type: 'string' },
                { name: 'primaryGoal3', description: 'Third primary goal', required: false, type: 'string' },
                { name: 'successCriteria1', description: 'First success criteria', required: true, type: 'string' },
                { name: 'successCriteria2', description: 'Second success criteria', required: false, type: 'string' },
                { name: 'primaryPersona', description: 'Primary user persona name', required: true, type: 'string' },
                { name: 'primaryPersonaRole', description: 'Primary persona role', required: true, type: 'string' },
                { name: 'primaryPersonaGoals', description: 'Primary persona goals', required: true, type: 'string' },
                { name: 'primaryPersonaPainPoints', description: 'Primary persona pain points', required: true, type: 'string' },
                { name: 'inScope1', description: 'First in-scope item', required: true, type: 'string' },
                { name: 'inScope2', description: 'Second in-scope item', required: false, type: 'string' },
                { name: 'outOfScope1', description: 'First out-of-scope item', required: true, type: 'string' },
                { name: 'outOfScope2', description: 'Second out-of-scope item', required: false, type: 'string' },
                { name: 'constraint1', description: 'First constraint', required: true, type: 'string' },
                { name: 'constraint2', description: 'Second constraint', required: false, type: 'string' },
                { name: 'acceptanceCriteria1', description: 'First acceptance criteria', required: true, type: 'string' },
                { name: 'acceptanceCriteria2', description: 'Second acceptance criteria', required: false, type: 'string' },
                { name: 'acceptanceCriteria3', description: 'Third acceptance criteria', required: false, type: 'string' }
            ],
            frontMatter: {
                type: 'PRD',
                version: '1.0'
            },
            agentRestrictions: ['prd-creator']
        };

        // Requirements Template
        const requirementsTemplate: Template = {
            id: 'requirements',
            name: 'Requirements Document',
            description: 'Template for creating structured requirements documents',
            content: `---
title: {{title}}
type: Requirements
created: {{currentDate}}
author: {{author}}
version: 1.0
---

# {{title}} - Requirements Document

## Introduction

{{introduction}}

## Requirements

### Requirement 1: {{requirement1Title}}

**User Story:** As a {{userRole1}}, I want {{userWant1}}, so that {{userBenefit1}}.

#### Acceptance Criteria

1. WHEN {{condition1}} THEN the system SHALL {{response1}}
2. WHEN {{condition2}} THEN the system SHALL {{response2}}

### Requirement 2: {{requirement2Title}}

**User Story:** As a {{userRole2}}, I want {{userWant2}}, so that {{userBenefit2}}.

#### Acceptance Criteria

1. WHEN {{condition3}} THEN the system SHALL {{response3}}
2. IF {{precondition1}} THEN the system SHALL {{response4}}
`,
            variables: [
                { name: 'title', description: 'Document title', required: true, type: 'string' },
                { name: 'author', description: 'Document author', required: false, defaultValue: 'Unknown', type: 'string' },
                { name: 'introduction', description: 'Requirements introduction', required: true, type: 'string' },
                { name: 'requirement1Title', description: 'First requirement title', required: true, type: 'string' },
                { name: 'userRole1', description: 'User role for first requirement', required: true, type: 'string' },
                { name: 'userWant1', description: 'What user wants for first requirement', required: true, type: 'string' },
                { name: 'userBenefit1', description: 'User benefit for first requirement', required: true, type: 'string' },
                { name: 'condition1', description: 'First condition', required: true, type: 'string' },
                { name: 'response1', description: 'First system response', required: true, type: 'string' },
                { name: 'condition2', description: 'Second condition', required: true, type: 'string' },
                { name: 'response2', description: 'Second system response', required: true, type: 'string' },
                { name: 'requirement2Title', description: 'Second requirement title', required: false, type: 'string' },
                { name: 'userRole2', description: 'User role for second requirement', required: false, type: 'string' },
                { name: 'userWant2', description: 'What user wants for second requirement', required: false, type: 'string' },
                { name: 'userBenefit2', description: 'User benefit for second requirement', required: false, type: 'string' },
                { name: 'condition3', description: 'Third condition', required: false, type: 'string' },
                { name: 'response3', description: 'Third system response', required: false, type: 'string' },
                { name: 'precondition1', description: 'First precondition', required: false, type: 'string' },
                { name: 'response4', description: 'Fourth system response', required: false, type: 'string' }
            ],
            frontMatter: {
                type: 'Requirements',
                version: '1.0'
            },
            agentRestrictions: ['requirements-gatherer']
        };

        // Basic Document Template
        const basicTemplate: Template = {
            id: 'basic',
            name: 'Basic Document',
            description: 'Simple template for basic documents',
            content: `---
title: {{title}}
created: {{currentDate}}
author: {{author}}
---

# {{title}}

{{content}}
`,
            variables: [
                { name: 'title', description: 'Document title', required: true, type: 'string' },
                { name: 'author', description: 'Document author', required: false, defaultValue: 'Unknown', type: 'string' },
                { name: 'content', description: 'Document content', required: false, defaultValue: 'Add your content here...', type: 'string' }
            ],
            frontMatter: {},
            agentRestrictions: []
        };

        this.builtInTemplates.set('prd', prdTemplate);
        this.builtInTemplates.set('requirements', requirementsTemplate);
        this.builtInTemplates.set('basic', basicTemplate);

        // Add to main templates map
        this.templates.set('prd', prdTemplate);
        this.templates.set('requirements', requirementsTemplate);
        this.templates.set('basic', basicTemplate);
    }    
/**
     * Load user-defined templates from workspace
     */
    async loadUserTemplates(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return;
            }

            const templateDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'docu', 'templates');
            
            try {
                const templateFiles = await vscode.workspace.fs.readDirectory(templateDir);
                
                for (const [fileName, fileType] of templateFiles) {
                    if (fileType === vscode.FileType.File && (fileName.endsWith('.md') || fileName.endsWith('.yaml') || fileName.endsWith('.yml'))) {
                        await this.loadUserTemplate(vscode.Uri.joinPath(templateDir, fileName));
                    }
                }
            } catch (error) {
                // Template directory doesn't exist or is empty - this is fine
                console.log('No user templates directory found');
            }
        } catch (error) {
            console.error('Error loading user templates:', error);
        }
    }

    /**
     * Load a single user template file
     */
    private async loadUserTemplate(templateUri: vscode.Uri): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(templateUri);
            const templateContent = Buffer.from(content).toString('utf8');
            
            // Parse template file (could be YAML config + content or just markdown)
            const template = this.parseTemplateFile(templateContent, templateUri.fsPath);
            
            if (template) {
                this.userTemplates.set(template.id, template);
                this.templates.set(template.id, template);
            }
        } catch (error) {
            console.error(`Error loading template ${templateUri.fsPath}:`, error);
        }
    }

    /**
     * Parse template file content
     */
    private parseTemplateFile(content: string, filePath: string): Template | null {
        try {
            // Check if file has YAML front matter
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            
            if (frontMatterMatch) {
                const frontMatter = yaml.load(frontMatterMatch[1]) as any;
                const templateContent = frontMatterMatch[2];
                
                const template: Template = {
                    id: frontMatter.id || path.basename(filePath, path.extname(filePath)),
                    name: frontMatter.name || frontMatter.id || path.basename(filePath, path.extname(filePath)),
                    description: frontMatter.description || 'User-defined template',
                    content: templateContent,
                    variables: frontMatter.variables || [],
                    frontMatter: frontMatter.frontMatter || {},
                    agentRestrictions: frontMatter.agentRestrictions || []
                };
                
                return template;
            } else {
                // Simple markdown file without front matter
                const id = path.basename(filePath, path.extname(filePath));
                const template: Template = {
                    id,
                    name: id,
                    description: 'User-defined template',
                    content,
                    variables: this.extractVariablesFromContent(content),
                    frontMatter: {},
                    agentRestrictions: []
                };
                
                return template;
            }
        } catch (error) {
            console.error(`Error parsing template file ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Extract variables from template content by finding {{variable}} patterns
     */
    private extractVariablesFromContent(content: string): TemplateVariable[] {
        const variablePattern = /\{\{(\w+)\}\}/g;
        const variables: TemplateVariable[] = [];
        const foundVariables = new Set<string>();
        
        let match;
        while ((match = variablePattern.exec(content)) !== null) {
            const variableName = match[1];
            if (!foundVariables.has(variableName) && variableName !== 'currentDate') {
                foundVariables.add(variableName);
                variables.push({
                    name: variableName,
                    description: `Variable: ${variableName}`,
                    required: true,
                    type: 'string'
                });
            }
        }
        
        return variables;
    }

    /**
     * Get all available templates
     */
    getTemplates(): TemplateMetadata[] {
        const templates: TemplateMetadata[] = [];
        
        for (const [id, template] of this.templates) {
            templates.push({
                id: template.id,
                name: template.name,
                description: template.description,
                variables: template.variables,
                builtIn: this.builtInTemplates.has(id)
            });
        }
        
        return templates;
    }

    /**
     * Get a specific template by ID
     */
    getTemplate(id: string): Template | undefined {
        return this.templates.get(id);
    }

    /**
     * Render a template with provided variables
     */
    renderTemplate(templateId: string, context: TemplateRenderContext): TemplateRenderResult | null {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        // Validate required variables
        const missingVariables: string[] = [];
        for (const variable of template.variables) {
            if (variable.required && !(variable.name in context.variables)) {
                if (!variable.defaultValue) {
                    missingVariables.push(variable.name);
                }
            }
        }

        if (missingVariables.length > 0) {
            throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
        }

        // Prepare variables with defaults and system variables
        const allVariables: Record<string, any> = {
            ...context.variables,
            currentDate: context.currentDate.toISOString().split('T')[0],
            currentDateTime: context.currentDate.toISOString(),
            workspaceRoot: context.workspaceRoot,
            author: context.userInfo?.name || context.variables.author || 'Unknown'
        };

        // Add default values for missing optional variables
        for (const variable of template.variables) {
            if (!(variable.name in allVariables) && variable.defaultValue !== undefined) {
                allVariables[variable.name] = variable.defaultValue;
            }
        }

        // Perform variable substitution
        let renderedContent = template.content;
        for (const [key, value] of Object.entries(allVariables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            renderedContent = renderedContent.replace(regex, String(value));
        }

        // Process front matter
        const processedFrontMatter = { ...template.frontMatter };
        for (const [key, value] of Object.entries(processedFrontMatter)) {
            if (typeof value === 'string') {
                for (const [varKey, varValue] of Object.entries(allVariables)) {
                    const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
                    processedFrontMatter[key] = value.replace(regex, String(varValue));
                }
            }
        }

        // Add common front matter fields
        processedFrontMatter.title = allVariables['title'] || processedFrontMatter.title;
        processedFrontMatter.created = allVariables['currentDate'];
        processedFrontMatter.author = allVariables['author'];

        return {
            content: renderedContent,
            frontMatter: processedFrontMatter,
            metadata: {
                id: template.id,
                name: template.name,
                description: template.description,
                variables: template.variables,
                builtIn: this.builtInTemplates.has(template.id)
            }
        };
    }

    /**
     * Get templates available for a specific agent
     */
    getTemplatesForAgent(agentName: string): TemplateMetadata[] {
        return this.getTemplates().filter(template => {
            const originalTemplate = this.templates.get(template.id);
            return !originalTemplate?.agentRestrictions || 
                   originalTemplate.agentRestrictions.length === 0 || 
                   originalTemplate.agentRestrictions.includes(agentName);
        });
    }

    /**
     * Reload all templates
     */
    async reloadTemplates(): Promise<void> {
        // Clear user templates
        for (const id of this.userTemplates.keys()) {
            this.templates.delete(id);
        }
        this.userTemplates.clear();

        // Reload user templates
        await this.loadUserTemplates();
    }
}