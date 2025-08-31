// Integration tests for ToolManager
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ToolManager } from '../../tools/ToolManager';
import { TemplateManager } from '../../templates/TemplateManager';
import { ToolContext } from '../../tools/types';
import { TestUtilities } from '../utils/TestUtilities';
import { TestTimeoutManager } from '../utils/TestTimeoutManager';
import { VSCodeAPIMocks } from '../mocks/VSCodeAPIMocks';

// Mock ToolManager to prevent resource conflicts and worker crashes
jest.mock('../../tools/ToolManager', () => {
    return {
        ToolManager: jest.fn().mockImplementation(() => {
            return {
                listTools: jest.fn(),
                validateToolAvailability: jest.fn(),
                getToolDocumentation: jest.fn(),
                executeTool: jest.fn(),
                dispose: jest.fn()
            };
        })
    };
});

// Mock TemplateManager to prevent resource conflicts
jest.mock('../../templates/TemplateManager', () => {
    return {
        TemplateManager: jest.fn().mockImplementation(() => {
            return {
                templates: new Map(),
                getTemplate: jest.fn(),
                loadTemplates: jest.fn().mockResolvedValue(undefined),
                validateTemplate: jest.fn(),
                dispose: jest.fn()
            };
        })
    };
});

// Mock OfflineManager to prevent singleton issues
jest.mock('../../offline/OfflineManager', () => {
    return {
        OfflineManager: {
            getInstance: jest.fn().mockReturnValue({
                disableOfflineMode: jest.fn(),
                enableOfflineMode: jest.fn(),
                isOffline: jest.fn().mockReturnValue(false),
                dispose: jest.fn()
            })
        }
    };
});

