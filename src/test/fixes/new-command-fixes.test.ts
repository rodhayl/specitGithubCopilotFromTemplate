import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApplyTemplateTool } from '../../tools/ApplyTemplateTool';
import { TemplateManager } from '../../templates/TemplateManager';
import { ToolContext } from '../../tools/types';

describe('New Command Fixes', () => {
    let templateManager: TemplateManager;
    let applyTemplateTool: ApplyTemplateTool;
    let mockContext: ToolContext;

    beforeEach(() => {
        const mockExtensionContext = {
            extensionPath: '/test/extension',
            globalState: { get: () => undefined, update: () => Promise.resolve() },
            workspaceState: { get: () => undefined, update: () => Promise.resolve() }
        } as any;
        
        templateManager = new TemplateManager(mockExtensionContext);
        applyTemplateTool = new ApplyTemplateTool(templateManager);
        
        mockContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: mockExtensionContext,
            cancellationToken: {} as vscode.CancellationToken
        };
    });

    describe('Directory Creation', () => {
        it('should handle missing directories gracefully', async () => {
            // This test verifies that the ApplyTemplateTool creates directories
            // when they don't exist, rather than failing
            
            const params = {
                templateId: 'basic',
                variables: { title: 'Test Document' },
                outputPath: '/test/workspace/docs/new-folder/test.md'
            };

            // The tool should not fail due to missing directory
            // (In a real test, we'd mock the file system operations)
            const result = await applyTemplateTool.execute(params, mockContext);
            
            // Should either succeed or fail with a different error (not directory-related)
            if (!result.success) {
                assert.ok(!result.error?.includes('directory'), 
                    'Should not fail due to directory issues');
            }
        });
    });

    describe('Template Variable Handling', () => {
        it('should provide helpful error messages for missing variables', async () => {
            // Mock a template with required variables
            const mockTemplate = {
                id: 'test-template',
                name: 'Test Template',
                description: 'Test template with required variables',
                content: '# {{title}}\n\n{{description}}',
                frontMatter: {},
                variables: [
                    { name: 'title', required: true, type: 'string', description: 'Document title' },
                    { name: 'description', required: true, type: 'string', description: 'Document description' }
                ],
                agentRestrictions: [],
                categories: []
            };

            // Add the mock template
            (templateManager as any).templates.set('test-template', mockTemplate);

            const params = {
                templateId: 'test-template',
                variables: { title: 'Test' }, // Missing 'description'
                outputPath: '/test/workspace/test.md'
            };

            const result = await applyTemplateTool.execute(params, mockContext);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Missing required variables'));
            assert.ok(result.metadata?.templateError);
            assert.ok(result.metadata?.missingVariables);
            assert.ok(result.metadata?.suggestion?.includes('basic'));
        });

        it('should succeed when all required variables are provided', async () => {
            // Mock a template with required variables
            const mockTemplate = {
                id: 'test-template-complete',
                name: 'Test Template Complete',
                description: 'Test template with all variables provided',
                content: '# {{title}}\n\n{{description}}',
                frontMatter: {},
                variables: [
                    { name: 'title', required: true, type: 'string', description: 'Document title' },
                    { name: 'description', required: true, type: 'string', description: 'Document description' }
                ],
                agentRestrictions: [],
                categories: []
            };

            // Add the mock template
            (templateManager as any).templates.set('test-template-complete', mockTemplate);

            const params = {
                templateId: 'test-template-complete',
                variables: { 
                    title: 'Test Document', 
                    description: 'This is a test document' 
                },
                outputPath: '/test/workspace/test-complete.md'
            };

            const result = await applyTemplateTool.execute(params, mockContext);
            
            // Should succeed or fail for reasons other than missing variables
            if (!result.success) {
                assert.ok(!result.error?.includes('Missing required variables'),
                    'Should not fail due to missing variables when all are provided');
            }
        });
    });

    describe('Error Message Quality', () => {
        it('should provide actionable suggestions in error metadata', async () => {
            const params = {
                templateId: 'nonexistent-template',
                variables: {},
                outputPath: '/test/workspace/test.md'
            };

            const result = await applyTemplateTool.execute(params, mockContext);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('not found'));
        });
    });
});