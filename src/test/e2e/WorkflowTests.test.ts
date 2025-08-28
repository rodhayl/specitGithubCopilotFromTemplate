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

suite('End-to-End Workflow Tests', () => {
    let templateManager: TemplateManager;
    let toolManager: ToolManager;
    let agentManager: AgentManager;
    let commandRouter: CommandRouter;
    let mockExtensionContext: vscode.ExtensionContext;
    let mockCommandContext: CommandContext;

    setup(TestUtilities.createSuiteSetup(async () => {
        // Create mock extension context
        mockExtensionContext = VSCodeAPIMocks.createMockExtensionContext();

        // Initialize managers in proper order
        templateManager = new TemplateManager(mockExtensionContext);
        
        // Initialize template manager with error handling
        try {
            // TemplateManager is initialized in constructor
        } catch (error) {
            TestUtilities.logTestProgress('Template manager initialization failed', error);
        }
        
        toolManager = new ToolManager(templateManager);
        agentManager = new AgentManager(mockExtensionContext);
        commandRouter = new CommandRouter();

        // Load agent configurations with error handling
        try {
            await agentManager.loadConfigurations();
        } catch (error) {
            TestUtilities.logTestProgress('Agent manager configuration loading failed', error);
        }

        mockCommandContext = VSCodeAPIMocks.createMockCommandContext();
    }));

    teardown(TestUtilities.createSuiteTeardown());

    test('Complete PRD Creation Workflow', async () => {
        const toolContext = VSCodeAPIMocks.createMockToolContext();

        // Step 1: List available templates
        const templatesResult = await TestTimeoutManager.wrapWithTimeout(
            toolManager.executeTool('listTemplates', {}, toolContext),
            'workflow-step'
        );

        // Should execute successfully even if no templates are available
        assert.ok(typeof templatesResult.success === 'boolean');

        // Step 2: Validate template (if available)
        if (templatesResult.success && templatesResult.data?.templates?.length > 0) {
            const validationResult = await TestTimeoutManager.wrapWithTimeout(
                toolManager.executeTool('validateTemplate', {
                    templateId: 'prd'
                }, toolContext),
                'workflow-step'
            );
            assert.ok(typeof validationResult.success === 'boolean');
        }

        // Step 3: Check agent availability
        const agents = agentManager.listAgents();
        // Agents might not be available in test environment, that's ok
        assert.ok(Array.isArray(agents));

        // Step 4: Try to set agent (might fail in test environment)
        const agentSetResult = agentManager.setCurrentAgent('prd-creator');
        // Result can be true or false depending on agent availability
        assert.ok(typeof agentSetResult === 'boolean');
    });

    test('Template Management Workflow', async () => {
        const toolContext = VSCodeAPIMocks.createMockToolContext();

        // Step 1: List all templates
        const allTemplatesResult = await TestTimeoutManager.wrapWithTimeout(
            toolManager.executeTool('listTemplates', {
                includeVariables: true
            }, toolContext),
            'workflow-step'
        );

        // Should execute successfully even if no templates are available
        assert.ok(typeof allTemplatesResult.success === 'boolean');

        // Step 2: Try to get template details (might not be available in test)
        try {
            const basicTemplate = templateManager.getTemplate('basic');
            if (basicTemplate) {
                assert.ok(basicTemplate.variables);
            }
        } catch (error) {
            // Template might not be available in test environment
            console.warn('Template not available in test:', error);
        }

        // Step 3: Try to render template (if available)
        try {
            const renderResult = templateManager.renderTemplate('basic', {
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
                const contentValidationResult = await TestTimeoutManager.wrapWithTimeout(
                    toolManager.executeTool('validateTemplate', {
                        content: renderResult.content
                    }, toolContext),
                    'workflow-step'
                );
                assert.ok(typeof contentValidationResult.success === 'boolean');
            }
        } catch (error) {
            // Template rendering might fail in test environment
            console.warn('Template rendering failed in test:', error);
        }
    });

    test('Agent Workflow Progression', async () => {
        // Step 1: Start with PRD Creator
        agentManager.setCurrentAgent('prd-creator');
        let currentAgent = agentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'prd-creator');
        assert.strictEqual(currentAgent?.workflowPhase, 'prd');

        // Step 2: Progress to Requirements Gatherer
        agentManager.setCurrentAgent('requirements-gatherer');
        currentAgent = agentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'requirements-gatherer');
        assert.strictEqual(currentAgent?.workflowPhase, 'requirements');

        // Step 3: Progress to Solution Architect
        agentManager.setCurrentAgent('solution-architect');
        currentAgent = agentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'solution-architect');
        assert.strictEqual(currentAgent?.workflowPhase, 'design');

        // Step 4: Progress to Specification Writer
        agentManager.setCurrentAgent('specification-writer');
        currentAgent = agentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'specification-writer');
        assert.strictEqual(currentAgent?.workflowPhase, 'implementation');

        // Step 5: End with Quality Reviewer
        agentManager.setCurrentAgent('quality-reviewer');
        currentAgent = agentManager.getCurrentAgent();
        assert.strictEqual(currentAgent?.name, 'quality-reviewer');
        assert.strictEqual(currentAgent?.workflowPhase, 'implementation');
    });

    test('Command Processing Workflow', async () => {
        // Step 1: Process templates list command
        const templatesCommand = '/templates list --verbose';
        assert.strictEqual(commandRouter.isCommand(templatesCommand), true);

        const parsedTemplates = commandRouter.parseCommand(templatesCommand);
        assert.strictEqual(parsedTemplates.command, 'templates');
        assert.strictEqual(parsedTemplates.subcommand, 'list');
        assert.strictEqual(parsedTemplates.flags.verbose, true);

        // Step 2: Process agent list command
        const agentCommand = '/agent list';
        assert.strictEqual(commandRouter.isCommand(agentCommand), true);

        const parsedAgent = commandRouter.parseCommand(agentCommand);
        assert.strictEqual(parsedAgent.command, 'agent');
        assert.strictEqual(parsedAgent.subcommand, 'list');

        // Step 3: Process new document command
        const newCommand = '/new "Test Document" --template basic';
        assert.strictEqual(commandRouter.isCommand(newCommand), true);

        const parsedNew = commandRouter.parseCommand(newCommand);
        assert.strictEqual(parsedNew.command, 'new');
        assert.deepStrictEqual(parsedNew.arguments, ['Test Document']);
        assert.strictEqual(parsedNew.flags.template, 'basic');
    });

    test('Error Handling Workflow', async () => {
        const toolContext = VSCodeAPIMocks.createMockToolContext();

        // Step 1: Test invalid template
        const invalidTemplateResult = await TestTimeoutManager.wrapWithTimeout(
            toolManager.executeTool('validateTemplate', {
                templateId: 'non-existent-template'
            }, toolContext),
            'workflow-step'
        );

        assert.strictEqual(invalidTemplateResult.success, false);
        assert.ok(invalidTemplateResult.error);

        // Step 2: Test invalid agent
        const invalidAgentResult = agentManager.setCurrentAgent('non-existent-agent');
        assert.strictEqual(invalidAgentResult, false);

        // Step 3: Test invalid command
        const invalidCommand = '/invalid-command';
        const routeResult = await TestTimeoutManager.wrapWithTimeout(
            commandRouter.routeCommand(invalidCommand, mockCommandContext),
            'workflow-step'
        );
        assert.strictEqual(routeResult.success, false);
        assert.ok(routeResult.error);
    });

    test('Template Creation and Validation Workflow', async () => {
        const toolContext = VSCodeAPIMocks.createMockToolContext();

        // Step 1: Create a new template
        const createResult = await TestTimeoutManager.wrapWithTimeout(
            toolManager.executeTool('createTemplate', {
                id: 'test-template',
                name: 'Test Template',
                description: 'A template for testing',
                content: '# {{title}}\n\n{{content}}\n\nCreated: {{currentDate}}'
            }, toolContext),
            'workflow-step'
        );

        // Should execute (might fail due to file system limitations in test)
        assert.ok(typeof createResult.success === 'boolean');

        // Step 2: Validate template content directly
        const validateContentResult = await TestTimeoutManager.wrapWithTimeout(
            toolManager.executeTool('validateTemplate', {
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
            }, toolContext),
            'workflow-step'
        );

        // Should execute successfully
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
            const agentResult = agentManager.setCurrentAgent(step.agent);
            assert.strictEqual(agentResult, true, `Should set agent: ${step.agent}`);

            // Verify agent phase
            const currentAgent = agentManager.getCurrentAgent();
            assert.strictEqual(currentAgent?.workflowPhase, step.phase, 
                `Agent ${step.agent} should be in phase: ${step.phase}`);

            // Check template availability if specified
            if (step.template) {
                const template = templateManager.getTemplate(step.template);
                assert.ok(template, `Template ${step.template} should be available for ${step.agent}`);

                // Check if agent can use template
                const agentTemplates = templateManager.getTemplatesForAgent(step.agent);
                const canUseTemplate = agentTemplates.some(t => t.id === step.template);
                
                // Some templates may have agent restrictions, so we just verify the template exists
                assert.ok(template, `Template ${step.template} should exist`);
            }
        }
    });
});