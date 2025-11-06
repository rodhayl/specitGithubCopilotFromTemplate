// Base tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { Tool, ToolParameter, ToolContext, ToolResult, ToolRequirements, WorkspaceErrorResult } from './types';
import { SecurityManager, WorkspaceDetectionResult } from '../security/SecurityManager';
import { WorkspaceErrorHandler } from '../security/WorkspaceErrorHandler';
import { ErrorHandler, ErrorContext } from '../error/ErrorHandler';
import { OfflineManager } from '../offline/OfflineManager';
import { Logger } from '../logging/Logger';

export abstract class BaseTool implements Tool {
    public readonly name: string;
    public readonly description: string;
    public readonly parameters: ToolParameter[];
    protected securityManager: SecurityManager;
    protected errorHandler: ErrorHandler;
    protected offlineManager: OfflineManager;

    constructor(name: string, description: string, parameters: ToolParameter[]) {
        this.name = name;
        this.description = description;
        this.parameters = parameters;
        this.errorHandler = ErrorHandler.getInstance();
        this.offlineManager = OfflineManager.getInstance();
        // SecurityManager will be initialized when needed with workspace root
        this.securityManager = null as any; // Temporary assignment
    }

    /**
     * Initialize security manager with workspace root
     */
    protected initializeSecurity(workspaceRoot: string): void {
        this.securityManager = new SecurityManager(workspaceRoot);
    }

    /**
     * Execute the tool - must be implemented by subclasses
     */
    abstract execute(params: any, context: ToolContext): Promise<ToolResult>;

    /**
     * Get tool requirements - must be implemented by subclasses
     */
    protected abstract getRequirements(): ToolRequirements;

