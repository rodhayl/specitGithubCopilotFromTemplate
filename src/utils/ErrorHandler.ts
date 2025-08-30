/**
 * Centralized error handling system
 */
import { Logger } from '../logging/Logger';
import { ValidationError } from './ValidationUtils';

/**
 * Error categories for better handling
 */
export enum ErrorCategory {
    VALIDATION = 'validation',
    FILE_SYSTEM = 'file_system',
    NETWORK = 'network',
    AUTHENTICATION = 'authentication',
    PERMISSION = 'permission',
    TEMPLATE = 'template',
    AGENT = 'agent',
    CONVERSATION = 'conversation',
    COMMAND = 'command',
    CONFIGURATION = 'configuration',
    UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Recovery action types
 */
export enum RecoveryAction {
    RETRY = 'retry',
    FALLBACK = 'fallback',
    USER_INPUT = 'user_input',
    SKIP = 'skip',
    ABORT = 'abort'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    details?: string;
    originalError?: Error;
    context?: Record<string, any>;
    timestamp: Date;
    recoverable: boolean;
    recoveryActions: RecoveryAction[];
    userMessage: string;
    technicalMessage: string;
}

/**
 * Recovery options for errors
 */
export interface RecoveryOptions {
    canRetry: boolean;
    maxRetries?: number;
    retryDelay?: number;
    fallbackOptions: string[];
    userActions: string[];
    automaticRecovery: boolean;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
    handled: boolean;
    recovered: boolean;
    action: RecoveryAction;
    message: string;
    newContext?: any;
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private logger: Logger;
    private errorHistory: Map<string, ErrorInfo[]> = new Map();
    private retryAttempts: Map<string, number> = new Map();

    private constructor() {
        this.logger = Logger.getInstance();
    }

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle an error with automatic categorization and recovery
     */
    handleError(error: Error | string, context?: Record<string, any>): ErrorInfo {
        const errorInfo = this.categorizeError(error, context);
        
        // Log the error
        this.logger.error(
            errorInfo.category,
            errorInfo.technicalMessage,
            errorInfo.originalError,
            errorInfo.context
        );

        // Store in history
        const sessionId = context?.sessionId || 'global';
        const history = this.errorHistory.get(sessionId) || [];
        history.push(errorInfo);
        this.errorHistory.set(sessionId, history);

        return errorInfo;
    }

    /**
     * Attempt to recover from an error
     */
    async attemptRecovery(
        errorInfo: ErrorInfo,
        action: RecoveryAction,
        context?: Record<string, any>
    ): Promise<ErrorHandlingResult> {
        const sessionId = context?.sessionId || 'global';
        
        try {
            switch (action) {
                case RecoveryAction.RETRY:
                    return await this.handleRetry(errorInfo, sessionId, context);
                
                case RecoveryAction.FALLBACK:
                    return await this.handleFallback(errorInfo, context);
                
                case RecoveryAction.USER_INPUT:
                    return await this.handleUserInput(errorInfo, context);
                
                case RecoveryAction.SKIP:
                    return await this.handleSkip(errorInfo, context);
                
                case RecoveryAction.ABORT:
                    return await this.handleAbort(errorInfo, context);
                
                default:
                    throw new Error(`Unknown recovery action: ${action}`);
            }
        } catch (recoveryError) {
            this.logger.error(
                'error',
                'Recovery attempt failed',
                recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)),
                { originalError: errorInfo, action, context }
            );

