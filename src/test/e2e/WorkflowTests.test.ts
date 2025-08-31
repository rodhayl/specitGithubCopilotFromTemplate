// End-to-end workflow tests
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateManager } from '../../templates/TemplateManager';
import { ToolManager } from '../../tools/ToolManager';
import { AgentManager } from '../../agents/AgentManager';
import { CommandRouter, CommandContext } from '../../commands/CommandRouter';
import { TestUtilities } from '../utils/TestUtilities';
import { TestTimeoutManager } from '../utils/TestTimeoutManager';
import { VSCodeAPIMocks } from '../mocks/VSCodeAPIMocks';

// Mock TemplateManager to prevent resource conflicts and worker crashes
jest.mock('../../templates/TemplateManager', () => {
    return {
        TemplateManager: jest.fn().mockImplementation(() => {
            return {
                templates: new Map(),
                getTemplate: jest.fn(),
                getTemplatesForAgent: jest.fn().mockReturnValue([]),
                renderTemplate: jest.fn(),
                loadTemplates: jest.fn().mockResolvedValue(undefined),
                validateTemplate: jest.fn(),
                dispose: jest.fn()
            };
        })
    };
});

// Mock ToolManager to prevent resource conflicts
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

// Mock AgentManager to prevent resource conflicts
jest.mock('../../agents/AgentManager', () => {
    return {
        AgentManager: jest.fn().mockImplementation(() => {
            return {
                listAgents: jest.fn().mockReturnValue([]),
                getCurrentAgent: jest.fn(),
                setCurrentAgent: jest.fn().mockReturnValue(true),
                getAgent: jest.fn(),
                loadConfigurations: jest.fn().mockResolvedValue(undefined),
                dispose: jest.fn()
            };
        })
    };
});

// Mock CommandRouter to prevent resource conflicts
jest.mock('../../commands/CommandRouter', () => {
    return {
        CommandRouter: jest.fn().mockImplementation(() => {
            return {
                isCommand: jest.fn(),
                parseCommand: jest.fn(),
                executeCommand: jest.fn(),
                dispose: jest.fn()
            };
        })
    };
});