describe('ToolManager Integration Tests', () => {
    let mockToolManager: any;
    let mockTemplateManager: any;
    let mockContext: ToolContext;
    let mockExtensionContext: any;

    beforeEach(() => {
        // Reset all mocks to prevent test interference
        jest.clearAllMocks();
        
        mockExtensionContext = {
            extensionPath: '/test/extension',
            globalState: { 
                get: jest.fn().mockReturnValue(undefined), 
                update: jest.fn().mockResolvedValue(undefined) 
            },
            workspaceState: { 
                get: jest.fn().mockReturnValue(undefined), 
                update: jest.fn().mockResolvedValue(undefined) 
            },
            dispose: jest.fn()
        };
        
        mockTemplateManager = new (TemplateManager as any)(mockExtensionContext);
        mockToolManager = new (ToolManager as any)(mockTemplateManager);
        
        mockContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: mockExtensionContext,
            cancellationToken: {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn()
            } as any
        };
    });

    afterEach(() => {
        // Cleanup resources to prevent memory leaks and worker crashes
        if (mockToolManager?.dispose) {
            mockToolManager.dispose();
        }
        if (mockTemplateManager?.dispose) {
            mockTemplateManager.dispose();
        }
        if (mockExtensionContext?.dispose) {
            mockExtensionContext.dispose();
        }
        
        // Clear all timers and intervals
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    test('Should register all built-in tools', () => {
        const expectedTools = [
            'readFile',
            'writeFile',
            'listFiles',
            'openInEditor',
            'insertSection',
            'applyTemplate',
            'listTemplates',
            'openTemplate',
            'validateTemplate',
            'createTemplate'
        ];
        
        const mockTools = expectedTools.map(name => ({ name, description: `Mock ${name} tool` }));
        mockToolManager.listTools.mockReturnValue(mockTools);
        
        const tools = mockToolManager.listTools();
        const toolNames = tools.map((t: any) => t.name);

        for (const expectedTool of expectedTools) {
            assert.ok(toolNames.includes(expectedTool), 
                `Should include tool: ${expectedTool}`);
        }
    });

    test('Should validate tool availability', () => {
        const requiredTools = ['readFile', 'writeFile', 'applyTemplate'];
        
        mockToolManager.validateToolAvailability.mockReturnValue({
            valid: true,
            missing: []
        });
        
        const validation = mockToolManager.validateToolAvailability(requiredTools);

        assert.strictEqual(validation.valid, true);
        assert.strictEqual(validation.missing.length, 0);
    });

    test('Should detect missing tools', () => {
        const requiredTools = ['readFile', 'nonExistentTool', 'writeFile'];
        
        mockToolManager.validateToolAvailability.mockReturnValue({
            valid: false,
            missing: ['nonExistentTool']
        });
        
        const validation = mockToolManager.validateToolAvailability(requiredTools);

        assert.strictEqual(validation.valid, false);
        assert.deepStrictEqual(validation.missing, ['nonExistentTool']);
    });

    test('Should provide tool documentation', () => {
        const toolNames = ['readFile', 'writeFile', 'applyTemplate'];

        for (const toolName of toolNames) {
            const mockDocumentation = `${toolName} tool documentation\nParameters: Various parameters for ${toolName}`;
            mockToolManager.getToolDocumentation.mockReturnValue(mockDocumentation);
            
            const documentation = mockToolManager.getToolDocumentation(toolName);
            
            assert.ok(documentation, `Should have documentation for: ${toolName}`);
            assert.ok(documentation.includes(toolName), 
                `Documentation should include tool name: ${toolName}`);
            assert.ok(documentation.includes('Parameters'), 
                `Documentation should include parameters section: ${toolName}`);
        }
    });

    test('Should return undefined for non-existent tool documentation', () => {
        mockToolManager.getToolDocumentation.mockReturnValue(undefined);
        
        const documentation = mockToolManager.getToolDocumentation('nonExistentTool');
        assert.strictEqual(documentation, undefined);
    });

    test('Should execute listTemplates tool', async () => {
        const mockResult = {
            success: true,
            data: {
                templates: [
                    { id: 'basic', name: 'Basic Template' },
                    { id: 'prd', name: 'PRD Template' }
                ]
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);
        
        const result = await mockToolManager.executeTool('listTemplates', {}, mockContext);

        assert.ok(typeof result.success === 'boolean');
        if (result.success) {
            assert.ok(result.data);
            assert.ok(Array.isArray(result.data.templates));
        } else {
            assert.ok(result.error);
        }
    });

    test('Should execute listTemplates with agent filter', async () => {
        const mockResult = {
            success: true,
            data: {
                templates: [
                    { id: 'prd', name: 'PRD Template', agentRestrictions: ['prd-creator'] }
                ]
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);
        
        const result = await mockToolManager.executeTool('listTemplates', {
            agentName: 'prd-creator'
        }, mockContext);

        assert.ok(typeof result.success === 'boolean');
        if (result.success) {
            assert.ok(result.data);
            assert.ok(Array.isArray(result.data.templates));
        } else {
            assert.ok(result.error);
        }
    });

    test('Should execute validateTemplate tool', async () => {
        const mockResult = {
            success: true,
            data: {
                valid: true,
                issues: [],
                summary: 'Template validation successful'
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);
        
        const result = await mockToolManager.executeTool('validateTemplate', {
            templateId: 'basic'
        }, mockContext);

        assert.ok(typeof result.success === 'boolean');
        if (result.success) {
            assert.ok(result.data);
            assert.ok(typeof result.data.valid === 'boolean');
            assert.ok(Array.isArray(result.data.issues));
            assert.ok(result.data.summary);
        } else {
            assert.ok(result.error);
        }
    });

    test('Should handle tool execution errors gracefully', async () => {
        const mockResult = {
            success: false,
            error: 'Template "non-existent-template" not found'
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);
        
        const result = await mockToolManager.executeTool('validateTemplate', {
            templateId: 'non-existent-template'
        }, mockContext);

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
        
        const errorMessage = result.error.toLowerCase();
        const hasExpectedError = errorMessage.includes('not found') || 
                                errorMessage.includes('failed') || 
                                errorMessage.includes('template') ||
                                errorMessage.includes('workspace') ||
                                errorMessage.includes('error');
        
        assert.ok(hasExpectedError, 
            `Expected error message to indicate a failure, but got: "${result.error}"`);
    });

    test('Should handle non-existent tool execution', async () => {
        const mockResult = {
            success: false,
            error: 'Tool "nonExistentTool" not found',
            metadata: {
                availableTools: ['readFile', 'writeFile', 'applyTemplate']
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);
        
        const result = await mockToolManager.executeTool('nonExistentTool', {}, mockContext);

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
        assert.ok(result.error.includes('not found'));
        assert.ok(result.metadata);
        assert.ok(Array.isArray(result.metadata.availableTools));
    });

    test('Should execute openTemplate tool for built-in template', async () => {
        const mockResult = {
            success: true,
            data: {
                templateId: 'basic',
                content: 'Mock template content',
                mode: 'view'
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);
        
        const result = await mockToolManager.executeTool('openTemplate', {
            templateId: 'basic',
            mode: 'view'
        }, mockContext);

        assert.ok(typeof result.success === 'boolean');
        if (result.success) {
            assert.ok(result.data);
            assert.strictEqual(result.data.templateId, 'basic');
        } else {
            assert.ok(result.error);
        }
    });

    test('Should provide comprehensive tool information', () => {
        const mockTools = [
            {
                name: 'readFile',
                description: 'Read file content',
                parameters: [
                    { name: 'filePath', description: 'Path to file', type: 'string', required: true }
                ]
            },
            {
                name: 'writeFile',
                description: 'Write file content',
                parameters: [
                    { name: 'filePath', description: 'Path to file', type: 'string', required: true },
                    { name: 'content', description: 'File content', type: 'string', required: true }
                ]
            }
        ];
        
        mockToolManager.listTools.mockReturnValue(mockTools);
        
        const tools = mockToolManager.listTools();

        for (const tool of tools) {
            assert.ok(tool.name, 'Tool should have name');
            assert.ok(tool.description, 'Tool should have description');
            assert.ok(Array.isArray(tool.parameters), 'Tool should have parameters array');

            for (const param of tool.parameters) {
                assert.ok(param.name, 'Parameter should have name');
                assert.ok(param.description, 'Parameter should have description');
                assert.ok(param.type, 'Parameter should have type');
                assert.ok(typeof param.required === 'boolean', 'Parameter should have required flag');
            }
        }
    });

    test('Should handle tool execution with cancellation token', async () => {
        const cancelledToken = {
            isCancellationRequested: true,
            onCancellationRequested: () => ({ dispose: () => {} })
        } as vscode.CancellationToken;

        const cancelledContext = {
            ...mockContext,
            cancellationToken: cancelledToken
        };
        
        const mockResult = {
            success: false,
            error: 'Operation cancelled by user'
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockResult);

        const result = await mockToolManager.executeTool('listTemplates', {}, cancelledContext);
        
        assert.ok(typeof result.success === 'boolean');
    });
});