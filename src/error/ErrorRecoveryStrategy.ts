import { Logger } from '../logging/Logger';
import { CommandContext } from '../commands/types';
import { OutputCoordinator, OutputContent } from '../commands/OutputCoordinator';

export interface RecoveryResult {
    success: boolean;
    message?: string;
    alternativeAction?: string;
    error?: string;
}

export interface FallbackResult {
    success: boolean;
    fallbackAction: string;
    message: string;
    instructions: string[];
}

export interface CommandIntent {
    command: string;
    parameters: Record<string, any>;
    context: CommandContext;
}

/**
 * Provides error recovery strategies for graceful degradation
 */
export class ErrorRecoveryStrategy {
    private logger: Logger;
    private outputCoordinator: OutputCoordinator;

    constructor() {
        this.logger = Logger.getInstance();
        this.outputCoordinator = OutputCoordinator.getInstance();
    }

    /**
     * Check if an error can be recovered from
     */
    canRecover(error: Error): boolean {
        const recoverableErrors = [
            'template not found',
            'file already exists',
            'directory not found',
            'permission denied',
            'network timeout',
            'rate limit exceeded'
        ];

        const errorMessage = error.message.toLowerCase();
        return recoverableErrors.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Attempt to recover from an error
     */
    async recover(error: Error, context: CommandContext): Promise<RecoveryResult> {
        try {
            this.logger.info('error', 'Attempting error recovery', { 
                error: error.message,
                errorType: error.constructor.name 
            });

            const errorMessage = error.message.toLowerCase();

            // Template not found recovery
            if (errorMessage.includes('template not found')) {
                return await this.recoverFromTemplateNotFound(error, context);
            }

            // File already exists recovery
            if (errorMessage.includes('file already exists')) {
                return await this.recoverFromFileExists(error, context);
            }

            // Directory not found recovery
            if (errorMessage.includes('directory not found') || errorMessage.includes('no such file or directory')) {
                return await this.recoverFromDirectoryNotFound(error, context);
            }

            // Permission denied recovery
            if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
                return await this.recoverFromPermissionDenied(error, context);
            }

            // Network/connectivity recovery
            if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
                return await this.recoverFromNetworkError(error, context);
            }

            // Rate limit recovery
            if (errorMessage.includes('rate limit')) {
                return await this.recoverFromRateLimit(error, context);
            }

            // Generic recovery
            return await this.genericRecovery(error, context);

        } catch (recoveryError) {
            this.logger.error('error', 'Recovery attempt failed', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
            return {
                success: false,
                error: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`
            };
        }
    }

    /**
     * Provide fallback options when recovery is not possible
     */
    async provideFallback(originalIntent: CommandIntent): Promise<FallbackResult> {
        try {
            this.logger.info('error', 'Providing fallback options', { command: originalIntent.command });

            switch (originalIntent.command) {
                case 'new':
                    return this.provideNewCommandFallback(originalIntent);
                case 'update':
                    return this.provideUpdateCommandFallback(originalIntent);
                case 'review':
                    return this.provideReviewCommandFallback(originalIntent);
                default:
                    return this.provideGenericFallback(originalIntent);
            }

        } catch (error) {
            this.logger.error('error', 'Failed to provide fallback', error instanceof Error ? error : new Error(String(error)));
            return {
                success: false,
                fallbackAction: 'manual-operation',
                message: 'Unable to provide automatic fallback options.',
                instructions: [
                    'Perform the operation manually',
                    'Check the VS Code output panel for more details',
                    'Try restarting VS Code if the issue persists'
                ]
            };
        }
    }

    /**
     * Register recovery feedback with output coordinator
     */
    private registerRecoveryFeedback(title: string, message: string, instructions: string[], type: 'success' | 'error' | 'info' = 'info'): void {
        const output: OutputContent = {
            type,
            title,
            message,
            nextSteps: instructions
        };

        this.outputCoordinator.registerPrimaryOutput('error-recovery', output);
    }

    /**
     * Recover from template not found error
     */
    private async recoverFromTemplateNotFound(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'Template Recovery',
            'The requested template was not found. Using basic template as fallback.',
            [
                'Document will be created with basic template',
                'You can manually add sections as needed',
                'Use /templates list to see available templates'
            ]
        );

        return {
            success: true,
            message: 'Recovered by using basic template',
            alternativeAction: 'use-basic-template'
        };
    }

    /**
     * Recover from file already exists error
     */
    private async recoverFromFileExists(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'File Exists Recovery',
            'A file with that name already exists. You can choose how to proceed.',
            [
                'Use a different filename',
                'Add --overwrite flag to replace the existing file',
                'Open the existing file to edit it'
            ]
        );

        return {
            success: true,
            message: 'Provided options for handling existing file',
            alternativeAction: 'suggest-alternatives'
        };
    }

    /**
     * Recover from directory not found error
     */
    private async recoverFromDirectoryNotFound(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'Directory Recovery',
            'The target directory does not exist. It will be created automatically.',
            [
                'Directory structure will be created',
                'File will be saved in the new directory',
                'Ensure you have write permissions to the workspace'
            ]
        );

        return {
            success: true,
            message: 'Will create missing directories',
            alternativeAction: 'create-directories'
        };
    }

    /**
     * Recover from permission denied error
     */
    private async recoverFromPermissionDenied(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'Permission Error',
            'Permission denied when trying to write the file.',
            [
                'Check file and directory permissions',
                'Try saving to a different location',
                'Run VS Code as administrator if necessary',
                'Ensure the file is not open in another application'
            ],
            'error'
        );

        return {
            success: false,
            error: 'Cannot recover from permission error automatically'
        };
    }

    /**
     * Recover from network error
     */
    private async recoverFromNetworkError(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'Network Error Recovery',
            'Network connectivity issue detected. Switching to offline mode.',
            [
                'Document will be created without AI assistance',
                'You can manually edit the document',
                'Try again when network connectivity is restored'
            ]
        );

        return {
            success: true,
            message: 'Switched to offline mode',
            alternativeAction: 'offline-mode'
        };
    }

    /**
     * Recover from rate limit error
     */
    private async recoverFromRateLimit(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'Rate Limit Recovery',
            'API rate limit exceeded. Document will be created without AI features.',
            [
                'Document created with basic content',
                'Wait a few minutes before trying AI features',
                'You can manually edit the document in the meantime'
            ]
        );

        return {
            success: true,
            message: 'Created document without AI features',
            alternativeAction: 'basic-creation'
        };
    }

    /**
     * Generic recovery for unknown errors
     */
    private async genericRecovery(error: Error, context: CommandContext): Promise<RecoveryResult> {
        this.registerRecoveryFeedback(
            'Error Recovery',
            'An unexpected error occurred, but we can try alternative approaches.',
            [
                'Try the operation with different parameters',
                'Check the VS Code output panel for more details',
                'Report this issue if it persists'
            ],
            'error'
        );

        return {
            success: false,
            error: 'Generic recovery - manual intervention required'
        };
    }

    /**
     * Provide fallback for /new command
     */
    private provideNewCommandFallback(originalIntent: CommandIntent): FallbackResult {
        return {
            success: true,
            fallbackAction: 'manual-document-creation',
            message: 'You can create the document manually as an alternative.',
            instructions: [
                'Create a new file in VS Code (Ctrl+N)',
                'Save it with a .md extension',
                'Add basic markdown structure manually',
                'Use /templates list to see available content templates'
            ]
        };
    }

    /**
     * Provide fallback for /update command
     */
    private provideUpdateCommandFallback(originalIntent: CommandIntent): FallbackResult {
        return {
            success: true,
            fallbackAction: 'manual-document-update',
            message: 'You can update the document manually.',
            instructions: [
                'Open the document in VS Code',
                'Navigate to the section you want to update',
                'Edit the content directly',
                'Save the file when done'
            ]
        };
    }

    /**
     * Provide fallback for /review command
     */
    private provideReviewCommandFallback(originalIntent: CommandIntent): FallbackResult {
        return {
            success: true,
            fallbackAction: 'manual-document-review',
            message: 'You can review the document manually.',
            instructions: [
                'Open the document and read through it',
                'Check for spelling and grammar errors',
                'Verify that all sections are complete',
                'Ask colleagues for feedback'
            ]
        };
    }

    /**
     * Provide generic fallback
     */
    private provideGenericFallback(originalIntent: CommandIntent): FallbackResult {
        return {
            success: true,
            fallbackAction: 'manual-operation',
            message: 'The operation can be performed manually.',
            instructions: [
                'Use VS Code\'s built-in features',
                'Refer to the documentation for manual steps',
                'Try the command again later'
            ]
        };
    }
}