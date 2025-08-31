// Unit tests for TemplateManager
import * as assert from 'assert';
import * as vscode from 'vscode';
import { TemplateManager } from '../../templates/TemplateManager';

describe('TemplateManager Unit Tests', () => {
    let templateManager: TemplateManager;
    let mockContext: vscode.ExtensionContext;

    beforeAll(() => {
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

    test('Should get template by ID', async () => {
        const basicTemplate = await templateManager.getTemplate('basic');
        
        assert.ok(basicTemplate, 'Should find basic template');
        assert.strictEqual(basicTemplate.id, 'basic');
        assert.strictEqual(basicTemplate.name, 'Basic Document');
        assert.ok(basicTemplate.content.includes('{{title}}'), 'Should contain title variable');
    });

    test('Should return undefined for non-existent template', async () => {
        try {
            await templateManager.getTemplate('non-existent');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('not found'));
        }
    });

    test('Should render template with variables', async () => {
        const result = await templateManager.renderTemplate('basic', {
            title: 'Test Document',
            description: 'This is test content',
            author: 'Test User',
            created: '2024-01-01'
        });

        assert.ok(result, 'Should return render result');
        assert.ok(result.success, 'Should render successfully');
        assert.ok(result.content?.includes('Test Document'), 'Should substitute title variable');
        assert.ok(result.content?.includes('This is test content'), 'Should substitute description variable');
        assert.ok(result.content?.includes('2024-01-01'), 'Should substitute created date');
        assert.strictEqual(result.frontMatter?.title, 'Test Document');
        assert.strictEqual(result.frontMatter?.author, 'Test User');
    });

    test('Should throw error for missing required variables', async () => {
        const result = await templateManager.renderTemplate('basic', {
            // Missing required 'title' variable
            content: 'This is test content'
        });
        
        assert.strictEqual(result.success, false);
        assert.ok(result.error?.includes('Missing required variables'));
    });

    test('Should use default values for optional variables', async () => {
        const result = await templateManager.renderTemplate('basic', {
            title: 'Test Document'
            // Missing optional variables should use defaults
        });

        assert.ok(result, 'Should return render result');
        if (!result.success) {
            console.log('Render failed:', result.error);
            console.log('Missing variables:', result.missingVariables);
        }
        assert.ok(result.success, 'Should render successfully');
        assert.ok(result.content?.includes('<!-- Add your content here -->'), 'Should use default content');
    });

    test('Should filter templates by agent', () => {
        const prdTemplates = templateManager.getTemplatesForAgent('prd-creator');
        const allTemplates = templateManager.getTemplates();

        assert.ok(prdTemplates.length <= allTemplates.length, 'Filtered templates should be subset');
        
        // PRD template should be available to prd-creator
        const prdTemplate = prdTemplates.find(t => t.id === 'prd');
        assert.ok(prdTemplate, 'PRD template should be available to prd-creator');
    });

    test('Should extract variables from template content', async () => {
        const template = await templateManager.getTemplate('basic');
        assert.ok(template, 'Basic template should exist');

        const variables = template.variables;
        const variableNames = variables.map(v => v.name);

        assert.ok(variableNames.includes('title'), 'Should include title variable');
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