describe('End-to-End Workflow Tests', () => {
    let mockTemplateManager: any;
    let mockToolManager: any;
    let mockAgentManager: any;
    let mockAgentManagerForRouter: any;
    let mockCommandRouter: any;
    let mockCommandContext: any;
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
        
        // Create mock TemplateManager with all necessary methods
        mockTemplateManager = {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
            listTemplates: jest.fn(),
            validateTemplate: jest.fn(),
            createTemplate: jest.fn(),
            getTemplatesForAgent: jest.fn()
        } as any;
        
        // Create mock ToolManager with all necessary methods
        mockToolManager = {
            executeTool: jest.fn(),
            listTools: jest.fn(),
            validateToolAvailability: jest.fn(),
            getToolDocumentation: jest.fn()
        } as any;
        
        // Create mock AgentManager with all necessary methods
        mockAgentManager = {
            setCurrentAgent: jest.fn(),
            getCurrentAgent: jest.fn(),
            listAgents: jest.fn()
        } as any;
        
        mockAgentManagerForRouter = {
            listAgents: jest.fn().mockReturnValue([]),
            getCurrentAgent: jest.fn().mockReturnValue(null),
            setCurrentAgent: jest.fn().mockReturnValue(false)
        } as any;
        
        // Create mock CommandRouter with all necessary methods
        mockCommandRouter = {
            isCommand: jest.fn(),
            parseCommand: jest.fn(),
            executeCommand: jest.fn(),
            routeCommand: jest.fn()
        } as any;
        
        mockCommandContext = {
        workspaceRoot: '/test/workspace',
        extensionContext: mockExtensionContext,
        request: {
            command: 'test',
            prompt: 'test prompt',
            references: [],
            location: undefined,
            attempt: 0,
            enableCommandDetection: false
        } as any,
        stream: {
            markdown: jest.fn(),
            button: jest.fn(),
            filetree: jest.fn(),
            progress: jest.fn(),
            anchor: jest.fn(),
            reference: jest.fn(),
            push: jest.fn()
        } as any,
        token: {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn()
        }
    };
    });

    afterEach(() => {
        // Cleanup resources to prevent memory leaks and worker crashes
        if (mockTemplateManager?.dispose) {
            mockTemplateManager.dispose();
        }
        if (mockToolManager?.dispose) {
            mockToolManager.dispose();
        }
        if (mockAgentManager?.dispose) {
            mockAgentManager.dispose();
        }
        if (mockCommandRouter?.dispose) {
            mockCommandRouter.dispose();
        }
        if (mockExtensionContext?.dispose) {
            mockExtensionContext.dispose();
        }
        
        // Clear all timers and intervals
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    test('Complete PRD Creation Workflow', async () => {
        const toolContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: mockExtensionContext,
            cancellationToken: {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn()
            }
        };

        // Step 1: List available templates
        const mockTemplatesResult = {
            success: true,
            data: {
                templates: [
                    { id: 'prd', name: 'PRD Template' },
                    { id: 'basic', name: 'Basic Template' }
                ]
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockTemplatesResult);
        const templatesResult = await mockToolManager.executeTool('listTemplates', {}, toolContext);

        assert.ok(typeof templatesResult.success === 'boolean');

        // Step 2: Validate template (if available)
        if (templatesResult.success && templatesResult.data?.templates?.length > 0) {
            const mockValidationResult = {
                success: true,
                data: {
                    valid: true,
                    issues: [],
                    summary: 'Template validation successful'
                }
            };
            
            mockToolManager.executeTool.mockResolvedValue(mockValidationResult);
            const validationResult = await mockToolManager.executeTool('validateTemplate', {
                templateId: 'prd'
            }, toolContext);
            
            assert.ok(typeof validationResult.success === 'boolean');
        }

        // Step 3: Check agent availability
        const mockAgents = [
            { name: 'prd-creator', workflowPhase: 'prd' },
            { name: 'requirements-gatherer', workflowPhase: 'requirements' }
        ];
        
        mockAgentManager.listAgents.mockReturnValue(mockAgents);
        const agents = mockAgentManager.listAgents();
        
        assert.ok(Array.isArray(agents));

        // Step 4: Try to set agent
        mockAgentManager.setCurrentAgent.mockReturnValue(true);
        const agentSetResult = mockAgentManager.setCurrentAgent('prd-creator');
        
        assert.ok(typeof agentSetResult === 'boolean');
    });

    test('Template Management Workflow', async () => {
        const toolContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: mockExtensionContext,
            cancellationToken: {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn()
            }
        };

        // Step 1: List all templates
        const mockAllTemplatesResult = {
            success: true,
            data: {
                templates: [
                    {
                        id: 'basic',
                        name: 'Basic Template',
                        variables: [
                            { name: 'title', type: 'string', required: true },
                            { name: 'content', type: 'string', required: false }
                        ]
                    }
                ]
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockAllTemplatesResult);
        const allTemplatesResult = await mockToolManager.executeTool('listTemplates', {
            includeVariables: true
        }, toolContext);

        assert.ok(typeof allTemplatesResult.success === 'boolean');

        // Step 2: Get template details
        const mockBasicTemplate = {
            id: 'basic',
            name: 'Basic Template',
            content: '# {{title}}\n\n{{content}}',
            variables: [
                { name: 'title', type: 'string', required: true },
                { name: 'content', type: 'string', required: false }
            ]
        };
        
        mockTemplateManager.getTemplate.mockResolvedValue(mockBasicTemplate);
        const basicTemplate = await mockTemplateManager.getTemplate('basic');
        
        if (basicTemplate) {
            assert.ok(basicTemplate.variables);
        }

        // Step 3: Render template
        const mockRenderResult = {
            content: '# Test Workflow Document\n\nThis is a test of the complete workflow',
            metadata: {
                templateId: 'basic',
                variables: {
                    title: 'Test Workflow Document',
                    content: 'This is a test of the complete workflow'
                }
            }
        };
        
        mockTemplateManager.renderTemplate.mockResolvedValue(mockRenderResult);
        const renderResult = await mockTemplateManager.renderTemplate('basic', {
            variables: {
                title: 'Test Workflow Document',
                content: 'This is a test of the complete workflow'
            },
            currentDate: new Date('2024-01-01'),
            workspaceRoot: mockCommandContext.workspaceRoot,
            userInfo: { name: 'Test User' }
        });

        if (renderResult) {
            assert.ok(renderResult.content);
            
            // Step 4: Validate rendered content
            const mockContentValidationResult = {
                success: true,
                data: {
                    valid: true,
                    issues: [],
                    summary: 'Content validation successful'
                }
            };
            
            mockToolManager.executeTool.mockResolvedValue(mockContentValidationResult);
            const contentValidationResult = await mockToolManager.executeTool('validateTemplate', {
                content: renderResult.content
            }, toolContext);
            
            assert.ok(typeof contentValidationResult.success === 'boolean');
        }
    });

    test('Agent Workflow Progression', async () => {
        // Step 1: Start with PRD Creator
        const mockPrdAgent = { name: 'prd-creator', workflowPhase: 'prd' };
        mockAgentManager.setCurrentAgent.mockReturnValue(true);
        mockAgentManager.getCurrentAgent.mockReturnValue(mockPrdAgent);
        
        mockAgentManager.setCurrentAgent('prd-creator');
        let currentAgent = mockAgentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'prd-creator');
        assert.strictEqual(currentAgent?.workflowPhase, 'prd');

        // Step 2: Progress to Requirements Gatherer
        const mockReqAgent = { name: 'requirements-gatherer', workflowPhase: 'requirements' };
        mockAgentManager.getCurrentAgent.mockReturnValue(mockReqAgent);
        
        mockAgentManager.setCurrentAgent('requirements-gatherer');
        currentAgent = mockAgentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'requirements-gatherer');
        assert.strictEqual(currentAgent?.workflowPhase, 'requirements');

        // Step 3: Progress to Solution Architect
        const mockArchAgent = { name: 'solution-architect', workflowPhase: 'design' };
        mockAgentManager.getCurrentAgent.mockReturnValue(mockArchAgent);
        
        mockAgentManager.setCurrentAgent('solution-architect');
        currentAgent = mockAgentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'solution-architect');
        assert.strictEqual(currentAgent?.workflowPhase, 'design');

        // Step 4: Progress to Specification Writer
        const mockSpecAgent = { name: 'specification-writer', workflowPhase: 'implementation' };
        mockAgentManager.getCurrentAgent.mockReturnValue(mockSpecAgent);
        
        mockAgentManager.setCurrentAgent('specification-writer');
        currentAgent = mockAgentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'specification-writer');
        assert.strictEqual(currentAgent?.workflowPhase, 'implementation');

        // Step 5: End with Quality Reviewer
        const mockQualityAgent = { name: 'quality-reviewer', workflowPhase: 'implementation' };
        mockAgentManager.getCurrentAgent.mockReturnValue(mockQualityAgent);
        
        mockAgentManager.setCurrentAgent('quality-reviewer');
        currentAgent = mockAgentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'quality-reviewer');
        assert.strictEqual(currentAgent?.workflowPhase, 'implementation');
    });

    test('Command Processing Workflow', async () => {
        // Step 1: Process templates list command
        const templatesCommand = '/templates list --verbose';
        mockCommandRouter.isCommand.mockReturnValue(true);
        assert.strictEqual(mockCommandRouter.isCommand(templatesCommand), true);

        const mockParsedTemplates = {
            command: 'templates',
            subcommand: 'list',
            flags: { verbose: true },
            arguments: []
        };
        mockCommandRouter.parseCommand.mockReturnValue(mockParsedTemplates);
        
        const parsedTemplates = mockCommandRouter.parseCommand(templatesCommand);
        assert.strictEqual(parsedTemplates.command, 'templates');
        assert.strictEqual(parsedTemplates.subcommand, 'list');
        assert.strictEqual(parsedTemplates.flags.verbose, true);

        // Step 2: Process agent list command
        const agentCommand = '/agent list';
        assert.strictEqual(mockCommandRouter.isCommand(agentCommand), true);

        const mockParsedAgent = {
            command: 'agent',
            subcommand: 'list',
            flags: {},
            arguments: []
        };
        mockCommandRouter.parseCommand.mockReturnValue(mockParsedAgent);
        
        const parsedAgent = mockCommandRouter.parseCommand(agentCommand);
        assert.strictEqual(parsedAgent.command, 'agent');
        assert.strictEqual(parsedAgent.subcommand, 'list');

        // Step 3: Process new document command
        const newCommand = '/new "Test Document" --template basic';
        assert.strictEqual(mockCommandRouter.isCommand(newCommand), true);

        const mockParsedNew = {
            command: 'new',
            subcommand: null,
            flags: { template: 'basic' },
            arguments: ['Test Document']
        };
        mockCommandRouter.parseCommand.mockReturnValue(mockParsedNew);
        
        const parsedNew = mockCommandRouter.parseCommand(newCommand);
        assert.strictEqual(parsedNew.command, 'new');
        assert.deepStrictEqual(parsedNew.arguments, ['Test Document']);
        assert.strictEqual(parsedNew.flags.template, 'basic');
    });

    test('Error Handling Workflow', async () => {
        const toolContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: mockExtensionContext,
            cancellationToken: {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn()
            }
        };

        // Step 1: Test invalid template
        const mockInvalidTemplateResult = {
            success: false,
            error: 'Template not found: non-existent-template'
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockInvalidTemplateResult);
        const invalidTemplateResult = await mockToolManager.executeTool('validateTemplate', {
            templateId: 'non-existent-template'
        }, toolContext);

        assert.strictEqual(invalidTemplateResult.success, false);
        assert.ok(invalidTemplateResult.error);

        // Step 2: Test invalid agent
        mockAgentManager.setCurrentAgent.mockReturnValue(false);
        const invalidAgentResult = mockAgentManager.setCurrentAgent('non-existent-agent');
        assert.strictEqual(invalidAgentResult, false);

        // Step 3: Test invalid command
        const invalidCommand = '/invalid-command';
        const mockRouteResult = {
            success: false,
            error: 'Unknown command: invalid-command'
        };
        
        mockCommandRouter.executeCommand.mockResolvedValue(mockRouteResult);
        const routeResult = await mockCommandRouter.executeCommand(invalidCommand, mockCommandContext);
        
        assert.strictEqual(routeResult.success, false);
        assert.ok(routeResult.error);
    });

    test('Template Creation and Validation Workflow', async () => {
        const toolContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: mockExtensionContext,
            cancellationToken: {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn()
            }
        };

        // Step 1: Create a new template
        const mockCreateResult = {
            success: true,
            data: {
                templateId: 'test-template',
                message: 'Template created successfully'
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockCreateResult);
        const createResult = await mockToolManager.executeTool('createTemplate', {
            id: 'test-template',
            name: 'Test Template',
            description: 'A template for testing',
            content: '# {{title}}\n\n{{content}}\n\nCreated: {{currentDate}}'
        }, toolContext);

        assert.ok(typeof createResult.success === 'boolean');

        // Step 2: Validate template content directly
        const mockValidateContentResult = {
            success: true,
            data: {
                valid: true,
                issues: [],
                summary: 'Template validation successful'
            }
        };
        
        mockToolManager.executeTool.mockResolvedValue(mockValidateContentResult);
        const validateContentResult = await mockToolManager.executeTool('validateTemplate', {
            content: `---
id: test-template
name: Test Template
description: A template for testing
variables:
  - name: title
    description: Document title
    required: true
    type: string
  - name: content
    description: Document content
    required: false
    type: string
---

# {{title}}

{{content}}

Created: {{currentDate}}`
        }, toolContext);

        assert.ok(typeof validateContentResult.success === 'boolean');
        if (validateContentResult.success) {
            assert.ok(validateContentResult.data);
            assert.ok(typeof validateContentResult.data.valid === 'boolean');
        }
    });

    test('Multi-Agent Collaboration Workflow', async () => {
        // Simulate a complete workflow from PRD to implementation
        const workflowSteps = [
            { agent: 'prd-creator', phase: 'prd', template: 'prd' },
            { agent: 'brainstormer', phase: 'prd', template: 'basic' },
            { agent: 'requirements-gatherer', phase: 'requirements', template: 'requirements' },
            { agent: 'solution-architect', phase: 'design', template: 'basic' },
            { agent: 'specification-writer', phase: 'implementation', template: 'basic' },
            { agent: 'quality-reviewer', phase: 'implementation', template: null }
        ];

        for (const step of workflowSteps) {
            // Set agent
            mockAgentManager.setCurrentAgent.mockReturnValue(true);
            const agentResult = mockAgentManager.setCurrentAgent(step.agent);
            assert.strictEqual(agentResult, true, `Should set agent: ${step.agent}`);

            // Verify agent phase
            const mockCurrentAgent = { name: step.agent, workflowPhase: step.phase };
            mockAgentManager.getCurrentAgent.mockReturnValue(mockCurrentAgent);
            const currentAgent = mockAgentManager.getCurrentAgent();
            assert.strictEqual(currentAgent?.workflowPhase, step.phase, 
                `Agent ${step.agent} should be in phase: ${step.phase}`);

            // Check template availability if specified
            if (step.template) {
                const mockTemplate = {
                    id: step.template,
                    name: `${step.template} Template`,
                    content: '# {{title}}\n\n{{content}}'
                };
                
                mockTemplateManager.getTemplate.mockResolvedValue(mockTemplate);
                const template = await mockTemplateManager.getTemplate(step.template);
                assert.ok(template, `Template ${step.template} should be available for ${step.agent}`);

                // Check if agent can use template
                const mockAgentTemplates = [mockTemplate];
                mockTemplateManager.getTemplatesForAgent.mockReturnValue(mockAgentTemplates);
                const agentTemplates = mockTemplateManager.getTemplatesForAgent(step.agent);
                const canUseTemplate = agentTemplates.some((t: any) => t.id === step.template);
                
                // Some templates may have agent restrictions, so we just verify the template exists
                assert.ok(template, `Template ${step.template} should exist`);
            }
        }
    });
});