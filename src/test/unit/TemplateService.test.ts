import { TemplateService, Template, TemplateVariable } from '../../templates/TemplateService';

describe('TemplateService', () => {
    let templateService: TemplateService;

    beforeEach(() => {
        // Reset singleton instance for each test
        (TemplateService as any).instance = undefined;
        templateService = TemplateService.getInstance();
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = TemplateService.getInstance();
            const instance2 = TemplateService.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('getTemplate', () => {
        it('should return built-in basic template', async () => {
            const template = await templateService.getTemplate('basic');
            
            expect(template.id).toBe('basic');
            expect(template.name).toBe('Basic Document');
            expect(template.content).toContain('# {{title}}');
        });

        it('should return built-in PRD template', async () => {
            const template = await templateService.getTemplate('prd');
            
            expect(template.id).toBe('prd');
            expect(template.name).toBe('Product Requirements Document');
            expect(template.content).toContain('## Executive Summary');
        });

        it('should throw error for non-existent template', async () => {
            await expect(templateService.getTemplate('non-existent'))
                .rejects.toThrow('Template \'non-existent\' not found');
        });
    });

    describe('renderTemplate', () => {
        it('should render basic template with variables', async () => {
            const template = await templateService.getTemplate('basic');
            const variables = {
                title: 'My Test Document',
                description: 'This is a test document'
            };

            const result = await templateService.renderTemplate(template, variables);

            expect(result.success).toBe(true);
            expect(result.content).toContain('# My Test Document');
            expect(result.content).toContain('This is a test document');
            expect(result.content).toContain('title: My Test Document');
        });

        it('should use default variables when not provided', async () => {
            const template = await templateService.getTemplate('basic');
            const variables = {
                title: 'Test Document'
            };

            const result = await templateService.renderTemplate(template, variables);

            expect(result.success).toBe(true);
            expect(result.content).toContain('Document description goes here.');
        });

        it('should fail when required variables are missing', async () => {
            const customTemplate: Template = {
                id: 'test',
                name: 'Test Template',
                description: 'Test template',
                content: '# {{title}}\n{{requiredField}}',
                variables: [
                    {
                        name: 'title',
                        type: 'string',
                        description: 'Title',
                        required: true
                    },
                    {
                        name: 'requiredField',
                        type: 'string',
                        description: 'Required field',
                        required: true
                    }
                ],
                frontMatter: {}
            };

            templateService.addTemplate(customTemplate);

            const result = await templateService.renderTemplate(customTemplate, { title: 'Test' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing required variables: requiredField');
            expect(result.missingVariables).toContain('requiredField');
        });

        it('should render front matter with variables', async () => {
            const template = await templateService.getTemplate('prd');
            const variables = {
                title: 'My PRD',
                version: '2.0',
                status: 'In Progress'
            };

            const result = await templateService.renderTemplate(template, variables);

            expect(result.success).toBe(true);
            expect(result.content).toContain('---');
            expect(result.content).toContain('title: My PRD');
            expect(result.content).toContain('version: 2.0');
            expect(result.content).toContain('status: In Progress');
        });

        it('should handle templates without front matter', async () => {
            const customTemplate: Template = {
                id: 'no-frontmatter',
                name: 'No Front Matter',
                description: 'Template without front matter',
                content: '# {{title}}\nContent here',
                variables: [],
                frontMatter: {}
            };

            templateService.addTemplate(customTemplate);

            const result = await templateService.renderTemplate(customTemplate, { title: 'Test' });

            expect(result.success).toBe(true);
            expect(result.content).not.toContain('---');
            expect(result.content).toContain('# Test');
        });
    });

    describe('getDefaultVariables', () => {
        it('should return basic default variables', () => {
            const defaults = templateService.getDefaultVariables('basic');
            
            expect(defaults.title).toBe('Untitled Document');
            expect(defaults.author).toBe('Unknown Author');
            expect(defaults.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(defaults.year).toBe(new Date().getFullYear());
        });

        it('should return PRD-specific defaults', () => {
            const defaults = templateService.getDefaultVariables('prd');
            
            expect(defaults.title).toBe('Product Requirements Document');
            expect(defaults.version).toBe('1.0');
            expect(defaults.status).toBe('Draft');
            expect(defaults.priority).toBe('Medium');
        });

        it('should return requirements-specific defaults', () => {
            const defaults = templateService.getDefaultVariables('requirements');
            
            expect(defaults.title).toBe('Requirements Document');
            expect(defaults.version).toBe('1.0');
            expect(defaults.status).toBe('Draft');
        });

        it('should return basic defaults for unknown template', () => {
            const defaults = templateService.getDefaultVariables('unknown');
            
            expect(defaults.title).toBe('Untitled Document');
            expect(defaults.author).toBe('Unknown Author');
        });
    });

    describe('listTemplates', () => {
        it('should return all built-in templates', () => {
            const templates = templateService.listTemplates();
            
            expect(templates.length).toBeGreaterThanOrEqual(3);
            
            const templateIds = templates.map(t => t.id);
            expect(templateIds).toContain('basic');
            expect(templateIds).toContain('prd');
            expect(templateIds).toContain('requirements');
        });

        it('should include custom templates', () => {
            const customTemplate: Template = {
                id: 'custom',
                name: 'Custom Template',
                description: 'Custom template',
                content: '# Custom',
                variables: [],
                frontMatter: {}
            };

            templateService.addTemplate(customTemplate);
            
            const templates = templateService.listTemplates();
            const customFound = templates.find(t => t.id === 'custom');
            
            expect(customFound).toBeDefined();
            expect(customFound?.name).toBe('Custom Template');
        });
    });

    describe('addTemplate', () => {
        it('should add custom template', () => {
            const customTemplate: Template = {
                id: 'test-template',
                name: 'Test Template',
                description: 'A test template',
                content: '# {{title}}\n{{content}}',
                variables: [
                    {
                        name: 'title',
                        type: 'string',
                        description: 'Document title',
                        required: true
                    },
                    {
                        name: 'content',
                        type: 'string',
                        description: 'Document content',
                        required: false,
                        defaultValue: 'Default content'
                    }
                ],
                frontMatter: {
                    title: '{{title}}',
                    type: 'test'
                }
            };

            templateService.addTemplate(customTemplate);
            
            const templates = templateService.listTemplates();
            const addedTemplate = templates.find(t => t.id === 'test-template');
            
            expect(addedTemplate).toEqual(customTemplate);
        });

        it('should replace existing template with same ID', () => {
            const template1: Template = {
                id: 'replaceable',
                name: 'Original',
                description: 'Original template',
                content: 'Original content',
                variables: [],
                frontMatter: {}
            };

            const template2: Template = {
                id: 'replaceable',
                name: 'Replacement',
                description: 'Replacement template',
                content: 'Replacement content',
                variables: [],
                frontMatter: {}
            };

            templateService.addTemplate(template1);
            templateService.addTemplate(template2);
            
            const templates = templateService.listTemplates();
            const foundTemplates = templates.filter(t => t.id === 'replaceable');
            
            expect(foundTemplates).toHaveLength(1);
            expect(foundTemplates[0].name).toBe('Replacement');
        });
    });

    describe('variable substitution', () => {
        it('should substitute all variable patterns', async () => {
            const template: Template = {
                id: 'substitution-test',
                name: 'Substitution Test',
                description: 'Test variable substitution',
                content: 'Title: {{title}}\nAuthor: {{author}}\nDate: {{date}}\nTitle again: {{title}}',
                variables: [],
                frontMatter: {}
            };

            templateService.addTemplate(template);

            const variables = {
                title: 'Test Document',
                author: 'Test Author',
                date: '2023-01-01'
            };

            const result = await templateService.renderTemplate(template, variables);

            expect(result.success).toBe(true);
            expect(result.content).toContain('Title: Test Document');
            expect(result.content).toContain('Author: Test Author');
            expect(result.content).toContain('Date: 2023-01-01');
            expect(result.content).toContain('Title again: Test Document');
        });

        it('should handle missing variables gracefully', async () => {
            const template: Template = {
                id: 'missing-vars',
                name: 'Missing Variables',
                description: 'Test missing variables',
                content: 'Title: {{title}}\nMissing: {{missing}}',
                variables: [],
                frontMatter: {}
            };

            templateService.addTemplate(template);

            const result = await templateService.renderTemplate(template, { title: 'Test' });

            expect(result.success).toBe(true);
            expect(result.content).toContain('Title: Test');
            expect(result.content).toContain('Missing: ');
        });
    });
});