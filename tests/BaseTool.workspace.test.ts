// Tests for BaseTool workspace handling
import { BaseTool } from '../src/tools/BaseTool';
import { ToolContext, ToolResult, ToolRequirements } from '../src/tools/types';

// Mock SecurityManager
const mockSecurityManager = {
    detectWorkspaceState: jest.fn(),
    validateWorkspaceState: jest.fn()
};

jest.mock('../src/security/SecurityManager', () => ({
    SecurityManager: jest.fn().mockImplementation(() => mockSecurityManager)
}));

// Test tool implementation
class TestTool extends BaseTool {
    constructor(requiresWorkspace: boolean = true, workspaceOptional: boolean = false) {
        super('testTool', 'Test tool for workspace scenarios', []);
        this.requirements = {
            requiresWorkspace,
            requiresFileSystem: requiresWorkspace,
            workspaceOptional
        };
    }

    private requirements: ToolRequirements;

    protected getRequirements(): ToolRequirements {
        return this.requirements;
    }

    async execute(params: any, context: ToolContext): Promise<ToolResult> {
        return { success: true, data: { message: 'Test executed successfully' } };
    }
}

describe('BaseTool Workspace Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('workspace-required tools', () => {
        it('should fail when no workspace is available', async () => {
            const tool = new TestTool(true, false);
            
            mockSecurityManager.detectWorkspaceState.mockResolvedValue({
                hasWorkspace: false,
                workspaceFolders: [],
                isMultiRoot: false
            });

            const context: ToolContext = {
                workspaceRoot: '',
                extensionContext: null as any
            };

            const result = await tool.executeWithErrorHandling({}, context);

            expect(result.success).toBe(false);
            expect(result.error).toContain('workspace');
            expect((result as any).guidance).toBeDefined();
        });

        it('should fail when workspace has insufficient permissions', async () => {
            const tool = new TestTool(true, false);
            
            mockSecurityManager.detectWorkspaceState.mockResolvedValue({
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: false,
                permissions: {
                    canRead: true,
                    canWrite: false
                }
            });

            mockSecurityManager.validateWorkspaceState.mockResolvedValue({
                valid: false,
                error: 'Insufficient permissions to write to workspace'
            });

            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.executeWithErrorHandling({}, context);

            expect(result.success).toBe(false);
            expect(result.error).toContain('permissions');
        });

        it('should succeed when workspace is valid', async () => {
            const tool = new TestTool(true, false);
            
            mockSecurityManager.detectWorkspaceState.mockResolvedValue({
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: false,
                permissions: {
                    canRead: true,
                    canWrite: true
                }
            });

            mockSecurityManager.validateWorkspaceState.mockResolvedValue({
                valid: true
            });

            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.executeWithErrorHandling({}, context);

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe('Test executed successfully');
        });
    });

    describe('workspace-optional tools', () => {
        it('should succeed without workspace', async () => {
            const tool = new TestTool(false, true);
            
            mockSecurityManager.detectWorkspaceState.mockResolvedValue({
                hasWorkspace: false,
                workspaceFolders: [],
                isMultiRoot: false
            });

            const context: ToolContext = {
                workspaceRoot: '',
                extensionContext: null as any
            };

            const result = await tool.executeWithErrorHandling({}, context);

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe('Test executed successfully');
        });

        it('should succeed with workspace', async () => {
            const tool = new TestTool(false, true);
            
            mockSecurityManager.detectWorkspaceState.mockResolvedValue({
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: false,
                permissions: {
                    canRead: true,
                    canWrite: true
                }
            });

            mockSecurityManager.validateWorkspaceState.mockResolvedValue({
                valid: true
            });

            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.executeWithErrorHandling({}, context);

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe('Test executed successfully');
        });

        it('should continue with warning when workspace has permission issues', async () => {
            const tool = new TestTool(false, true);
            const logSpy = jest.spyOn(tool as any, 'log').mockImplementation();
            
            mockSecurityManager.detectWorkspaceState.mockResolvedValue({
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: false,
                permissions: {
                    canRead: true,
                    canWrite: false
                }
            });

            mockSecurityManager.validateWorkspaceState.mockResolvedValue({
                valid: false,
                error: 'Insufficient permissions'
            });

            const context: ToolContext = {
                workspaceRoot: '/test/workspace',
                extensionContext: null as any
            };

            const result = await tool.executeWithErrorHandling({}, context);

            expect(result.success).toBe(true);
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Workspace validation warning'),
                'warn'
            );
        });
    });
});