// Workspace Error Handler for better error messages and guidance
import { WorkspaceDetectionResult } from './SecurityManager';

export interface WorkspaceErrorGuidance {
    action: string;
    alternatives?: string[];
    helpCommand?: string;
}

export interface WorkspaceErrorInfo {
    type: 'no-workspace' | 'permissions' | 'invalid-workspace' | 'multi-root-complexity';
    message: string;
    guidance: WorkspaceErrorGuidance;
}

export class WorkspaceErrorHandler {
    /**
     * Create workspace guidance based on error type and context
     */
    static createWorkspaceGuidance(
        errorType: 'no-workspace' | 'permissions' | 'invalid-workspace' | 'multi-root-complexity',
        toolName: string,
        workspaceState?: WorkspaceDetectionResult
    ): WorkspaceErrorInfo {
        switch (errorType) {
            case 'no-workspace':
                return {
                    type: 'no-workspace',
                    message: `The ${toolName} command requires a workspace folder to be open`,
                    guidance: {
                        action: 'Open a folder or workspace in VS Code',
                        alternatives: [
                            'Use File → Open Folder to open a project directory',
                            'Use File → Open Workspace to open a saved workspace file',
                            'Use the Command Palette (Ctrl+Shift+P) and search for "Open Folder"'
                        ],
                        helpCommand: '/help workspace'
                    }
                };

            case 'permissions':
                return {
                    type: 'permissions',
                    message: `Insufficient permissions to write to the workspace folder`,
                    guidance: {
                        action: 'Check folder permissions and try again',
                        alternatives: [
                            'Ensure you have write permissions to the current folder',
                            'Try running VS Code as administrator (Windows) or with sudo (Linux/Mac)',
                            'Choose a different folder with appropriate permissions',
                            'Check if the folder is read-only or locked by another process'
                        ],
                        helpCommand: '/help permissions'
                    }
                };

            case 'invalid-workspace':
                return {
                    type: 'invalid-workspace',
                    message: `The workspace folder is invalid or inaccessible`,
                    guidance: {
                        action: 'Ensure the workspace folder exists and is accessible',
                        alternatives: [
                            'Check if the folder still exists on your file system',
                            'Refresh the workspace by reopening the folder',
                            'Use File → Open Recent to select a valid workspace',
                            'Close and reopen VS Code with a valid folder'
                        ],
                        helpCommand: '/help workspace'
                    }
                };

            case 'multi-root-complexity':
                return {
                    type: 'multi-root-complexity',
                    message: `Multi-root workspace detected - using primary workspace folder`,
                    guidance: {
                        action: 'The command will use the first workspace folder',
                        alternatives: [
                            'To use a different folder, close other workspace folders',
                            'Save as a single-folder workspace if needed',
                            'Use specific file paths to target the desired folder'
                        ],
                        helpCommand: '/help multi-root'
                    }
                };

            default:
                return {
                    type: 'no-workspace',
                    message: 'Workspace configuration issue',
                    guidance: {
                        action: 'Please check your workspace configuration',
                        alternatives: ['Try reopening VS Code with a valid folder'],
                        helpCommand: '/help workspace'
                    }
                };
        }
    }

    /**
     * Determine error type based on workspace state
     */
    static determineErrorType(workspaceState: WorkspaceDetectionResult): 'no-workspace' | 'permissions' | 'invalid-workspace' | 'multi-root-complexity' {
        if (!workspaceState.hasWorkspace) {
            return 'no-workspace';
        }

        if (workspaceState.permissions && !workspaceState.permissions.canWrite) {
            return 'permissions';
        }

        if (workspaceState.permissions && !workspaceState.permissions.canRead) {
            return 'invalid-workspace';
        }

        if (workspaceState.isMultiRoot) {
            return 'multi-root-complexity';
        }

        return 'no-workspace';
    }

    /**
     * Create user-friendly error message with actionable guidance
     */
    static createUserFriendlyError(
        toolName: string,
        workspaceState: WorkspaceDetectionResult
    ): WorkspaceErrorInfo {
        const errorType = this.determineErrorType(workspaceState);
        return this.createWorkspaceGuidance(errorType, toolName, workspaceState);
    }

    /**
     * Format error for display in chat/UI
     */
    static formatErrorForDisplay(errorInfo: WorkspaceErrorInfo): string {
        let message = `❌ **${errorInfo.message}**\n\n`;
        message += `**What to do:** ${errorInfo.guidance.action}\n\n`;

        if (errorInfo.guidance.alternatives && errorInfo.guidance.alternatives.length > 0) {
            message += '**Alternatives:**\n';
            for (const alternative of errorInfo.guidance.alternatives) {
                message += `- ${alternative}\n`;
            }
            message += '\n';
        }

        if (errorInfo.guidance.helpCommand) {
            message += `💡 *For more help, try: \`${errorInfo.guidance.helpCommand}\`*`;
        }

        return message;
    }
}