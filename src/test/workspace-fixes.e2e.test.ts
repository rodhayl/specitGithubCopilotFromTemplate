// End-to-end validation test for workspace fixes
import { WorkspaceErrorHandler } from '../security/WorkspaceErrorHandler';
import { ListTemplatesTool } from '../tools/ListTemplatesTool';
import { ApplyTemplateTool } from '../tools/ApplyTemplateTool';
import { BaseTool } from '../tools/BaseTool';
import { ToolContext } from '../tools/types';

// Mock dependencies
const mockTemplateManager = {
    getTemplates: jest.fn().mockReturnValue([
        { id: 'basic', name: 'Basic Template', description: 'Basic template', builtIn: true, variables: [] }
    ]),
    getTemplate: jest.fn().mockReturnValue({
        id: 'basic',
        name: 'Basic Template',
        description: 'Basic template',
        content: '# {{title}}',
        variables: [{ name: 'title', description: 'Title', required: true, type: 'string' }],
        builtIn: true,
        agentRestrictions: []
    }),
    renderTemplate: jest.fn().mockReturnValue({
        content: '# Test Document',
        frontMatter: { title: 'Test Document' },
        metadata: { id: 'basic', name: 'Basic Template', description: 'Basic template', variables: [], builtIn: true }
    }),
    loadUserTemplates: jest.fn().mockResolvedValue(undefined)
};

// Mock vscode module
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue('Test User')
        }),
        asRelativePath: jest.fn().mockReturnValue('relative/path'),
        fs: {
            writeFile: jest.fn().mockResolvedValue(undefined)
        }
    },
    Uri: {
        file: jest.fn().mockReturnValue({ fsPath: '/test/path' })
    }
}));

// Mock SecurityManager
jest.mock('../security/SecurityManager', () => ({
    SecurityManager: {
        detectWorkspaceState: jest.fn().mockReturnValue({
            hasWorkspace: true,
            workspaceFolders: ['/test/workspace'],
            isMultiRoot: false,
            permissions: { canRead: true, canWrite: true }
        }),
        validateWorkspaceAccess: jest.fn().mockReturnValue({ success: true })
    }
}));

// Mock file system operations
jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined)
    },
    constants: {
        F_OK: 0,
        W_OK: 2
    }
}));

