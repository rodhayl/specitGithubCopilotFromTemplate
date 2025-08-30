// Tests for ListTemplatesTool workspace scenarios
import { ListTemplatesTool } from '../tools/ListTemplatesTool';
import { TemplateManager } from '../templates/TemplateManager';
import { ToolContext } from '../tools/types';

// Mock TemplateManager
class MockTemplateManager extends TemplateManager {
    private mockTemplates = [
        {
            id: 'prd',
            name: 'Product Requirements Document',
            description: 'Template for creating PRDs',
            builtIn: true,
            variables: [],
            content: '# {{title}}\n\nContent here',
            frontMatter: {}
        },
        {
            id: 'user-template',
            name: 'User Template',
            description: 'User-defined template',
            builtIn: false,
            variables: [],
            content: '# {{title}}\n\nUser content',
            frontMatter: {}
        }
    ];

    getTemplates() {
        return this.mockTemplates;
    }

    getTemplatesForAgent(agentName: string) {
        return this.mockTemplates;
    }

    async loadUserTemplates() {
        // Mock implementation - in real scenario this would load from workspace
        return Promise.resolve();
    }
}

describe('ListTemplatesTool', () => {
    let tool: ListTemplatesTool;
    let mockTemplateManager: MockTemplateManager;

    beforeEach(() => {
        mockTemplateManager = new MockTemplateManager(null as any);
        tool = new ListTemplatesTool(mockTemplateManager);
    });

    describe('workspace scenarios', () => {
        it('should work with workspace available', async () => {
            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.execute({}, context);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.hasWorkspace).toBe(true);
            expect(result.data.workspaceStatus).toBe('available');
            expect(result.data.templates).toBeDefined();
            expect(result.data.builtInCount).toBeDefined();
            expect(result.data.userCount).toBeDefined();
            expect(result.metadata?.workspaceOptional).toBe(true);
        });

        it('should work without workspace', async () => {
            const context: ToolContext = {
                workspaceRoot: '',
                extensionContext: null as any
            };

            const result = await tool.execute({}, context);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.hasWorkspace).toBe(false);
            expect(result.data.workspaceStatus).toBe('not-available');
            expect(result.data.templates).toBeDefined();
            expect(result.metadata?.gracefulDegradation).toBe(true);
        });

        it('should filter by agent when specified', async () => {
            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.execute({ agentName: 'test-agent' }, context);

            expect(result.success).toBe(true);
            expect(result.data.filteredBy).toBe('agent: test-agent');
        });

        it('should include variables when requested', async () => {
            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.execute({ includeVariables: true }, context);

            expect(result.success).toBe(true);
            expect(result.data.templates).toBeDefined();
            // Variables should be included in template data
            for (const template of result.data.templates) {
                expect(template.variables).toBeDefined();
            }
        });
    });

    describe('getRequirements', () => {
        it('should return correct requirements', () => {
            const requirements = (tool as any).getRequirements();

            expect(requirements.requiresWorkspace).toBe(false);
            expect(requirements.requiresFileSystem).toBe(false);
            expect(requirements.workspaceOptional).toBe(true);
            expect(requirements.gracefulDegradation).toBeDefined();
            expect(requirements.gracefulDegradation.withoutWorkspace).toContain('Built-in templates only');
            expect(requirements.gracefulDegradation.withWorkspace).toContain('Built-in and user templates');
        });
    });
});