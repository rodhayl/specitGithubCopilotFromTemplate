// Unit tests for TemplateManager
import * as assert from 'assert';
import * as vscode from 'vscode';
import { TemplateManager } from '../../templates/TemplateManager';

suite('TemplateManager Unit Tests', () => {
    let templateManager: TemplateManager;
    let mockContext: vscode.ExtensionContext;

    setup(() => {
        // Create mock extension context
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => {},
                keys: () => []
            },
            extensionUri: vscode.Uri.file('/mock/extension/path'),
            extensionPath: '/mock/extension/path',
            asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
            storageUri: vscode.Uri.file('/mock/storage'),
            storagePath: '/mock/storage',
            globalStorageUri: vscode.Uri.file('/mock/global/storage'),
            globalStoragePath: '/mock/global/storage',
            logUri: vscode.Uri.file('/mock/log'),
            logPath: '/mock/log',
            extensionMode: vscode.ExtensionMode.Test,
            environmentVariableCollection: {} as any,
            secrets: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {
                onDidChange: new vscode.EventEmitter().event,
                canSendRequest: () => undefined
            } as any
        };

        templateManager = new TemplateManager(mockContext);
    });

    test('Should initialize with built-in templates', () => {
        const templates = templateManager.getTemplates();
        
        assert.ok(templates.length >= 3, 'Should have at least 3 built-in templates');
        
        const templateIds = templates.map(t => t.id);
        assert.ok(templateIds.includes('basic'), 'Should include basic template');
        assert.ok(templateIds.includes('prd'), 'Should include PRD template');
        assert.ok(templateIds.includes('requirements'), 'Should include requirements template');
    });

    test('Should get template by ID', () => {
        const basicTemplate = templateManager.getTemplate('basic');
        
        assert.ok(basicTemplate, 'Should find basic template');
        assert.strictEqual(basicTemplate.id, 'basic');
        assert.strictEqual(basicTemplate.name, 'Basic Document');
        assert.ok(basicTemplate.content.includes('{{title}}'), 'Should contain title variable');
    });

    test('Should return undefined for non-existent template', () => {
        const nonExistentTemplate = templateManager.getTemplate('non-existent');
        assert.strictEqual(nonExistentTemplate, undefined);
    });

    test('Should render template with variables', () => {
        const result = templateManager.renderTemplate('basic', {
            variables: {
                title: 'Test Document',
                content: 'This is test content'
            },
            currentDate: new Date('2024-01-01'),
            workspaceRoot: '/test/workspace',
            userInfo: { name: 'Test User' }
        });

        assert.ok(result, 'Should return render result');
        assert.ok(result.content.includes('Test Document'), 'Should substitute title variable');
        assert.ok(result.content.includes('This is test content'), 'Should substitute content variable');
        assert.ok(result.content.includes('2024-01-01'), 'Should substitute current date');
        assert.strictEqual(result.frontMatter.title, 'Test Document');
        assert.strictEqual(result.frontMatter.author, 'Test User');
    });

    test('Should throw error for missing required variables', () => {
        assert.throws(() => {
            templateManager.renderTemplate('basic', {
                variables: {
                    // Missing required 'title' variable
                    content: 'This is test content'
                },
                currentDate: new Date('2024-01-01'),
                workspaceRoot: '/test/workspace'
            });
        }, /Missing required variables: title/);
    });

    test('Should use default values for optional variables', () => {
        const result = templateManager.renderTemplate('basic', {
            variables: {
                title: 'Test Document'
                // Missing optional variables should use defaults
            },
            currentDate: new Date('2024-01-01'),
            workspaceRoot: '/test/workspace'
        });

        assert.ok(result, 'Should return render result');
        assert.ok(result.content.includes('Add your content here...'), 'Should use default content');
    });

    test('Should filter templates by agent', () => {
        const prdTemplates = templateManager.getTemplatesForAgent('prd-creator');
        const allTemplates = templateManager.getTemplates();

        assert.ok(prdTemplates.length <= allTemplates.length, 'Filtered templates should be subset');
        
        // PRD template should be available to prd-creator
        const prdTemplate = prdTemplates.find(t => t.id === 'prd');
        assert.ok(prdTemplate, 'PRD template should be available to prd-creator');
    });

    test('Should extract variables from template content', () => {
        const template = templateManager.getTemplate('basic');
        assert.ok(template, 'Basic template should exist');

        const variables = template.variables;
        const variableNames = variables.map(v => v.name);

        assert.ok(variableNames.includes('title'), 'Should include title variable');
        assert.ok(variableNames.includes('content'), 'Should include content variable');
    });

    test('Should validate template metadata', () => {
        const templates = templateManager.getTemplates();
        
        for (const template of templates) {
            assert.ok(template.id, `Template should have ID: ${JSON.stringify(template)}`);
            assert.ok(template.name, `Template should have name: ${template.id}`);
            assert.ok(template.description, `Template should have description: ${template.id}`);
            assert.ok(Array.isArray(template.variables), `Template should have variables array: ${template.id}`);
        }
    });
});