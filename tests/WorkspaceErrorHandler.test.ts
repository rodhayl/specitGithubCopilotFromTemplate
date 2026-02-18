// Tests for WorkspaceErrorHandler
import { WorkspaceErrorHandler } from '../src/security/WorkspaceErrorHandler';
import { WorkspaceDetectionResult } from '../src/security/SecurityManager';

describe('WorkspaceErrorHandler', () => {
    describe('createWorkspaceGuidance', () => {
        it('should create no-workspace guidance', () => {
            const guidance = WorkspaceErrorHandler.createWorkspaceGuidance('no-workspace', 'testTool');
            
            expect(guidance.type).toBe('no-workspace');
            expect(guidance.message).toContain('testTool');
            expect(guidance.message).toContain('requires a workspace folder');
            expect(guidance.guidance.action).toContain('Open a folder');
            expect(guidance.guidance.alternatives).toBeDefined();
            expect(guidance.guidance.alternatives!.length).toBeGreaterThan(0);
            expect(guidance.guidance.helpCommand).toBe('/help workspace');
        });

        it('should create permissions guidance', () => {
            const guidance = WorkspaceErrorHandler.createWorkspaceGuidance('permissions', 'testTool');
            
            expect(guidance.type).toBe('permissions');
            expect(guidance.message).toContain('Insufficient permissions');
            expect(guidance.guidance.action).toContain('Check folder permissions');
            expect(guidance.guidance.alternatives).toBeDefined();
            expect(guidance.guidance.helpCommand).toBe('/help permissions');
        });

        it('should create invalid-workspace guidance', () => {
            const guidance = WorkspaceErrorHandler.createWorkspaceGuidance('invalid-workspace', 'testTool');
            
            expect(guidance.type).toBe('invalid-workspace');
            expect(guidance.message).toContain('invalid or inaccessible');
            expect(guidance.guidance.action).toContain('Ensure the workspace folder exists');
            expect(guidance.guidance.alternatives).toBeDefined();
        });

        it('should create multi-root-complexity guidance', () => {
            const guidance = WorkspaceErrorHandler.createWorkspaceGuidance('multi-root-complexity', 'testTool');
            
            expect(guidance.type).toBe('multi-root-complexity');
            expect(guidance.message).toContain('Multi-root workspace detected');
            expect(guidance.guidance.action).toContain('use the first workspace folder');
            expect(guidance.guidance.alternatives).toBeDefined();
        });
    });

    describe('determineErrorType', () => {
        it('should return no-workspace when workspace is not available', () => {
            const workspaceState: WorkspaceDetectionResult = {
                hasWorkspace: false,
                workspaceFolders: [],
                isMultiRoot: false
            };

            const errorType = WorkspaceErrorHandler.determineErrorType(workspaceState);
            expect(errorType).toBe('no-workspace');
        });

        it('should return permissions when cannot write', () => {
            const workspaceState: WorkspaceDetectionResult = {
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: false,
                permissions: {
                    canRead: true,
                    canWrite: false
                }
            };

            const errorType = WorkspaceErrorHandler.determineErrorType(workspaceState);
            expect(errorType).toBe('permissions');
        });

        it('should return invalid-workspace when cannot read', () => {
            const workspaceState: WorkspaceDetectionResult = {
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: false,
                permissions: {
                    canRead: false,
                    canWrite: true
                }
            };

            const errorType = WorkspaceErrorHandler.determineErrorType(workspaceState);
            expect(errorType).toBe('invalid-workspace');
        });

        it('should return multi-root-complexity for multi-root workspaces', () => {
            const workspaceState: WorkspaceDetectionResult = {
                hasWorkspace: true,
                workspaceFolders: [],
                isMultiRoot: true,
                permissions: {
                    canRead: true,
                    canWrite: true
                }
            };

            const errorType = WorkspaceErrorHandler.determineErrorType(workspaceState);
            expect(errorType).toBe('multi-root-complexity');
        });
    });

    describe('createUserFriendlyError', () => {
        it('should create user-friendly error for no workspace', () => {
            const workspaceState: WorkspaceDetectionResult = {
                hasWorkspace: false,
                workspaceFolders: [],
                isMultiRoot: false
            };

            const errorInfo = WorkspaceErrorHandler.createUserFriendlyError('testTool', workspaceState);
            
            expect(errorInfo.type).toBe('no-workspace');
            expect(errorInfo.message).toContain('testTool');
            expect(errorInfo.guidance.action).toBeDefined();
            expect(errorInfo.guidance.alternatives).toBeDefined();
        });
    });

    describe('formatErrorForDisplay', () => {
        it('should format error with all components', () => {
            const errorInfo = WorkspaceErrorHandler.createWorkspaceGuidance('no-workspace', 'testTool');
            const formatted = WorkspaceErrorHandler.formatErrorForDisplay(errorInfo);
            
            expect(formatted).toContain('❌');
            expect(formatted).toContain('What to do:');
            expect(formatted).toContain('Alternatives:');
            expect(formatted).toContain('💡');
            expect(formatted).toContain('/help workspace');
        });

        it('should handle error without alternatives', () => {
            const errorInfo = {
                type: 'no-workspace' as const,
                message: 'Test error',
                guidance: {
                    action: 'Test action',
                    helpCommand: '/help test'
                }
            };

            const formatted = WorkspaceErrorHandler.formatErrorForDisplay(errorInfo);
            
            expect(formatted).toContain('❌');
            expect(formatted).toContain('What to do:');
            expect(formatted).not.toContain('Alternatives:');
            expect(formatted).toContain('💡');
        });
    });
});