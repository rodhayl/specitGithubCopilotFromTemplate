// Offline mode manager for graceful degradation
import * as vscode from 'vscode';
import { Logger } from '../logging/Logger';

export interface OfflineCapabilities {
    fileOperations: boolean;
    templateProcessing: boolean;
    basicCommands: boolean;
    aiFeatures: boolean;
    networkRequiredFeatures: string[];
}

export interface ModelAvailabilityResult {
    available: boolean;
    models: vscode.LanguageModelChat[];
    error?: string;
    errorType?: 'authentication' | 'network' | 'permissions' | 'unknown';
    retryAfter?: number;
}

export interface OfflineStatus {
    isOffline: boolean;
    reason: string;
    lastCheck: Date;
    capabilities: OfflineCapabilities;
    modelStatus: {
        copilotAvailable: boolean;
        modelsFound: number;
        lastError?: string;
        errorType?: string;
    };
}

/**
 * OfflineManager - Manages offline mode and graceful degradation
 *
 * Monitors model availability, detects offline conditions, and provides graceful
 * degradation of functionality when AI models are unavailable. Manages automatic
 * recovery and offline mode notifications.
 *
 * @example
 * ```typescript
 * const offlineManager = OfflineManager.initialize(context);
 * const status = await offlineManager.checkModelAvailability();
 * offlineManager.subscribeToOfflineChanges((isOffline) => {
 *     console.log('Offline mode:', isOffline);
 * });
 * ```
 */
export class OfflineManager {
    private static instance: OfflineManager;
    private isOfflineMode = false;
    private modelAvailable = true;
    private lastModelCheck = 0;
    private modelCheckInterval = 60000; // Increased to 60 seconds to reduce auth interference
    private retryCount = 0;
    private maxRetries = 3;
    private readonly retryDelays = [1000, 5000, 15000]; // Exponential backoff
    private lastError?: string;
    private lastErrorType?: string;
    private forceOfflineMode = false;
    private debugLogging = false;
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance();
        this.loadConfiguration();