describe('Workspace Fixes End-to-End Validation', () => {
    describe('WorkspaceErrorHandler', () => {
        it('should provide comprehensive error guidance for all scenarios', () => {
            const scenarios = [
                { type: 'no-workspace' as const, toolName: 'testTool' },
                { type: 'permissions' as const, toolName: 'testTool' },
                { type: 'invalid-workspace' as const, toolName: 'testTool' },
                { type: 'multi-root-complexity' as const, toolName: 'testTool' }
            ];

            for (const scenario of scenarios) {
                const errorInfo = WorkspaceErrorHandler.createWorkspaceGuidance(
                    scenario.type,
                    scenario.toolName
                );

                // Verify error structure
                expect(errorInfo.type).toBe(scenario.type);
                expect(errorInfo.message).toBeDefined();
                expect(errorInfo.guidance.action).toBeDefined();
                expect(errorInfo.guidance.alternatives).toBeDefined();
                expect(errorInfo.guidance.helpCommand).toBeDefined();

                // Verify formatted output
                const formatted = WorkspaceErrorHandler.formatErrorForDisplay(errorInfo);
                expect(formatted).toContain('❌');
                expect(formatted).toContain('What to do:');
                expect(formatted).toContain('💡');
            }
        });

        it('should determine correct error types from workspace state', () => {
            const testCases = [
                {
                    state: { hasWorkspace: false, workspaceFolders: [], isMultiRoot: false },
                    expected: 'no-workspace'
                },
                {
                    state: { 
                        hasWorkspace: true, 
                        workspaceFolders: [], 
                        isMultiRoot: false,
                        permissions: { canRead: true, canWrite: false }
                    },
                    expected: 'permissions'
                },
                {
                    state: { 
                        hasWorkspace: true, 
                        workspaceFolders: [], 
                        isMultiRoot: false,
                        permissions: { canRead: false, canWrite: true }
                    },
                    expected: 'invalid-workspace'
                },
                {
                    state: { 
                        hasWorkspace: true, 
                        workspaceFolders: [], 
                        isMultiRoot: true,
                        permissions: { canRead: true, canWrite: true }
                    },
                    expected: 'multi-root-complexity'
                }
            ];

            for (const testCase of testCases) {
                const errorType = WorkspaceErrorHandler.determineErrorType(testCase.state as any);
                expect(errorType).toBe(testCase.expected);
            }
        });
    });

    describe('Tool Workspace Requirements', () => {
        it('should correctly classify all tools', () => {
            const listTemplatesTool = new ListTemplatesTool(mockTemplateManager as any);
            const applyTemplateTool = new ApplyTemplateTool(mockTemplateManager as any);

            // Test workspace-optional tool
            const listRequirements = (listTemplatesTool as any).getRequirements();
            expect(listRequirements.requiresWorkspace).toBe(false);
            expect(listRequirements.workspaceOptional).toBe(true);
            expect(listRequirements.gracefulDegradation).toBeDefined();

            // Test workspace-required tool
            const applyRequirements = (applyTemplateTool as any).getRequirements();
            expect(applyRequirements.requiresWorkspace).toBe(true);
            expect(applyRequirements.workspaceOptional).toBe(false);
        });
    });

    describe('No-Workspace Scenario Validation', () => {
        const noWorkspaceContext: ToolContext = {
            workspaceRoot: '',
            extensionContext: null as any
        };

        it('should handle workspace-optional tools gracefully', async () => {
            const listTemplatesTool = new ListTemplatesTool(mockTemplateManager as any);
            
            const result = await listTemplatesTool.execute({}, noWorkspaceContext);

            expect(result.success).toBe(true);
            expect(result.data.hasWorkspace).toBe(false);
            expect(result.data.workspaceStatus).toBe('not-available');
            expect(result.data.templates).toBeDefined();
            expect(result.metadata?.gracefulDegradation).toBe(true);
        });

        it('should provide enhanced errors for workspace-required tools', async () => {
            const applyTemplateTool = new ApplyTemplateTool(mockTemplateManager as any);
            
            const result = await applyTemplateTool.execute({
                templateId: 'basic',
                variables: JSON.stringify({ title: 'Test' })
            }, noWorkspaceContext);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Document creation requires a workspace folder');
            expect(result.metadata?.workspaceRequired).toBe(true);
            expect(result.metadata?.guidance).toBeDefined();
            expect(result.metadata?.guidance.action).toContain('Open a folder or workspace');
            expect(result.metadata?.guidance.alternatives).toBeDefined();
            expect(result.metadata?.guidance.helpCommand).toBe('/help workspace');
        });
    });

    describe('Workspace Available Scenario Validation', () => {
        const workspaceContext: ToolContext = {
            workspaceRoot: '/test/workspace',
            extensionContext: null as any
        };

        it('should provide full functionality for workspace-optional tools', async () => {
            const listTemplatesTool = new ListTemplatesTool(mockTemplateManager as any);
            
            const result = await listTemplatesTool.execute({}, workspaceContext);

            expect(result.success).toBe(true);
            expect(result.data.hasWorkspace).toBe(true);
            expect(result.data.workspaceStatus).toBe('available');
            expect(result.data.templates).toBeDefined();
            expect(result.metadata?.gracefulDegradation).toBe(false);
            expect(mockTemplateManager.loadUserTemplates).toHaveBeenCalled();
        });

        it('should work normally for workspace-required tools', async () => {
            const applyTemplateTool = new ApplyTemplateTool(mockTemplateManager as any);
            
            const result = await applyTemplateTool.execute({
                templateId: 'basic',
                variables: JSON.stringify({ title: 'Test Document' })
            }, workspaceContext);

            expect(result.success).toBe(true);
            expect(result.data.content).toBe('# Test Document');
            expect(result.data.templateId).toBe('basic');
        });
    });

    describe('Error Message Quality Validation', () => {
        it('should provide actionable error messages', () => {
            const errorInfo = WorkspaceErrorHandler.createWorkspaceGuidance('no-workspace', 'testTool');
            
            // Check message quality
            expect(errorInfo.message).toMatch(/requires.*workspace/i);
            expect(errorInfo.guidance.action).toMatch(/open.*folder/i);
            expect(errorInfo.guidance.alternatives).toHaveLength(3);
            expect(errorInfo.guidance.helpCommand).toBe('/help workspace');

            // Check formatted message quality
            const formatted = WorkspaceErrorHandler.formatErrorForDisplay(errorInfo);
            expect(formatted).toContain('❌');
            expect(formatted).toContain('What to do:');
            expect(formatted).toContain('Alternatives:');
            expect(formatted).toContain('💡');
            expect(formatted).toContain('/help workspace');
        });

        it('should provide consistent error format across all error types', () => {
            const errorTypes = ['no-workspace', 'permissions', 'invalid-workspace', 'multi-root-complexity'] as const;
            
            for (const errorType of errorTypes) {
                const errorInfo = WorkspaceErrorHandler.createWorkspaceGuidance(errorType, 'testTool');
                const formatted = WorkspaceErrorHandler.formatErrorForDisplay(errorInfo);

                // All errors should have consistent structure
                expect(formatted).toMatch(/❌.*\*\*.*\*\*/); // Error icon and bold message
                expect(formatted).toContain('**What to do:**'); // Action section
                expect(formatted).toMatch(/💡.*`.*`/); // Help command with backticks
            }
        });
    });

    describe('Integration Validation', () => {
        it('should validate complete workspace fix implementation', () => {
            // Verify all components are properly integrated
            
            // 1. WorkspaceErrorHandler provides comprehensive error handling
            const errorHandler = WorkspaceErrorHandler;
            expect(typeof errorHandler.createWorkspaceGuidance).toBe('function');
            expect(typeof errorHandler.determineErrorType).toBe('function');
            expect(typeof errorHandler.createUserFriendlyError).toBe('function');
            expect(typeof errorHandler.formatErrorForDisplay).toBe('function');

            // 2. Tools have proper workspace requirements
            const listTool = new ListTemplatesTool(mockTemplateManager as any);
            const applyTool = new ApplyTemplateTool(mockTemplateManager as any);
            
            expect((listTool as any).getRequirements().requiresWorkspace).toBe(false);
            expect((applyTool as any).getRequirements().requiresWorkspace).toBe(true);

            // 3. Error messages are user-friendly and actionable
            const noWorkspaceError = errorHandler.createWorkspaceGuidance('no-workspace', 'testTool');
            expect(noWorkspaceError.guidance.alternatives?.length).toBeGreaterThan(0);
            expect(noWorkspaceError.guidance.helpCommand).toBeDefined();

            // 4. Graceful degradation works for optional tools
            const requirements = (listTool as any).getRequirements();
            expect(requirements.gracefulDegradation).toBeDefined();
            expect(requirements.gracefulDegradation.withoutWorkspace).toBeDefined();
            expect(requirements.gracefulDegradation.withWorkspace).toBeDefined();
        });
    });
});