            return {
                handled: true,
                recovered: false,
                action,
                message: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`
            };
        }
    }

    /**
     * Get recovery options for an error
     */
    getRecoveryOptions(errorInfo: ErrorInfo): RecoveryOptions {
        switch (errorInfo.category) {
            case ErrorCategory.VALIDATION:
                return {
                    canRetry: false,
                    fallbackOptions: ['Use default values', 'Skip validation'],
                    userActions: ['Correct input', 'Provide valid data'],
                    automaticRecovery: false
                };

            case ErrorCategory.FILE_SYSTEM:
                return {
                    canRetry: true,
                    maxRetries: 3,
                    retryDelay: 1000,
                    fallbackOptions: ['Use temporary file', 'Skip file operation'],
                    userActions: ['Check permissions', 'Ensure directory exists'],
                    automaticRecovery: true
                };

            case ErrorCategory.NETWORK:
                return {
                    canRetry: true,
                    maxRetries: 3,
                    retryDelay: 2000,
                    fallbackOptions: ['Use offline mode', 'Use cached data'],
                    userActions: ['Check connection', 'Try again later'],
                    automaticRecovery: true
                };

            case ErrorCategory.AUTHENTICATION:
                return {
                    canRetry: false,
                    fallbackOptions: ['Use guest mode', 'Skip authenticated features'],
                    userActions: ['Re-authenticate', 'Check credentials'],
                    automaticRecovery: false
                };

            case ErrorCategory.PERMISSION:
                return {
                    canRetry: false,
                    fallbackOptions: ['Use read-only mode', 'Skip operation'],
                    userActions: ['Grant permissions', 'Run as administrator'],
                    automaticRecovery: false
                };

            case ErrorCategory.TEMPLATE:
                return {
                    canRetry: true,
                    maxRetries: 2,
                    fallbackOptions: ['Use basic template', 'Create without template'],
                    userActions: ['Fix template', 'Choose different template'],
                    automaticRecovery: false
                };

            case ErrorCategory.AGENT:
                return {
                    canRetry: true,
                    maxRetries: 2,
                    fallbackOptions: ['Use default agent', 'Continue without agent'],
                    userActions: ['Switch agent', 'Check agent configuration'],
                    automaticRecovery: true
                };

            case ErrorCategory.CONVERSATION:
                return {
                    canRetry: true,
                    maxRetries: 2,
                    fallbackOptions: ['Continue without conversation', 'Use basic mode'],
                    userActions: ['Restart conversation', 'Try different approach'],
                    automaticRecovery: false
                };

            case ErrorCategory.COMMAND:
                return {
                    canRetry: false,
                    fallbackOptions: ['Use alternative command', 'Manual operation'],
                    userActions: ['Check command syntax', 'Try different parameters'],
                    automaticRecovery: false
                };

            case ErrorCategory.CONFIGURATION:
                return {
                    canRetry: false,
                    fallbackOptions: ['Use default configuration', 'Reset settings'],
                    userActions: ['Fix configuration', 'Check settings'],
                    automaticRecovery: false
                };

            default:
                return {
                    canRetry: errorInfo.recoverable,
                    maxRetries: 1,
                    fallbackOptions: ['Continue with limitations'],
                    userActions: ['Try again', 'Contact support'],
                    automaticRecovery: false
                };
        }
    }

    /**
     * Categorize an error automatically
     */
    private categorizeError(error: Error | string, context?: Record<string, any>): ErrorInfo {
        const errorMessage = error instanceof Error ? error.message : error;
        const originalError = error instanceof Error ? error : new Error(error);

        let category = ErrorCategory.UNKNOWN;
        let severity = ErrorSeverity.MEDIUM;
        let recoverable = true;
        let recoveryActions: RecoveryAction[] = [RecoveryAction.RETRY];

        // Categorize based on error message and type
        if (error instanceof ValidationError) {
            category = ErrorCategory.VALIDATION;
            severity = ErrorSeverity.LOW;
            recoverable = false;
            recoveryActions = [RecoveryAction.USER_INPUT, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('ENOENT') || errorMessage.includes('file not found')) {
            category = ErrorCategory.FILE_SYSTEM;
            severity = ErrorSeverity.MEDIUM;
            recoveryActions = [RecoveryAction.RETRY, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
            category = ErrorCategory.PERMISSION;
            severity = ErrorSeverity.HIGH;
            recoverable = false;
            recoveryActions = [RecoveryAction.USER_INPUT, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
            category = ErrorCategory.NETWORK;
            severity = ErrorSeverity.MEDIUM;
            recoveryActions = [RecoveryAction.RETRY, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
            category = ErrorCategory.AUTHENTICATION;
            severity = ErrorSeverity.HIGH;
            recoverable = false;
            recoveryActions = [RecoveryAction.USER_INPUT, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('template') || errorMessage.includes('variable')) {
            category = ErrorCategory.TEMPLATE;
            severity = ErrorSeverity.MEDIUM;
            recoveryActions = [RecoveryAction.RETRY, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('agent') || errorMessage.includes('model')) {
            category = ErrorCategory.AGENT;
            severity = ErrorSeverity.MEDIUM;
            recoveryActions = [RecoveryAction.RETRY, RecoveryAction.FALLBACK];
        } else if (errorMessage.includes('conversation') || errorMessage.includes('chat')) {
            category = ErrorCategory.CONVERSATION;
            severity = ErrorSeverity.LOW;
            recoveryActions = [RecoveryAction.RETRY, RecoveryAction.SKIP];
        } else if (errorMessage.includes('command') || errorMessage.includes('syntax')) {
            category = ErrorCategory.COMMAND;
            severity = ErrorSeverity.LOW;
            recoverable = false;
            recoveryActions = [RecoveryAction.USER_INPUT];
        } else if (errorMessage.includes('config') || errorMessage.includes('setting')) {
            category = ErrorCategory.CONFIGURATION;
            severity = ErrorSeverity.MEDIUM;
            recoverable = false;
            recoveryActions = [RecoveryAction.USER_INPUT, RecoveryAction.FALLBACK];
        }

        // Generate user-friendly message
        const userMessage = this.generateUserMessage(category, errorMessage);
        const technicalMessage = `${category.toUpperCase()}: ${errorMessage}`;

        return {
            category,
            severity,
            message: errorMessage,
            originalError,
            context,
            timestamp: new Date(),
            recoverable,
            recoveryActions,
            userMessage,
            technicalMessage
        };
    }

    /**
     * Generate user-friendly error message
     */
    private generateUserMessage(category: ErrorCategory, errorMessage: string): string {
        switch (category) {
            case ErrorCategory.VALIDATION:
                return 'Please check your input and try again.';
            
            case ErrorCategory.FILE_SYSTEM:
                return 'There was a problem accessing the file. Please check the file path and permissions.';
            
            case ErrorCategory.NETWORK:
                return 'Network connection issue. Please check your internet connection and try again.';
            
            case ErrorCategory.AUTHENTICATION:
                return 'Authentication failed. Please check your credentials and try again.';
            
            case ErrorCategory.PERMISSION:
                return 'Permission denied. Please check file permissions or run with appropriate privileges.';
            
            case ErrorCategory.TEMPLATE:
                return 'Template error. Please check the template format and try again.';
            
            case ErrorCategory.AGENT:
                return 'AI agent error. The system will try to recover automatically.';
            
            case ErrorCategory.CONVERSATION:
                return 'Conversation error. You can continue or restart the conversation.';
            
            case ErrorCategory.COMMAND:
                return 'Command error. Please check the command syntax and parameters.';
            
            case ErrorCategory.CONFIGURATION:
                return 'Configuration error. Please check your settings.';
            
            default:
                return 'An unexpected error occurred. Please try again or contact support.';
        }
    }

    /**
     * Handle retry recovery
     */
    private async handleRetry(
        errorInfo: ErrorInfo,
        sessionId: string,
        context?: Record<string, any>
    ): Promise<ErrorHandlingResult> {
        const attempts = this.retryAttempts.get(sessionId) || 0;
        const recoveryOptions = this.getRecoveryOptions(errorInfo);
        
        if (attempts >= (recoveryOptions.maxRetries || 3)) {
            return {
                handled: true,
                recovered: false,
                action: RecoveryAction.RETRY,
                message: 'Maximum retry attempts exceeded'
            };
        }

        this.retryAttempts.set(sessionId, attempts + 1);
        
        // Wait before retry if specified
        if (recoveryOptions.retryDelay) {
            await new Promise(resolve => setTimeout(resolve, recoveryOptions.retryDelay));
        }

        return {
            handled: true,
            recovered: true,
            action: RecoveryAction.RETRY,
            message: `Retrying operation (attempt ${attempts + 1})`
        };
    }

    /**
     * Handle fallback recovery
     */
    private async handleFallback(
        errorInfo: ErrorInfo,
        context?: Record<string, any>
    ): Promise<ErrorHandlingResult> {
        const recoveryOptions = this.getRecoveryOptions(errorInfo);
        const fallbackOption = recoveryOptions.fallbackOptions[0] || 'Continue with limitations';

        return {
            handled: true,
            recovered: true,
            action: RecoveryAction.FALLBACK,
            message: `Using fallback: ${fallbackOption}`,
            newContext: { ...context, fallback: true, fallbackReason: errorInfo.message }
        };
    }

    /**
     * Handle user input recovery
     */
    private async handleUserInput(
        errorInfo: ErrorInfo,
        context?: Record<string, any>
    ): Promise<ErrorHandlingResult> {
        const recoveryOptions = this.getRecoveryOptions(errorInfo);
        const userAction = recoveryOptions.userActions[0] || 'Please take corrective action';

        return {
            handled: true,
            recovered: false,
            action: RecoveryAction.USER_INPUT,
            message: `User action required: ${userAction}`
        };
    }

    /**
     * Handle skip recovery
     */
    private async handleSkip(
        errorInfo: ErrorInfo,
        context?: Record<string, any>
    ): Promise<ErrorHandlingResult> {
        return {
            handled: true,
            recovered: true,
            action: RecoveryAction.SKIP,
            message: 'Operation skipped due to error',
            newContext: { ...context, skipped: true, skipReason: errorInfo.message }
        };
    }

    /**
     * Handle abort recovery
     */
    private async handleAbort(
        errorInfo: ErrorInfo,
        context?: Record<string, any>
    ): Promise<ErrorHandlingResult> {
        return {
            handled: true,
            recovered: false,
            action: RecoveryAction.ABORT,
            message: 'Operation aborted due to critical error'
        };
    }

    /**
     * Get error history for a session
     */
    getErrorHistory(sessionId: string = 'global'): ErrorInfo[] {
        return this.errorHistory.get(sessionId) || [];
    }

    /**
     * Clear error history for a session
     */
    clearErrorHistory(sessionId: string = 'global'): void {
        this.errorHistory.delete(sessionId);
        this.retryAttempts.delete(sessionId);
    }

    /**
     * Get error statistics
     */
    getErrorStatistics(sessionId?: string): {
        totalErrors: number;
        errorsByCategory: Record<string, number>;
        errorsBySeverity: Record<string, number>;
        recoverySuccessRate: number;
    } {
        const histories = sessionId 
            ? [this.errorHistory.get(sessionId) || []]
            : Array.from(this.errorHistory.values());
        
        const allErrors = histories.flat();
        
        const errorsByCategory: Record<string, number> = {};
        const errorsBySeverity: Record<string, number> = {};
        
        for (const error of allErrors) {
            errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
        }
        
        const recoverableErrors = allErrors.filter(e => e.recoverable).length;
        const recoverySuccessRate = allErrors.length > 0 ? recoverableErrors / allErrors.length : 0;
        
        return {
            totalErrors: allErrors.length,
            errorsByCategory,
            errorsBySeverity,
            recoverySuccessRate
        };
    }
}

/**
 * Convenience function for handling errors
 */
export function handleError(error: Error | string, context?: Record<string, any>): ErrorInfo {
    return ErrorHandler.getInstance().handleError(error, context);
}

/**
 * Convenience function for attempting recovery
 */
export async function attemptRecovery(
    errorInfo: ErrorInfo,
    action: RecoveryAction,
    context?: Record<string, any>
): Promise<ErrorHandlingResult> {
    return ErrorHandler.getInstance().attemptRecovery(errorInfo, action, context);
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(
    category?: ErrorCategory,
    context?: Record<string, any>
) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                return await method.apply(this, args);
            } catch (error) {
                const errorHandler = ErrorHandler.getInstance();
                const errorInfo = errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                    ...context,
                    method: propertyName,
                    class: target.constructor.name
                });

                // Try automatic recovery if possible
                const recoveryOptions = errorHandler.getRecoveryOptions(errorInfo);
                if (recoveryOptions.automaticRecovery && errorInfo.recoverable) {
                    const recoveryResult = await errorHandler.attemptRecovery(
                        errorInfo,
                        RecoveryAction.RETRY,
                        context
                    );

                    if (recoveryResult.recovered) {
                        return await method.apply(this, args);
                    }
                }

                throw error;
            }
        };

        return descriptor;
    };
}