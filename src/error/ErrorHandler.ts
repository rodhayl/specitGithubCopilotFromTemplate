// Comprehensive error handling system
import * as vscode from 'vscode';

export interface ErrorContext {
    operation: string;
    filePath?: string;
    agentName?: string;
    toolName?: string;
    userInput?: string;
    timestamp: Date;
}

export interface ErrorRecoveryOption {
    label: string;
    action: () => Promise<void>;
    description: string;
}

export interface ErrorReport {
    error: Error;
    context: ErrorContext;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoveryOptions: ErrorRecoveryOption[];
    userMessage: string;
    technicalDetails: string;
}

/**
 * ErrorHandler - Centralized error handling and recovery system
 *
 * Provides comprehensive error handling, categorization, recovery suggestions,
 * and error reporting. Maintains error history and integrates with VS Code's
 * error reporting mechanisms.
 *
 * @example
 * ```typescript
 * const errorHandler = ErrorHandler.getInstance();
 * const report = await errorHandler.handleError(error, { component: 'ToolManager' });
 * ```
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorHistory: ErrorReport[] = [];
    private readonly maxHistorySize = 100;

    private constructor() {}

    /**
     * Check if running in test environment
     */
    private isTestEnvironment(): boolean {
        return process.env.NODE_ENV === 'test' ||
               (typeof global !== 'undefined' && (global as any).jest !== undefined) ||
               (typeof global !== 'undefined' && (global as any).mocha !== undefined);
    }

    /**
     * Get the singleton instance of ErrorHandler
     *
     * @returns The ErrorHandler singleton instance
     */
    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle and categorize errors with recovery suggestions
     */
    async handleError(error: Error, context: ErrorContext): Promise<ErrorReport> {
        const errorReport = this.categorizeError(error, context);
        
        // Add to history
        this.errorHistory.unshift(errorReport);
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.pop();
        }

        // Log error for debugging
        this.logError(errorReport);

        // Show user notification based on severity
        await this.showUserNotification(errorReport);

        return errorReport;
    }

    /**
     * Categorize errors and provide appropriate recovery options
     */
    private categorizeError(error: Error, context: ErrorContext): ErrorReport {
        const errorMessage = error.message.toLowerCase();
        
        // File system errors
        if (errorMessage.includes('enoent') || errorMessage.includes('file not found')) {
            return this.createFileNotFoundError(error, context);
        }
        
        if (errorMessage.includes('eacces') || errorMessage.includes('permission denied')) {
            return this.createPermissionError(error, context);
        }
        
        if (errorMessage.includes('eexist') || errorMessage.includes('already exists')) {
            return this.createFileExistsError(error, context);
        }

        // Network/API errors
        if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
            return this.createNetworkError(error, context);
        }

        // LLM/Model errors
        if (errorMessage.includes('model') || errorMessage.includes('copilot') || errorMessage.includes('language model')) {
            return this.createModelError(error, context);
        }

        // Workspace errors
        if (errorMessage.includes('workspace') || errorMessage.includes('folder')) {
            return this.createWorkspaceError(error, context);
        }

        // Configuration errors
        if (errorMessage.includes('configuration') || errorMessage.includes('settings')) {
            return this.createConfigurationError(error, context);
        }

        // Template errors
        if (errorMessage.includes('template') || errorMessage.includes('variable')) {
            return this.createTemplateError(error, context);
        }

        // Generic error
        return this.createGenericError(error, context);
    }

    private createFileNotFoundError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [];

        if (context.filePath) {
            recoveryOptions.push({
                label: 'Create File',
                description: 'Create the missing file with default content',
                action: async () => {
                    await vscode.commands.executeCommand('docu.createFile', context.filePath);
                }
            });

            recoveryOptions.push({
                label: 'Choose Different File',
                description: 'Select a different file path',
                action: async () => {
                    const uri = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: { 'Markdown': ['md'], 'Text': ['txt'], 'All': ['*'] }
                    });
                    if (uri && uri[0]) {
                        // Handle file selection
                    }
                }
            });
        }

        recoveryOptions.push({
            label: 'Check Workspace',
            description: 'Verify workspace folder is correctly set',
            action: async () => {
                await vscode.commands.executeCommand('workbench.action.files.openFolder');
            }
        });

        return {
            error,
            context,
            severity: 'medium',
            recoveryOptions,
            userMessage: `File not found: ${context.filePath || 'Unknown file'}. The file may have been moved, deleted, or the path is incorrect.`,
            technicalDetails: `ENOENT error for path: ${context.filePath}. Operation: ${context.operation}`
        };
    }

    private createPermissionError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Check Permissions',
                description: 'Open file properties to check permissions',
                action: async () => {
                    vscode.window.showInformationMessage(
                        'Please check file permissions in your file system and ensure VS Code has write access to the workspace.'
                    );
                }
            },
            {
                label: 'Try Different Location',
                description: 'Choose a different directory with write permissions',
                action: async () => {
                    const uri = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false
                    });
                    // Handle folder selection
                }
            }
        ];

        return {
            error,
            context,
            severity: 'high',
            recoveryOptions,
            userMessage: `Permission denied accessing: ${context.filePath || 'file'}. You may not have sufficient permissions to read or write this file.`,
            technicalDetails: `EACCES error for path: ${context.filePath}. Operation: ${context.operation}`
        };
    }

    private createFileExistsError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [];

        if (context.filePath) {
            recoveryOptions.push({
                label: 'Overwrite File',
                description: 'Replace the existing file with new content',
                action: async () => {
                    // Handle file overwrite
                }
            });

            recoveryOptions.push({
                label: 'Create Backup',
                description: 'Backup existing file and create new one',
                action: async () => {
                    // Handle backup creation
                }
            });

            recoveryOptions.push({
                label: 'Use Different Name',
                description: 'Choose a different filename',
                action: async () => {
                    const newName = await vscode.window.showInputBox({
                        prompt: 'Enter a new filename',
                        value: context.filePath
                    });
                    // Handle new filename
                }
            });
        }

        return {
            error,
            context,
            severity: 'low',
            recoveryOptions,
            userMessage: `File already exists: ${context.filePath || 'Unknown file'}. Choose how to proceed.`,
            technicalDetails: `EEXIST error for path: ${context.filePath}. Operation: ${context.operation}`
        };
    }

    private createNetworkError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Retry Operation',
                description: 'Try the operation again',
                action: async () => {
                    // Retry logic would be implemented by caller
                }
            },
            {
                label: 'Check Connection',
                description: 'Verify internet connection and proxy settings',
                action: async () => {
                    vscode.window.showInformationMessage(
                        'Please check your internet connection and VS Code proxy settings if applicable.'
                    );
                }
            },
            {
                label: 'Work Offline',
                description: 'Continue with offline functionality only',
                action: async () => {
                    // Enable offline mode
                }
            }
        ];

        return {
            error,
            context,
            severity: 'medium',
            recoveryOptions,
            userMessage: 'Network error occurred. Check your internet connection and try again.',
            technicalDetails: `Network error during ${context.operation}: ${error.message}`
        };
    }

    private createModelError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Check Copilot Status',
                description: 'Verify GitHub Copilot is active and authenticated',
                action: async () => {
                    await vscode.commands.executeCommand('github.copilot.status');
                }
            },
            {
                label: 'Retry with Different Model',
                description: 'Try using a different language model',
                action: async () => {
                    // Model selection logic
                }
            },
            {
                label: 'Use Basic Mode',
                description: 'Continue with basic functionality without AI assistance',
                action: async () => {
                    // Enable basic mode
                }
            }
        ];

        return {
            error,
            context,
            severity: 'high',
            recoveryOptions,
            userMessage: 'Language model error. Please check your GitHub Copilot status and authentication.',
            technicalDetails: `Model error during ${context.operation}: ${error.message}`
        };
    }

    private createWorkspaceError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Open Workspace',
                description: 'Open a workspace folder',
                action: async () => {
                    await vscode.commands.executeCommand('workbench.action.files.openFolder');
                }
            },
            {
                label: 'Reload Window',
                description: 'Reload VS Code window to refresh workspace',
                action: async () => {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        ];

        return {
            error,
            context,
            severity: 'critical',
            recoveryOptions,
            userMessage: 'Workspace error. Please ensure a workspace folder is open and accessible.',
            technicalDetails: `Workspace error during ${context.operation}: ${error.message}${context.filePath ? `. File: ${context.filePath}` : ''}`
        };
    }

    private createConfigurationError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Open Settings',
                description: 'Open VS Code settings to fix configuration',
                action: async () => {
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'docu');
                }
            },
            {
                label: 'Reset to Defaults',
                description: 'Reset extension configuration to default values',
                action: async () => {
                    // Reset configuration logic
                }
            }
        ];

        return {
            error,
            context,
            severity: 'medium',
            recoveryOptions,
            userMessage: 'Configuration error. Please check your extension settings.',
            technicalDetails: `Configuration error during ${context.operation}: ${error.message}`
        };
    }

    private createTemplateError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Use Default Template',
                description: 'Fall back to the default template',
                action: async () => {
                    // Use default template logic
                }
            },
            {
                label: 'List Templates',
                description: 'Show available templates',
                action: async () => {
                    await vscode.commands.executeCommand('docu.listTemplates');
                }
            }
        ];

        return {
            error,
            context,
            severity: 'low',
            recoveryOptions,
            userMessage: 'Template error. The specified template may not exist or contain invalid syntax.',
            technicalDetails: `Template error during ${context.operation}: ${error.message}`
        };
    }

    private createGenericError(error: Error, context: ErrorContext): ErrorReport {
        const recoveryOptions: ErrorRecoveryOption[] = [
            {
                label: 'Retry Operation',
                description: 'Try the operation again',
                action: async () => {
                    // Retry logic would be implemented by caller
                }
            },
            {
                label: 'Report Issue',
                description: 'Report this issue to the extension developers',
                action: async () => {
                    const issueUrl = 'https://github.com/your-repo/issues/new';
                    await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
                }
            }
        ];

        return {
            error,
            context,
            severity: 'medium',
            recoveryOptions,
            userMessage: 'An unexpected error occurred. Please try again or report the issue if it persists.',
            technicalDetails: `Generic error during ${context.operation}: ${error.message}${context.filePath ? `. File: ${context.filePath}` : ''}`
        };
    }

    private logError(errorReport: ErrorReport): void {
        const timestamp = errorReport.context.timestamp.toISOString();
        console.error(`[${timestamp}] [${errorReport.severity.toUpperCase()}] ${errorReport.context.operation}:`, {
            error: errorReport.error.message,
            context: errorReport.context,
            stack: errorReport.error.stack
        });
    }

    private async showUserNotification(errorReport: ErrorReport): Promise<void> {
        // Skip UI interactions in test environment
        if (this.isTestEnvironment()) {
            return;
        }

        const actions = errorReport.recoveryOptions.map(option => option.label);
        
        let result: string | undefined;
        
        try {
            switch (errorReport.severity) {
                case 'critical':
                    result = await vscode.window.showErrorMessage(
                        errorReport.userMessage,
                        { modal: true },
                        ...actions
                    );
                    break;
                case 'high':
                    result = await vscode.window.showErrorMessage(
                        errorReport.userMessage,
                        ...actions
                    );
                    break;
                case 'medium':
                    result = await vscode.window.showWarningMessage(
                        errorReport.userMessage,
                        ...actions
                    );
                    break;
                case 'low':
                    result = await vscode.window.showInformationMessage(
                        errorReport.userMessage,
                        ...actions
                    );
                    break;
            }

            // Execute selected recovery option
            if (result) {
                const selectedOption = errorReport.recoveryOptions.find(option => option.label === result);
                if (selectedOption) {
                    try {
                        await selectedOption.action();
                    } catch (recoveryError) {
                        console.error('Recovery action failed:', recoveryError);
                    }
                }
            }
        } catch (error) {
            // Handle cases where VS Code dialog service is not available
            console.warn('Failed to show user notification:', error);
        }
    }

    /**
     * Get error statistics and patterns
     */
    getErrorStatistics(): {
        totalErrors: number;
        errorsBySeverity: Record<string, number>;
        errorsByOperation: Record<string, number>;
        recentErrors: ErrorReport[];
    } {
        const errorsBySeverity: Record<string, number> = {};
        const errorsByOperation: Record<string, number> = {};

        for (const report of this.errorHistory) {
            errorsBySeverity[report.severity] = (errorsBySeverity[report.severity] || 0) + 1;
            errorsByOperation[report.context.operation] = (errorsByOperation[report.context.operation] || 0) + 1;
        }

        return {
            totalErrors: this.errorHistory.length,
            errorsBySeverity,
            errorsByOperation,
            recentErrors: this.errorHistory.slice(0, 10)
        };
    }

    /**
     * Clear error history
     */
    clearHistory(): void {
        this.errorHistory = [];
    }

    /**
     * Enhanced error handling with automatic recovery attempts
     */
    async handleErrorWithRecovery(error: Error, context: ErrorContext, maxRetries: number = 3): Promise<ErrorReport> {
        const errorReport = await this.handleError(error, context);
        
        // Attempt automatic recovery for recoverable errors
        if (this.canAttemptRecovery(errorReport)) {
            const recoveryResult = await this.attemptAutomaticRecovery(errorReport, maxRetries);
            if (recoveryResult.success) {
                errorReport.userMessage = `${errorReport.userMessage} (Automatically recovered)`;
                errorReport.severity = 'low';
            }
        }
        
        return errorReport;
    }

    /**
     * Check if automatic recovery can be attempted
     */
    private canAttemptRecovery(errorReport: ErrorReport): boolean {
        const recoverableCategories = ['network', 'timeout', 'temporary', 'retry'];
        const errorMessage = errorReport.error.message.toLowerCase();
        
        return recoverableCategories.some(category => errorMessage.includes(category)) ||
               errorReport.severity === 'low' || errorReport.severity === 'medium';
    }

    /**
     * Attempt automatic recovery
     */
    private async attemptAutomaticRecovery(errorReport: ErrorReport, maxRetries: number): Promise<{success: boolean, attempts: number}> {
        let attempts = 0;
        
        while (attempts < maxRetries) {
            attempts++;
            
            try {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
                
                // Try to execute the first recovery option if available
                if (errorReport.recoveryOptions.length > 0) {
                    await errorReport.recoveryOptions[0].action();
                    return { success: true, attempts };
                }
                
                // For network errors, just wait and assume recovery
                if (errorReport.error.message.toLowerCase().includes('network')) {
                    return { success: true, attempts };
                }
                
            } catch (recoveryError) {
                console.warn(`Recovery attempt ${attempts} failed:`, recoveryError);
                continue;
            }
        }
        
        return { success: false, attempts };
    }

    /**
     * Wrap a function with comprehensive error handling
     */
    static withErrorHandling<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        context: Partial<ErrorContext>,
        options: {
            maxRetries?: number;
            fallbackValue?: R;
            suppressErrors?: boolean;
        } = {}
    ): (...args: T) => Promise<R> {
        return async (...args: T): Promise<R> => {
            const errorHandler = ErrorHandler.getInstance();
            const fullContext: ErrorContext = {
                operation: context.operation || 'unknown',
                timestamp: new Date(),
                ...context
            };
            
            try {
                return await fn(...args);
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                
                if (options.maxRetries && options.maxRetries > 0) {
                    const errorReport = await errorHandler.handleErrorWithRecovery(err, fullContext, options.maxRetries);
                    
                    // If recovery was successful, try again
                    if (errorReport.userMessage.includes('Automatically recovered')) {
                        try {
                            return await fn(...args);
                        } catch (retryError) {
                            // If retry fails, continue with original error handling
                        }
                    }
                } else {
                    await errorHandler.handleError(err, fullContext);
                }
                
                if (options.fallbackValue !== undefined) {
                    return options.fallbackValue;
                }
                
                if (options.suppressErrors) {
                    throw err;
                }
                
                throw err;
            }
        };
    }

    /**
     * Create a standardized error context
     */
    static createContext(operation: string, additionalContext?: Partial<ErrorContext>): ErrorContext {
        return {
            operation,
            timestamp: new Date(),
            ...additionalContext
        };
    }
}