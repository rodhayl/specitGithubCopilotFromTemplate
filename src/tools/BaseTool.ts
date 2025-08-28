// Base tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { Tool, ToolParameter, ToolContext, ToolResult } from './types';
import { SecurityManager } from '../security/SecurityManager';
import { ErrorHandler, ErrorContext } from '../error/ErrorHandler';
import { OfflineManager } from '../offline/OfflineManager';

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

            // Validate workspace state
            const workspaceValidation = await this.securityManager.validateWorkspaceState();
            if (!workspaceValidation.valid) {
                return this.createErrorResult(workspaceValidation.error!);
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
     * Log tool activity
     */
    protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
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