    /**
     * Validate parameters before execution
     */
    protected validateParameters(params: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const param of this.parameters) {
            if (param.required && (params[param.name] === undefined || params[param.name] === null)) {
                errors.push(`Required parameter '${param.name}' is missing`);
                continue;
            }

            if (params[param.name] !== undefined) {
                const value = params[param.name];
                const expectedType = param.type;

                if (!this.isValidType(value, expectedType)) {
                    errors.push(`Parameter '${param.name}' must be of type ${expectedType}, got ${typeof value}`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate that a file path is within the workspace using SecurityManager
     */
    protected validateWorkspacePath(filePath: string, workspaceRoot: string): { valid: boolean; error?: string } {
        this.initializeSecurity(workspaceRoot);
        const result = this.securityManager.validateWorkspacePath(filePath);
        return {
            valid: result.valid,
            error: result.error
        };
    }

    /**
     * Execute tool with comprehensive error handling and security checks
     */
    async executeWithErrorHandling(params: any, context: ToolContext): Promise<ToolResult> {
        const errorContext: ErrorContext = {
            operation: this.name,
            filePath: params.path,
            toolName: this.name,
            timestamp: new Date()
        };

        try {
            // Initialize security manager
            this.initializeSecurity(context.workspaceRoot);

            // Check offline mode compatibility
            const operationValidation = this.offlineManager.validateOperation(this.name);
            if (!operationValidation.allowed) {
                return this.createErrorResult(
                    operationValidation.reason || this.offlineManager.getOfflineErrorMessage(this.name)
                );
            }

            // Get tool requirements
            const requirements = this.getRequirements();

            // Validate workspace state based on requirements
            if (requirements.requiresWorkspace) {
                const workspaceState = await this.securityManager.detectWorkspaceState();
                if (!workspaceState.hasWorkspace) {
                    return this.createEnhancedWorkspaceErrorResult(workspaceState);
                }
                
                // Additional validation for permissions if workspace exists
                const workspaceValidation = await this.securityManager.validateWorkspaceState();
                if (!workspaceValidation.valid) {
                    return this.createEnhancedWorkspaceErrorResult(workspaceState);
                }
            } else if (requirements.workspaceOptional) {
                // For workspace-optional tools, detect workspace state but don't fail if missing
                const workspaceState = await this.securityManager.detectWorkspaceState();
                
                // If workspace exists, validate permissions
                if (workspaceState.hasWorkspace) {
                    const workspaceValidation = await this.securityManager.validateWorkspaceState();
                    if (!workspaceValidation.valid) {
                        // For optional workspace tools, log warning but continue
                        this.log(`Workspace validation warning: ${workspaceValidation.error}`, 'warn');
                    }
                }
            }

            // Execute the actual tool operation
            return await this.execute(params, context);

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errorReport = await this.errorHandler.handleError(err, errorContext);
            
            return this.createErrorResult(
                errorReport.userMessage,
                {
                    errorId: Date.now().toString(),
                    severity: errorReport.severity,
                    recoveryOptions: errorReport.recoveryOptions.map(opt => opt.label)
                }
            );
        }
    }

    /**
     * Create a success result
     */
    protected createSuccessResult(data?: any, metadata?: Record<string, any>): ToolResult {
        return {
            success: true,
            data,
            metadata
        };
    }

    /**
     * Create an error result
     */
    protected createErrorResult(error: string, metadata?: Record<string, any>): ToolResult {
        return {
            success: false,
            error,
            metadata
        };
    }

    /**
     * Create a workspace-specific error result with guidance
     */
    protected createWorkspaceErrorResult(
        error: string, 
        errorType: 'workspace-required' | 'workspace-permissions' | 'workspace-invalid'
    ): WorkspaceErrorResult {
        const guidance = this.getWorkspaceGuidance(errorType);
        return {
            success: false,
            error,
            errorType,
            guidance
        };
    }

    /**
     * Create enhanced workspace error result using WorkspaceErrorHandler
     */
    protected createEnhancedWorkspaceErrorResult(workspaceState: WorkspaceDetectionResult): WorkspaceErrorResult {
        const errorInfo = WorkspaceErrorHandler.createUserFriendlyError(this.name, workspaceState);
        
        // Map WorkspaceErrorHandler types to ToolResult types
        let errorType: 'workspace-required' | 'workspace-permissions' | 'workspace-invalid';
        switch (errorInfo.type) {
            case 'permissions':
                errorType = 'workspace-permissions';
                break;
            case 'invalid-workspace':
                errorType = 'workspace-invalid';
                break;
            case 'no-workspace':
            case 'multi-root-complexity':
            default:
                errorType = 'workspace-required';
                break;
        }

        return {
            success: false,
            error: errorInfo.message,
            errorType,
            guidance: errorInfo.guidance
        };
    }

    /**
     * Get workspace guidance based on error type (legacy method for backward compatibility)
     */
    private getWorkspaceGuidance(errorType: string): { action: string; alternatives?: string[]; helpCommand?: string } {
        switch (errorType) {
            case 'workspace-required':
                return {
                    action: 'Open a folder or workspace in VS Code',
                    alternatives: [
                        'Use File → Open Folder to open a project',
                        'Use File → Open Workspace to open a saved workspace'
                    ],
                    helpCommand: '/help workspace'
                };
            case 'workspace-permissions':
                return {
                    action: 'Check folder permissions and try again',
                    alternatives: [
                        'Run VS Code as administrator (if needed)',
                        'Choose a different folder with write permissions'
                    ]
                };
            case 'workspace-invalid':
                return {
                    action: 'Ensure the workspace folder exists and is accessible',
                    alternatives: [
                        'Refresh the workspace folder',
                        'Reopen VS Code with a valid folder'
                    ]
                };
            default:
                return {
                    action: 'Please check your workspace configuration'
                };
        }
    }

    /**
     * Log tool activity
     */
    protected log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
        const logger = Logger.getInstance();
        const prefixedMessage = `[${this.name}] ${message}`;
        switch (level) {
            case 'debug':
                logger.extension.debug(prefixedMessage);
                break;
            case 'info':
                logger.extension.info(prefixedMessage);
                break;
            case 'warn':
                logger.extension.warn(prefixedMessage);
                break;
            case 'error':
                logger.extension.error(prefixedMessage, new Error(message));
                break;
        }
    }

    private isValidType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'boolean':
                return typeof value === 'boolean';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'array':
                return Array.isArray(value);
            default:
                return false;
        }
    }
}