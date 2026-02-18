import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../logging/Logger';

export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    description: string;
    required: boolean;
    defaultValue?: any;
}

export interface Template {
    id: string;
    name: string;
    description: string;
    content: string;
    variables: TemplateVariable[];
    frontMatter: Record<string, any>;
    builtIn?: boolean; // For backward compatibility
    agentRestrictions?: string[]; // For agent-specific templates
}

export interface TemplateRenderResult {
    success: boolean;
    content?: string;
    error?: string;
    missingVariables?: string[];
    frontMatter?: Record<string, any>;
    metadata?: Record<string, any>;
}

/**
 * Consolidated template service managing all template operations
 */
export class TemplateService {
    private static instance: TemplateService;
    private logger: Logger;
    private templates: Map<string, Template>;
    private builtInTemplates: Map<string, Template>;
    private userTemplates: Map<string, Template>;
    private context?: vscode.ExtensionContext;

    // Performance caching
    private renderCache: Map<string, { result: TemplateRenderResult; timestamp: number }>;
    private readonly CACHE_MAX_SIZE = 100;
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    constructor(context?: any) {
        this.logger = Logger.getInstance();
        this.templates = new Map();
        this.builtInTemplates = new Map();
        this.userTemplates = new Map();
        this.renderCache = new Map();
        this.initializeBuiltInTemplates();
        if (context) {
            this.initialize(context);
        }
    }

