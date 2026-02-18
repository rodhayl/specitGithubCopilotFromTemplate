// Base tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { Tool, ToolParameter, ToolContext, ToolResult, ToolRequirements, WorkspaceErrorResult } from './types';
import { SecurityManager, WorkspaceDetectionResult } from '../security/SecurityManager';
import { WorkspaceErrorHandler } from '../security/WorkspaceErrorHandler';
import { ErrorHandler, ErrorContext } from '../error/ErrorHandler';
import { OfflineManager } from '../offline/OfflineManager';
import { Logger } from '../logging/Logger';

/**
 * BaseTool - Abstract base class for all tools
 *
 * Provides common functionality for tool implementations including security validation,
 * error handling, offline detection, workspace validation, and input validation helpers.
 * All specialized tools extend this class.
 *
 * @example
 * ```typescript
 * class MyTool extends BaseTool {
 *     async execute(params: any, context: ToolContext): Promise<ToolResult> {
 *         // Implementation with validation
 *         const validation = this.validateFilePath(params.path);
 *         if (!validation.valid) {
 *             return this.createValidationError(validation.error!, validation.suggestion);
 *         }
 *         // ... continue execution
 *     }
 * }
 * ```
 */
export abstract class BaseTool implements Tool {
    public readonly name: string;
    public readonly description: string;
    public readonly parameters: ToolParameter[];
    protected securityManager!: SecurityManager;
    protected errorHandler: ErrorHandler;
    protected offlineManager: OfflineManager;

    constructor(name: string, description: string, parameters: ToolParameter[]) {
        this.name = name;
        this.description = description;
        this.parameters = parameters;
        this.errorHandler = ErrorHandler.getInstance();
        this.offlineManager = OfflineManager.getInstance();
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

    // ===== Enhanced Input Validation Methods =====

    /**
     * Validate a file path parameter with helpful error messages
     */
    protected validateFilePath(path: any, paramName: string = 'path'): { valid: boolean; error?: string; suggestion?: string } {
        if (!path) {
            return {
                valid: false,
                error: `Missing required parameter '${paramName}'`,
                suggestion: `Provide a valid file path for ${paramName}`
            };
        }

        if (typeof path !== 'string') {
            return {
                valid: false,
                error: `Parameter '${paramName}' must be a string, got ${typeof path}`,
                suggestion: `Use a string path like "docs/my-file.md"`
            };
        }

        if (path.trim().length === 0) {
            return {
                valid: false,
                error: `Parameter '${paramName}' cannot be empty`,
                suggestion: `Provide a non-empty file path`
            };
        }

        // Check for invalid characters
        const invalidChars = /[<>:"|?*\x00-\x1F]/;
        if (invalidChars.test(path)) {
            return {
                valid: false,
                error: `Parameter '${paramName}' contains invalid characters`,
                suggestion: `Remove special characters like < > : " | ? *`
            };
        }

        return { valid: true };
    }

    /**
     * Validate a string parameter with length constraints
     */
    protected validateString(value: any, paramName: string, options?: {
        minLength?: number;
        maxLength?: number;
        pattern?: RegExp;
        patternDescription?: string;
    }): { valid: boolean; error?: string; suggestion?: string } {
        if (value === undefined || value === null) {
            return {
                valid: false,
                error: `Missing required parameter '${paramName}'`,
                suggestion: `Provide a value for ${paramName}`
            };
        }

        if (typeof value !== 'string') {
            return {
                valid: false,
                error: `Parameter '${paramName}' must be a string, got ${typeof value}`,
                suggestion: `Convert ${paramName} to a string`
            };
        }

        if (options?.minLength && value.length < options.minLength) {
            return {
                valid: false,
                error: `Parameter '${paramName}' must be at least ${options.minLength} characters`,
                suggestion: `Provide a longer value for ${paramName}`
            };
        }

        if (options?.maxLength && value.length > options.maxLength) {
            return {
                valid: false,
                error: `Parameter '${paramName}' must not exceed ${options.maxLength} characters`,
                suggestion: `Shorten the value for ${paramName}`
            };
        }

        if (options?.pattern && !options.pattern.test(value)) {
            return {
                valid: false,
                error: `Parameter '${paramName}' does not match required pattern`,
                suggestion: options.patternDescription || `Check the format of ${paramName}`
            };
        }

        return { valid: true };
    }

    /**
     * Validate an object/record parameter
     */
    protected validateObject(value: any, paramName: string, requiredKeys?: string[]): { valid: boolean; error?: string; suggestion?: string } {
        if (value === undefined || value === null) {
            return {
                valid: false,
                error: `Missing required parameter '${paramName}'`,
                suggestion: `Provide an object for ${paramName}`
            };
        }

        if (typeof value !== 'object' || Array.isArray(value)) {
            return {
                valid: false,
                error: `Parameter '${paramName}' must be an object, got ${typeof value}`,
                suggestion: `Use an object like { key: value } for ${paramName}`
            };
        }

        if (requiredKeys) {
            const missingKeys = requiredKeys.filter(key => !(key in value));
            if (missingKeys.length > 0) {
                return {
                    valid: false,
                    error: `Parameter '${paramName}' is missing required keys: ${missingKeys.join(', ')}`,
                    suggestion: `Add the missing keys to ${paramName}`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Create an enhanced error result with validation details
     */
    protected createValidationError(error: string, suggestion?: string, context?: Record<string, any>): ToolResult {
        return {
            success: false,
            error,
            metadata: {
                validationError: true,
                suggestion,
                ...context,
                toolName: this.name
            }
        };
    }
}