        // Listen for configuration changes (only if workspace is available)
        try {
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('docu.debug.offlineMode') ||
                    event.affectsConfiguration('docu.offline')) {
                    this.loadConfiguration();
                }
            });
        } catch (error) {
            // Ignore if workspace is not available (e.g., in tests)
        }
    }

    /**
     * Load configuration settings
     */
    private loadConfiguration(): void {
        try {
            const config = vscode.workspace.getConfiguration('docu');
            
            // Debug logging
            this.debugLogging = config?.get('debug.offlineMode', false) || false;
            
            // Offline mode settings
            const forceMode = (config?.get('offline.forceMode', 'auto') as string) || 'auto';
            const checkInterval = (config?.get('offline.checkInterval', 60) as number) || 60;
            const maxRetries = (config?.get('offline.maxRetries', 3) as number) || 3;
        
        // Update internal settings
        this.modelCheckInterval = checkInterval * 1000; // Convert to milliseconds
        this.maxRetries = Math.max(0, Math.min(10, maxRetries)); // Clamp between 0-10
        
        // Handle force mode
        switch (forceMode) {
            case 'online':
                this.forceOfflineMode = false;
                if (this.isOfflineMode) {
                    this.disableOfflineMode();
                }
                break;
            case 'offline':
                this.setOfflineMode(true, 'Forced offline mode via configuration');
                break;
            case 'auto':
            default:
                this.forceOfflineMode = false;
                break;
        }
        
            this.log(`Configuration loaded: debug=${this.debugLogging}, forceMode=${forceMode}, interval=${checkInterval}s, maxRetries=${maxRetries}`);
        } catch (error) {
            // Fallback to defaults if configuration is not available (e.g., in tests)
            this.debugLogging = false;
            this.modelCheckInterval = 60000;
            this.maxRetries = 3;
            this.forceOfflineMode = false;
        }
    }

    /**
     * Get the OfflineManager singleton instance
     *
     * @returns The OfflineManager singleton instance
     */
    static getInstance(): OfflineManager {
        if (!OfflineManager.instance) {
            OfflineManager.instance = new OfflineManager();
        }
        return OfflineManager.instance;
    }

    /**
     * Check if language models are available with improved error handling and retry logic
     */
    async checkModelAvailability(force?: boolean): Promise<ModelAvailabilityResult> {
        const now = Date.now();
        
        // Check if forced offline mode is enabled
        if (this.forceOfflineMode && !force) {
            this.log('Forced offline mode is active, skipping model check');
            return {
                available: false,
                models: [],
                error: 'Forced offline mode enabled',
                errorType: 'unknown'
            };
        }
        
        // Don't check too frequently unless forced
        if (!force && now - this.lastModelCheck < this.modelCheckInterval) {
            this.log('Skipping model check due to interval limit');
            return {
                available: this.modelAvailable,
                models: [],
                error: this.lastError,
                errorType: this.lastErrorType as any
            };
        }

        this.lastModelCheck = now;
        this.log('Starting model availability check');

        // First, do a lightweight check without triggering authentication
        const quickCheck = await this.performQuickAvailabilityCheck();
        if (!quickCheck.shouldProceed) {
            this.log(`Quick check failed: ${quickCheck.reason}`);
            const result: ModelAvailabilityResult = {
                available: false,
                models: [],
                error: quickCheck.reason,
                errorType: quickCheck.errorType
            };
            this.handleModelCheckResult(result);
            return result;
        }

        // Attempt model selection with retry logic
        return await this.attemptModelSelection();
    }

    /**
     * Perform a quick availability check without triggering authentication
     */
    private async performQuickAvailabilityCheck(): Promise<{
        shouldProceed: boolean;
        reason?: string;
        errorType?: 'authentication' | 'network' | 'permissions' | 'unknown';
    }> {
        try {
            // Check if Copilot extension is installed
            const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
            if (!copilotExtension) {
                return {
                    shouldProceed: false,
                    reason: 'GitHub Copilot extension not installed',
                    errorType: 'authentication'
                };
            }

            // Check if Copilot extension is active
            if (!copilotExtension.isActive) {
                this.log('GitHub Copilot extension not active, attempting to activate');
                try {
                    await copilotExtension.activate();
                    this.log('GitHub Copilot extension activated successfully');
                } catch (activationError) {
                    return {
                        shouldProceed: false,
                        reason: 'GitHub Copilot extension failed to activate',
                        errorType: 'authentication'
                    };
                }
            }

            // Check if we have any existing authentication without triggering new auth
            try {
                const sessions = await vscode.authentication.getSession('github', [], { silent: true });
                if (!sessions) {
                    this.log('No GitHub authentication session found (silent check)');
                    // Don't fail immediately - let the model selection attempt handle auth
                    return { shouldProceed: true };
                }
            } catch (authError) {
                this.log(`Silent authentication check failed: ${authError instanceof Error ? authError.message : String(authError)}`);
                // Continue anyway - the model selection will handle authentication
            }

            this.log('Quick availability check passed');
            return { shouldProceed: true };
        } catch (error) {
            this.log(`Quick availability check error: ${error instanceof Error ? error.message : String(error)}`);
            return {
                shouldProceed: false,
                reason: `Extension check failed: ${error instanceof Error ? error.message : String(error)}`,
                errorType: 'unknown'
            };
        }
    }

    /**
     * Attempt model selection with retry logic and exponential backoff
     */
    private async attemptModelSelection(): Promise<ModelAvailabilityResult> {
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Model selection attempt ${attempt + 1}/${this.maxRetries + 1}`);
                
                // Use a timeout to prevent hanging
                const modelSelectionPromise = vscode.lm.selectChatModels({
                    vendor: 'copilot'
                });
                
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Model selection timeout')), 10000);
                });
                
                const models = await Promise.race([modelSelectionPromise, timeoutPromise]);

                this.log(`Found ${models.length} Copilot models`);
                
                // Success - reset retry count and update state
                this.retryCount = 0;
                this.lastError = undefined;
                this.lastErrorType = undefined;
                
                const result: ModelAvailabilityResult = {
                    available: models.length > 0,
                    models: models,
                    error: models.length === 0 ? 'No Copilot models available' : undefined,
                    errorType: models.length === 0 ? 'unknown' : undefined
                };
                
                this.handleModelCheckResult(result);
                return result;
                
            } catch (error) {
                const errorInfo = this.categorizeError(error);
                this.log(`Model selection attempt ${attempt + 1} failed: ${errorInfo.message} (${errorInfo.type})`);
                
                // For the first attempt, be more lenient with authentication errors
                if (attempt === 0 && errorInfo.type === 'authentication') {
                    this.log('First attempt authentication error - will retry');
                    // Continue to retry logic
                } else if (errorInfo.type === 'authentication' || errorInfo.type === 'permissions') {
                    // On subsequent attempts or permission errors, fail immediately
                    const result: ModelAvailabilityResult = {
                        available: false,
                        models: [],
                        error: errorInfo.message,
                        errorType: errorInfo.type
                    };
                    this.handleModelCheckResult(result);
                    return result;
                }
                
                // If this is the last attempt, return the error
                if (attempt === this.maxRetries) {
                    const result: ModelAvailabilityResult = {
                        available: false,
                        models: [],
                        error: errorInfo.message,
                        errorType: errorInfo.type,
                        retryAfter: this.modelCheckInterval
                    };
                    this.handleModelCheckResult(result);
                    return result;
                }
                
                // Wait before retrying (exponential backoff)
                const delay = this.retryDelays[attempt] || 15000;
                this.log(`Waiting ${delay}ms before retry`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // This should never be reached, but just in case
        const result: ModelAvailabilityResult = {
            available: false,
            models: [],
            error: 'Maximum retry attempts exceeded',
            errorType: 'unknown'
        };
        this.handleModelCheckResult(result);
        return result;
    }

    /**
     * Categorize errors to determine appropriate handling
     */
    private categorizeError(error: any): { message: string; type: 'authentication' | 'network' | 'permissions' | 'unknown' } {
        if (error instanceof vscode.LanguageModelError) {
            switch (error.code) {
                case 'no-permissions':
                    return { message: 'No permissions to access language models', type: 'permissions' };
                case 'blocked':
                    return { message: 'Request blocked by content filters', type: 'permissions' };
                default:
                    return { message: `Language model error: ${error.message}`, type: 'unknown' };
            }
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check for timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('Model selection timeout')) {
            return { message: 'Model selection timed out', type: 'network' };
        }
        
        // Check for common authentication-related errors
        if (errorMessage.includes('authentication') || 
            errorMessage.includes('login') || 
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('token') ||
            errorMessage.includes('sign in') ||
            errorMessage.includes('not signed in')) {
            return { message: errorMessage, type: 'authentication' };
        }
        
        // Check for network-related errors
        if (errorMessage.includes('network') || 
            errorMessage.includes('connection') ||
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('fetch')) {
            return { message: errorMessage, type: 'network' };
        }
        
        return { message: errorMessage, type: 'unknown' };
    }

    /**
     * Handle the result of model availability check
     */
    private handleModelCheckResult(result: ModelAvailabilityResult): void {
        this.modelAvailable = result.available;
        this.lastError = result.error;
        this.lastErrorType = result.errorType;
        
        if (!result.available && !this.isOfflineMode) {
            const reason = result.error || 'Language models not available';
            this.enableOfflineMode(reason);
        } else if (result.available && this.isOfflineMode && !this.forceOfflineMode) {
            this.disableOfflineMode();
        }
    }

    /**
     * Get detailed status for debugging
     */
    getDetailedStatus(): OfflineStatus {
        return {
            isOffline: this.isOfflineMode,
            reason: this.lastError || (this.isOfflineMode ? 'Offline mode active' : 'Online'),
            lastCheck: new Date(this.lastModelCheck),
            capabilities: this.getCapabilities(),
            modelStatus: {
                copilotAvailable: this.modelAvailable,
                modelsFound: this.modelAvailable ? 1 : 0, // Simplified for now
                lastError: this.lastError,
                errorType: this.lastErrorType
            }
        };
    }

    /**
     * Set offline mode manually (for testing/debugging)
     */
    setOfflineMode(offline: boolean, reason?: string): void {
        this.forceOfflineMode = offline;
        if (offline) {
            this.enableOfflineMode(reason || 'Manually set to offline mode');
        } else {
            this.disableOfflineMode();
        }
    }

    /**
     * Log debug messages if debug logging is enabled
     */
    private log(message: string): void {
        if (this.debugLogging) {
            this.logger.extension.debug(`[OfflineManager] ${message}`);
        }
    }

    /**
     * Enable offline mode with reason
     */
    enableOfflineMode(reason: string): void {
        if (this.isOfflineMode) {
            return;
        }

        this.isOfflineMode = true;
        this.logger.extension.info(`Offline mode enabled: ${reason}`);

        // Notify user about offline mode (if available)
        try {
            vscode.window.showWarningMessage(
                `Docu is now running in offline mode: ${reason}. Some AI features will be unavailable.`,
                'Learn More'
            )?.then(selection => {
                if (selection === 'Learn More') {
                    this.showOfflineModeInfo();
                }
            });
        } catch (error) {
            // Ignore if window is not available (e.g., in tests)
        }
    }

    /**
     * Disable offline mode
     */
    disableOfflineMode(): void {
        if (!this.isOfflineMode) {
            return;
        }

        this.isOfflineMode = false;
        this.logger.extension.info('Offline mode disabled - full functionality restored');

        try {
            vscode.window.showInformationMessage(
                'Docu is back online! All AI features are now available.'
            );
        } catch (error) {
            // Ignore if window is not available (e.g., in tests)
        }
    }

    /**
     * Check if currently in offline mode
     */
    isOffline(): boolean {
        return this.isOfflineMode;
    }

    /**
     * Ensure models are checked (useful when startup check was skipped)
     */
    async ensureModelAvailability(): Promise<ModelAvailabilityResult> {
        // If we haven't checked models yet (lastModelCheck is 0), force a check
        if (this.lastModelCheck === 0) {
            this.log('First-time model availability check');
            return await this.checkModelAvailability(true);
        }
        
        // Otherwise, use normal check logic
        return await this.checkModelAvailability();
    }

    /**
     * Get current capabilities based on offline status
     */
    getCapabilities(): OfflineCapabilities {
        return {
            fileOperations: true, // Always available
            templateProcessing: true, // Always available
            basicCommands: true, // Always available
            aiFeatures: !this.isOfflineMode,
            networkRequiredFeatures: this.isOfflineMode ? [
                'AI-powered content generation',
                'Document review and suggestions',
                'Intelligent template recommendations',
                'Context-aware responses'
            ] : []
        };
    }

    /**
     * Provide fallback functionality for AI features
     */
    async getFallbackResponse(operation: string, context?: any): Promise<string> {
        const fallbackResponses: Record<string, string> = {
            'document-creation': `# ${context?.title || 'New Document'}

## Overview
*Please add your content here*

## Details
*Add detailed information*

## Next Steps
*List action items*

---
*This document was created in offline mode. AI assistance is not available.*`,

            'document-review': `## Review Results

**Status:** Offline Mode - Manual Review Required

**Recommendations:**
- Check document structure and formatting
- Verify all sections are complete
- Review grammar and spelling
- Ensure consistency with project standards

*AI-powered review is not available in offline mode. Please review manually.*`,

            'template-suggestion': 'Basic template applied. AI-powered template recommendations are not available in offline mode.',

            'content-generation': '*Content generation requires AI assistance, which is not available in offline mode. Please add content manually.*',

            'default': 'This feature requires AI assistance, which is not available in offline mode. Please try again when online or use manual alternatives.'
        };

        return fallbackResponses[operation] || fallbackResponses['default'];
    }

    /**
     * Show information about offline mode capabilities
     */
    private showOfflineModeInfo(): void {
        const panel = vscode.window.createWebviewPanel(
            'docuOfflineInfo',
            'Docu Offline Mode',
            vscode.ViewColumn.One,
            { enableScripts: false }
        );

        panel.webview.html = this.getOfflineModeInfoHtml();
    }

    private getOfflineModeInfoHtml(): string {
        const capabilities = this.getCapabilities();
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docu Offline Mode</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .status {
            background-color: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .available {
            color: var(--vscode-testing-iconPassed);
        }
        .unavailable {
            color: var(--vscode-testing-iconFailed);
        }
        ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        li {
            margin: 5px 0;
        }
        .section {
            margin-bottom: 25px;
        }
    </style>
</head>
<body>
    <h1>🔌 Docu Offline Mode</h1>
    
    <div class="status">
        <strong>⚠️ Offline Mode Active</strong><br>
        Some features are temporarily unavailable due to connectivity or model access issues.
    </div>

    <div class="section">
        <h2>✅ Available Features</h2>
        <ul>
            <li class="available">File operations (read, write, update)</li>
            <li class="available">Template processing and variable substitution</li>
            <li class="available">Basic slash commands (/new, /templates, /update)</li>
            <li class="available">Document structure management</li>
            <li class="available">File system navigation</li>
        </ul>
    </div>

    <div class="section">
        <h2>❌ Temporarily Unavailable</h2>
        <ul>
            ${capabilities.networkRequiredFeatures.map(feature => 
                `<li class="unavailable">${feature}</li>`
            ).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>🔄 Restoring Full Functionality</h2>
        <p>To restore all features:</p>
        <ul>
            <li>Ensure GitHub Copilot is installed and authenticated</li>
            <li>Check your internet connection</li>
            <li>Verify VS Code has access to language models</li>
            <li>Restart VS Code if issues persist</li>
        </ul>
    </div>

    <div class="section">
        <h2>💡 Working Offline</h2>
        <p>While in offline mode, you can still:</p>
        <ul>
            <li>Create documents using templates</li>
            <li>Update existing documents</li>
            <li>Organize and structure content</li>
            <li>Use basic formatting and templates</li>
        </ul>
        <p>AI-powered features will automatically return when connectivity is restored.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Validate operation availability in current mode
     */
    validateOperation(operation: string): { allowed: boolean; reason?: string } {
        if (!this.isOfflineMode) {
            return { allowed: true };
        }

        const offlineAllowedOperations = [
            'readFile',
            'writeFile',
            'listFiles',
            'applyTemplate',
            'insertSection',
            'openInEditor'
        ];

        if (offlineAllowedOperations.includes(operation)) {
            return { allowed: true };
        }

        return {
            allowed: false,
            reason: `Operation '${operation}' requires AI assistance, which is not available in offline mode`
        };
    }

    /**
     * Get offline-appropriate error message
     */
    getOfflineErrorMessage(operation: string): string {
        return `Cannot perform '${operation}' in offline mode. This feature requires AI assistance. Please check your connection and GitHub Copilot status.`;
    }
}