    static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    /**
     * Initialize with extension context (for user template loading)
     */
    initialize(context: vscode.ExtensionContext): void {
        this.context = context;
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
                this.logger.info('template', 'No user templates directory found');
            }
        } catch (error) {
            this.logger.error('template', 'Error loading user templates', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Get templates available for a specific agent
     */
    getTemplatesForAgent(agentName: string): Template[] {
        return this.listTemplates().filter(template => {
            const agentRestrictions = (template as any).agentRestrictions;
            return !agentRestrictions || 
                   agentRestrictions.length === 0 || 
                   agentRestrictions.includes(agentName);
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

    /**
     * Get a template by ID
     */
    async getTemplate(templateId: string): Promise<Template> {
        this.logger.info('template', 'Getting template', { templateId });

        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        return template;
    }

    /**
     * Render a template with variables (with caching for performance)
     */
    async renderTemplate(templateOrId: Template | string, variables: Record<string, any>): Promise<TemplateRenderResult> {
        const template = typeof templateOrId === 'string' ? await this.getTemplate(templateOrId) : templateOrId;

        // Check cache first
        const cacheKey = this.generateCacheKey(template.id, variables);
        const cached = this.getCachedRender(cacheKey);
        if (cached) {
            this.logger.extension.debug(`Template render cache hit for ${template.id}`);
            return cached;
        }

        try {
            this.logger.info('template', 'Rendering template', {
                templateId: template.id,
                variableCount: Object.keys(variables).length
            });

            // Check for missing required variables
            const missingVariables = this.findMissingVariables(template, variables);
            if (missingVariables.length > 0) {
                return {
                    success: false,
                    error: `Missing required variables: ${missingVariables.join(', ')}`,
                    missingVariables
                };
            }

            // Merge with default variables
            const allVariables = { ...this.getDefaultVariables(template.id), ...variables };

            // Render content
            const renderedContent = this.substituteVariables(template.content, allVariables);

            // Render front matter
            const renderedFrontMatter = this.renderFrontMatter(template.frontMatter, allVariables);

            // Combine front matter and content
            const finalContent = this.combineFrontMatterAndContent(renderedFrontMatter, renderedContent);

            this.logger.info('template', 'Template rendered successfully', {
                templateId: template.id,
                contentLength: finalContent.length
            });

            const result: TemplateRenderResult = {
                success: true,
                content: finalContent,
                frontMatter: renderedFrontMatter,
                metadata: {
                    templateId: template.id,
                    variables: allVariables,
                    renderTime: new Date().toISOString()
                }
            };

            // Cache the result
            this.cacheRender(cacheKey, result);

            return result;

        } catch (error) {
            this.logger.error('template', 'Failed to render template', error instanceof Error ? error : new Error(String(error)));
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get default variables for a template
     */
    getDefaultVariables(templateId: string): Record<string, any> {
        const now = new Date();
        const defaultVariables: Record<string, any> = {
            title: 'Untitled Document',
            author: 'Unknown Author',
            created: now.toISOString().split('T')[0],
            timestamp: now.toISOString(),
            year: now.getFullYear(),
            month: now.toLocaleString('default', { month: 'long' }),
            day: now.getDate()
        };

        // Template-specific defaults
        switch (templateId) {
            case 'prd':
                return {
                    ...defaultVariables,
                    title: 'Product Requirements Document',
                    version: '1.0',
                    status: 'Draft',
                    priority: 'Medium'
                };
            case 'requirements':
                return {
                    ...defaultVariables,
                    title: 'Requirements Document',
                    version: '1.0',
                    status: 'Draft'
                };
            case 'design':
                return {
                    ...defaultVariables,
                    title: 'Design Document',
                    version: '1.0',
                    status: 'Draft'
                };
            case 'tasks':
                return {
                    ...defaultVariables,
                    title: 'Implementation Plan',
                    version: '1.0',
                    status: 'Draft'
                };
            case 'basic':
            default:
                return {
                    ...defaultVariables,
                    description: 'Document description goes here.'
                };
        }
    }

    /**
     * List all available templates
     */
    listTemplates(): Template[] {
        return Array.from(this.templates.values());
    }

    /**
     * Get all templates (alias for listTemplates for backward compatibility)
     */
    getTemplates(): Template[] {
        return this.listTemplates();
    }

    /**
     * Add a custom template
     */
    addTemplate(template: Template): void {
        this.logger.info('template', 'Adding template', { templateId: template.id });
        this.templates.set(template.id, template);
    }

    /**
     * Initialize built-in templates
     */
    private initializeBuiltInTemplates(): void {
        // Basic template
        this.templates.set('basic', {
            id: 'basic',
            name: 'Basic Document',
            description: 'A simple document template with basic structure',
            builtIn: true,
            content: `# {{title}}

## Overview

{{description}}

## Content

<!-- Add your content here -->

## Notes

<!-- Add any additional notes here -->
`,
            variables: [
                {
                    name: 'title',
                    type: 'string',
                    description: 'Document title',
                    required: true
                },
                {
                    name: 'description',
                    type: 'string',
                    description: 'Document description',
                    required: false,
                    defaultValue: 'Document description goes here.'
                }
            ],
            frontMatter: {
                title: '{{title}}',
                created: '{{created}}',
                author: '{{author}}'
            }
        });

        // PRD template
        this.templates.set('prd', {
            id: 'prd',
            name: 'Product Requirements Document',
            description: 'Comprehensive PRD template for product development',
            builtIn: true,
            content: `# {{title}}

## Executive Summary

{{executive_summary}}

## Problem Statement

### Problem Description
{{problem_description}}

### Target Users
{{target_users}}

## Goals and Success Metrics

### Primary Goals
{{primary_goals}}

### Success Metrics
{{success_metrics}}

## Functional Requirements

### Core Features
{{core_features}}

### User Stories
{{user_stories}}

## Non-Functional Requirements

### Performance Requirements
{{performance_requirements}}

### Security Requirements
{{security_requirements}}

### Scalability Requirements
{{scalability_requirements}}

## Constraints and Assumptions

### Technical Constraints
{{technical_constraints}}

### Business Constraints
{{business_constraints}}

### Assumptions
{{assumptions}}

## Timeline and Milestones

{{timeline}}

## Appendix

{{appendix}}
`,
            variables: [
                {
                    name: 'title',
                    type: 'string',
                    description: 'PRD title',
                    required: true
                },
                {
                    name: 'executive_summary',
                    type: 'string',
                    description: 'Executive summary',
                    required: false,
                    defaultValue: 'Executive summary to be added.'
                },
                {
                    name: 'problem_description',
                    type: 'string',
                    description: 'Problem description',
                    required: false,
                    defaultValue: 'Problem description to be added.'
                }
            ],
            frontMatter: {
                title: '{{title}}',
                type: 'PRD',
                version: '{{version}}',
                status: '{{status}}',
                created: '{{created}}',
                author: '{{author}}',
                priority: '{{priority}}'
            }
        });

        // Requirements template
        this.templates.set('requirements', {
            id: 'requirements',
            name: 'Requirements Document',
            description: 'Template for technical requirements documentation',
            builtIn: true,
            content: `# {{title}}

## Introduction

### Purpose
{{purpose}}

### Scope
{{scope}}

## Functional Requirements

### User Stories
{{user_stories}}

### System Requirements
{{system_requirements}}

## Non-Functional Requirements

### Performance
{{performance}}

### Security
{{security}}

### Usability
{{usability}}

## Acceptance Criteria

{{acceptance_criteria}}

## Dependencies

{{dependencies}}

## Glossary

{{glossary}}
`,
            variables: [
                {
                    name: 'title',
                    type: 'string',
                    description: 'Requirements document title',
                    required: true
                },
                {
                    name: 'purpose',
                    type: 'string',
                    description: 'Document purpose',
                    required: false,
                    defaultValue: 'Document purpose to be defined.'
                }
            ],
            frontMatter: {
                title: '{{title}}',
                type: 'Requirements',
                version: '{{version}}',
                status: '{{status}}',
                created: '{{created}}',
                author: '{{author}}'
            }
        });

        // Design template
        this.templates.set('design', {
            id: 'design',
            name: 'Design Document',
            description: 'Technical architecture and system design document',
            builtIn: true,
            content: `# {{title}}

## Overview

### Purpose
{{purpose}}

### Scope
{{scope}}

## Architecture

### System Architecture
{{system_architecture}}

### Technology Stack
{{technology_stack}}

## Components and Interfaces

### Core Components
{{core_components}}

### API / Interface Specifications
{{api_specifications}}

## Data Models

### Entities and Relationships
{{data_models}}

### Storage Strategy
{{storage_strategy}}

## Error Handling

### Error Categories
{{error_categories}}

### Recovery Strategies
{{recovery_strategies}}

## Security Considerations

{{security_considerations}}

## Performance Considerations

{{performance_considerations}}

## Deployment

{{deployment_plan}}

## Appendix

{{appendix}}
`,
            variables: [
                { name: 'title', type: 'string', description: 'Document title', required: true },
                { name: 'purpose', type: 'string', description: 'Purpose of the design', required: false, defaultValue: 'To be defined.' },
                { name: 'scope', type: 'string', description: 'Scope of the system', required: false, defaultValue: 'To be defined.' }
            ],
            frontMatter: {
                title: '{{title}}',
                type: 'Design',
                version: '{{version}}',
                status: '{{status}}',
                created: '{{created}}',
                author: '{{author}}'
            }
        });

        // Tasks / Implementation Plan template
        this.templates.set('tasks', {
            id: 'tasks',
            name: 'Implementation Plan',
            description: 'Detailed task breakdown and implementation roadmap',
            builtIn: true,
            content: `# {{title}}

## Implementation Plan

### Overview
{{overview}}

## Task Breakdown

### Phase 1 — Foundation
{{phase1_tasks}}

### Phase 2 — Core Features
{{phase2_tasks}}

### Phase 3 — Integration & Polish
{{phase3_tasks}}

## Testing Strategy

### Unit Tests
{{unit_tests}}

### Integration Tests
{{integration_tests}}

### Acceptance Criteria
{{acceptance_criteria}}

## Deployment Plan

### Environments
{{environments}}

### Rollout Strategy
{{rollout_strategy}}

## Risk Register

{{risks}}

## Timeline

{{timeline}}
`,
            variables: [
                { name: 'title', type: 'string', description: 'Document title', required: true },
                { name: 'overview', type: 'string', description: 'Implementation overview', required: false, defaultValue: 'To be defined.' }
            ],
            frontMatter: {
                title: '{{title}}',
                type: 'Implementation Plan',
                version: '{{version}}',
                status: '{{status}}',
                created: '{{created}}',
                author: '{{author}}'
            }
        });

        // Store built-in templates separately
        this.builtInTemplates.set('basic', this.templates.get('basic')!);
        this.builtInTemplates.set('prd', this.templates.get('prd')!);
        this.builtInTemplates.set('requirements', this.templates.get('requirements')!);
        this.builtInTemplates.set('design', this.templates.get('design')!);
        this.builtInTemplates.set('tasks', this.templates.get('tasks')!);

        this.logger.info('template', 'Initialized built-in templates', {
            count: this.templates.size,
            templates: Array.from(this.templates.keys())
        });
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
            this.logger.error('template', 'Error loading user template', error instanceof Error ? error : new Error(String(error)));
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
                const yaml = require('js-yaml');
                const frontMatter = yaml.load(frontMatterMatch[1]) as any;
                const templateContent = frontMatterMatch[2];
                
                const template: Template = {
                    id: frontMatter.id || path.basename(filePath, path.extname(filePath)),
                    name: frontMatter.name || frontMatter.id || path.basename(filePath, path.extname(filePath)),
                    description: frontMatter.description || 'User-defined template',
                    content: templateContent,
                    variables: frontMatter.variables || [],
                    frontMatter: frontMatter.frontMatter || {},
                    builtIn: false
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
                    builtIn: false
                };
                
                return template;
            }
        } catch (error) {
            this.logger.error('template', 'Error parsing template file', error instanceof Error ? error : new Error(String(error)));
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
     * Find missing required variables
     */
    private findMissingVariables(template: Template, variables: Record<string, any>): string[] {
        const missing: string[] = [];
        
        for (const variable of template.variables) {
            if (variable.required && !(variable.name in variables)) {
                missing.push(variable.name);
            }
        }
        
        return missing;
    }

    /**
     * Substitute variables in content
     */
    private substituteVariables(content: string, variables: Record<string, any>): string {
        let result = content;
        
        // Replace {{variable}} patterns
        for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(pattern, String(value || ''));
        }
        
        return result;
    }

    /**
     * Render front matter with variables
     */
    private renderFrontMatter(frontMatter: Record<string, any>, variables: Record<string, any>): Record<string, any> {
        const rendered: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(frontMatter)) {
            if (typeof value === 'string') {
                rendered[key] = this.substituteVariables(value, variables);
            } else {
                rendered[key] = value;
            }
        }
        
        return rendered;
    }

    /**
     * Combine front matter and content
     */
    private combineFrontMatterAndContent(frontMatter: Record<string, any>, content: string): string {
        if (Object.keys(frontMatter).length === 0) {
            return content;
        }

        let result = '---\n';
        for (const [key, value] of Object.entries(frontMatter)) {
            result += `${key}: ${value}\n`;
        }
        result += '---\n\n';
        result += content;

        return result;
    }

    // ===== Performance Caching Methods =====

    /**
     * Generate a cache key from template ID and variables
     */
    private generateCacheKey(templateId: string, variables: Record<string, any>): string {
        // Sort keys for consistent cache keys regardless of variable order
        const sortedVars = Object.keys(variables)
            .sort()
            .map(key => `${key}:${JSON.stringify(variables[key])}`)
            .join('|');
        return `${templateId}:${sortedVars}`;
    }

    /**
     * Get cached render result if available and not expired
     */
    private getCachedRender(cacheKey: string): TemplateRenderResult | null {
        const cached = this.renderCache.get(cacheKey);
        if (!cached) {
            return null;
        }

        // Check if cache entry has expired
        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_TTL_MS) {
            this.renderCache.delete(cacheKey);
            return null;
        }

        return cached.result;
    }

    /**
     * Cache a render result with automatic size management
     */
    private cacheRender(cacheKey: string, result: TemplateRenderResult): void {
        // Evict oldest entries if cache is full
        if (this.renderCache.size >= this.CACHE_MAX_SIZE) {
            // Simple FIFO eviction - delete first entry
            const firstKey = this.renderCache.keys().next().value;
            if (firstKey) {
                this.renderCache.delete(firstKey);
            }
        }

        this.renderCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Clear the render cache (useful for testing or forced refresh)
     */
    public clearRenderCache(): void {
        this.renderCache.clear();
        this.logger.extension.info('Template render cache cleared');
    }

    /**
     * Get cache statistics for monitoring
     */
    public getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
        return {
            size: this.renderCache.size,
            maxSize: this.CACHE_MAX_SIZE,
            ttlMs: this.CACHE_TTL_MS
        };
    }
}