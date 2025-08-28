// Offline mode manager for graceful degradation
import * as vscode from 'vscode';

export interface OfflineCapabilities {
    fileOperations: boolean;
    templateProcessing: boolean;
    basicCommands: boolean;
    aiFeatures: boolean;
    networkRequiredFeatures: string[];
}

export class OfflineManager {
    private static instance: OfflineManager;
    private isOfflineMode = false;
    private modelAvailable = true;
    private lastModelCheck = 0;
    private readonly modelCheckInterval = 30000; // 30 seconds

    private constructor() {}

    static getInstance(): OfflineManager {
        if (!OfflineManager.instance) {
            OfflineManager.instance = new OfflineManager();
        }
        return OfflineManager.instance;
    }

    /**
     * Check if language models are available
     */
    async checkModelAvailability(): Promise<boolean> {
        const now = Date.now();
        
        // Don't check too frequently
        if (now - this.lastModelCheck < this.modelCheckInterval) {
            return this.modelAvailable;
        }

        this.lastModelCheck = now;

        try {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot'
            });

            this.modelAvailable = models.length > 0;
            
            if (!this.modelAvailable && !this.isOfflineMode) {
                this.enableOfflineMode('Language models not available');
            } else if (this.modelAvailable && this.isOfflineMode) {
                this.disableOfflineMode();
            }

            return this.modelAvailable;
        } catch (error) {
            console.warn('Model availability check failed:', error);
            this.modelAvailable = false;
            
            if (!this.isOfflineMode) {
                this.enableOfflineMode('Failed to access language models');
            }
            
            return false;
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
        console.log(`Offline mode enabled: ${reason}`);

        // Notify user about offline mode
        vscode.window.showWarningMessage(
            `Docu is now running in offline mode: ${reason}. Some AI features will be unavailable.`,
            'Learn More'
        ).then(selection => {
            if (selection === 'Learn More') {
                this.showOfflineModeInfo();
            }
        });
    }

    /**
     * Disable offline mode
     */
    disableOfflineMode(): void {
        if (!this.isOfflineMode) {
            return;
        }

        this.isOfflineMode = false;
        console.log('Offline mode disabled - full functionality restored');

        vscode.window.showInformationMessage(
            'Docu is back online! All AI features are now available.'
        );
    }

    /**
     * Check if currently in offline mode
     */
    isOffline(): boolean {
        return this.isOfflineMode;
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