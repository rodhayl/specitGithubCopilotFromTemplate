import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface DocuConfiguration {
    defaultDirectory: string;
    defaultAgent: string;
    templateDirectory: string;
    agentConfigDirectory: string;
    autoSaveDocuments: boolean;
    showWorkflowProgress: boolean;
    enableHotReload: boolean;
    reviewLevel: 'light' | 'normal' | 'strict';
    maxFilesInSummary: number;
    enableDebugLogging: boolean;
    preferredModel: string;
    // Offline mode settings
    'offline.forceMode': 'auto' | 'online' | 'offline';
    'offline.checkInterval': number;
    'offline.maxRetries': number;
    'offline.skipStartupCheck': boolean;
    // Debug settings
    'debug.offlineMode': boolean;
}

/**
 * ConfigurationManager - Centralized configuration management for the extension
 *
 * Manages user configuration, workspace settings, file watchers, and configuration changes.
 * Provides a centralized interface for accessing and updating extension settings.
 *
 * @example
 * ```typescript
 * const configManager = new ConfigurationManager(context);
 * const config = configManager.getConfiguration();
 * configManager.onConfigurationChanged((newConfig) => {
 *     console.log('Config updated:', newConfig);
 * });
 * ```
 */
export class ConfigurationManager {
    private config: DocuConfiguration;
    private watchers: vscode.FileSystemWatcher[] = [];
    private changeListeners: Array<(config: DocuConfiguration) => void> = [];

    constructor(private extensionContext: vscode.ExtensionContext) {
        this.config = this.loadConfiguration();
        this.setupConfigurationWatcher();
        this.setupFileWatchers();
    }

    /**
     * Get current configuration
     */
    getConfiguration(): DocuConfiguration {
        return { ...this.config };
    }

    /**
     * Get a specific configuration value
     */
    get<K extends keyof DocuConfiguration>(key: K): DocuConfiguration[K] {
        return this.config[key];
    }

    /**
     * Update a configuration value
     */
    async set<K extends keyof DocuConfiguration>(key: K, value: DocuConfiguration[K]): Promise<void> {
        const vsCodeConfig = vscode.workspace.getConfiguration('docu');
        await vsCodeConfig.update(this.getVSCodeKey(key), value, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * Add a listener for configuration changes
     */
    onConfigurationChanged(listener: (config: DocuConfiguration) => void): vscode.Disposable {
        this.changeListeners.push(listener);
        return new vscode.Disposable(() => {
            const index = this.changeListeners.indexOf(listener);
            if (index >= 0) {
                this.changeListeners.splice(index, 1);
            }
        });
    }

    /**
     * Get workspace-relative path
     */
    getWorkspacePath(relativePath: string): string {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }
        return path.join(workspaceRoot, relativePath);
    }

    /**
     * Check if a directory exists, create if it doesn't
     */
    async ensureDirectory(dirPath: string): Promise<void> {
        try {
            const fullPath = path.isAbsolute(dirPath) ? dirPath : this.getWorkspacePath(dirPath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(fullPath));
        } catch (error) {
            // Directory might already exist, which is fine
            if (this.config.enableDebugLogging) {
                console.log(`Directory creation result for ${dirPath}:`, error);
            }
        }
    }

    /**
     * Get template directory path
     */
    getTemplateDirectory(): string {
        return this.getWorkspacePath(this.config.templateDirectory);
    }

    /**
     * Get agent configuration directory path
     */
    getAgentConfigDirectory(): string {
        return this.getWorkspacePath(this.config.agentConfigDirectory);
    }

    /**
     * Get default document directory path
     */
    getDefaultDocumentDirectory(): string {
        return this.getWorkspacePath(this.config.defaultDirectory);
    }

    /**
     * Validate configuration values
     */
    validateConfiguration(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate agent name
        const validAgents = ['prd-creator', 'brainstormer', 'requirements-gatherer', 'solution-architect', 'specification-writer', 'quality-reviewer'];
        if (!validAgents.includes(this.config.defaultAgent)) {
            errors.push(`Invalid default agent: ${this.config.defaultAgent}. Must be one of: ${validAgents.join(', ')}`);
        }

        // Validate review level
        const validLevels = ['light', 'normal', 'strict'];
        if (!validLevels.includes(this.config.reviewLevel)) {
            errors.push(`Invalid review level: ${this.config.reviewLevel}. Must be one of: ${validLevels.join(', ')}`);
        }

        // Validate numeric values
        if (this.config.maxFilesInSummary < 1 || this.config.maxFilesInSummary > 200) {
            errors.push(`Invalid maxFilesInSummary: ${this.config.maxFilesInSummary}. Must be between 1 and 200`);
        }

        // Validate paths (basic check)
        const pathFields = ['defaultDirectory', 'templateDirectory', 'agentConfigDirectory'];
        for (const field of pathFields) {
            const value = this.config[field as keyof DocuConfiguration] as string;
            if (value.includes('..') || path.isAbsolute(value)) {
                errors.push(`Invalid ${field}: ${value}. Must be a relative path within the workspace`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Reset configuration to defaults
     */
    async resetToDefaults(): Promise<void> {
        const vsCodeConfig = vscode.workspace.getConfiguration('docu');
        const defaultConfig = this.getDefaultConfiguration();

        for (const [key, value] of Object.entries(defaultConfig)) {
            await vsCodeConfig.update(this.getVSCodeKey(key as keyof DocuConfiguration), value, vscode.ConfigurationTarget.Workspace);
        }
    }

    /**
     * Export configuration to JSON
     */
    exportConfiguration(): string {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    async importConfiguration(jsonConfig: string): Promise<void> {
        try {
            const importedConfig = JSON.parse(jsonConfig) as Partial<DocuConfiguration>;
            const vsCodeConfig = vscode.workspace.getConfiguration('docu');

            for (const [key, value] of Object.entries(importedConfig)) {
                if (key in this.config) {
                    await vsCodeConfig.update(this.getVSCodeKey(key as keyof DocuConfiguration), value, vscode.ConfigurationTarget.Workspace);
                }
            }
        } catch (error) {
            throw new Error(`Invalid configuration JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Dispose of watchers and listeners
     */
    dispose(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers = [];
        this.changeListeners = [];
    }

    private loadConfiguration(): DocuConfiguration {
        const vsCodeConfig = vscode.workspace.getConfiguration('docu');
        
        return {
            defaultDirectory: vsCodeConfig.get('defaultDirectory', 'docs'),
            defaultAgent: vsCodeConfig.get('defaultAgent', 'prd-creator'),
            templateDirectory: vsCodeConfig.get('templateDirectory', '.vscode/docu/templates'),
            agentConfigDirectory: vsCodeConfig.get('agentConfigDirectory', '.vscode/docu'),
            autoSaveDocuments: vsCodeConfig.get('autoSaveDocuments', true),
            showWorkflowProgress: vsCodeConfig.get('showWorkflowProgress', true),
            enableHotReload: vsCodeConfig.get('enableHotReload', true),
            reviewLevel: vsCodeConfig.get('reviewLevel', 'normal') as 'light' | 'normal' | 'strict',
            maxFilesInSummary: vsCodeConfig.get('maxFilesInSummary', 50),
            enableDebugLogging: vsCodeConfig.get('enableDebugLogging', false),
            preferredModel: vsCodeConfig.get('preferredModel', ''),
            // Offline mode settings
            'offline.forceMode': vsCodeConfig.get('offline.forceMode', 'auto') as 'auto' | 'online' | 'offline',
            'offline.checkInterval': vsCodeConfig.get('offline.checkInterval', 60),
            'offline.maxRetries': vsCodeConfig.get('offline.maxRetries', 3),
            'offline.skipStartupCheck': vsCodeConfig.get('offline.skipStartupCheck', false),
            // Debug settings
            'debug.offlineMode': vsCodeConfig.get('debug.offlineMode', false)
        };
    }

    private getDefaultConfiguration(): DocuConfiguration {
        return {
            defaultDirectory: 'docs',
            defaultAgent: 'prd-creator',
            templateDirectory: '.vscode/docu/templates',
            agentConfigDirectory: '.vscode/docu',
            autoSaveDocuments: true,
            showWorkflowProgress: true,
            enableHotReload: true,
            reviewLevel: 'normal',
            maxFilesInSummary: 50,
            enableDebugLogging: false,
            preferredModel: '',
            // Offline mode settings
            'offline.forceMode': 'auto',
            'offline.checkInterval': 60,
            'offline.maxRetries': 3,
            'offline.skipStartupCheck': false,
            // Debug settings
            'debug.offlineMode': false
        };
    }

    private getVSCodeKey(key: keyof DocuConfiguration): string {
        // Convert camelCase to dot notation for VS Code settings
        return key.replace(/([A-Z])/g, (match, letter) => letter.toLowerCase());
    }

    private setupConfigurationWatcher(): void {
        const disposable = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('docu')) {
                const oldConfig = { ...this.config };
                this.config = this.loadConfiguration();
                
                if (this.config.enableDebugLogging) {
                    console.log('Docu configuration changed:', {
                        old: oldConfig,
                        new: this.config
                    });
                }

                // Notify listeners
                this.changeListeners.forEach(listener => {
                    try {
                        listener(this.config);
                    } catch (error) {
                        console.error('Error in configuration change listener:', error);
                    }
                });
            }
        });

        this.extensionContext.subscriptions.push(disposable);
    }

    private setupFileWatchers(): void {
        if (!this.config.enableHotReload) {
            return;
        }

        try {
            // Watch template directory
            const templatePattern = new vscode.RelativePattern(
                vscode.workspace.workspaceFolders![0],
                `${this.config.templateDirectory}/**/*`
            );
            const templateWatcher = vscode.workspace.createFileSystemWatcher(templatePattern);
            
            templateWatcher.onDidCreate(uri => this.handleFileChange('template', 'created', uri));
            templateWatcher.onDidChange(uri => this.handleFileChange('template', 'changed', uri));
            templateWatcher.onDidDelete(uri => this.handleFileChange('template', 'deleted', uri));
            
            this.watchers.push(templateWatcher);

            // Watch agent config directory
            const agentConfigPattern = new vscode.RelativePattern(
                vscode.workspace.workspaceFolders![0],
                `${this.config.agentConfigDirectory}/**/*.{json,yaml,yml}`
            );
            const agentConfigWatcher = vscode.workspace.createFileSystemWatcher(agentConfigPattern);
            
            agentConfigWatcher.onDidCreate(uri => this.handleFileChange('agent-config', 'created', uri));
            agentConfigWatcher.onDidChange(uri => this.handleFileChange('agent-config', 'changed', uri));
            agentConfigWatcher.onDidDelete(uri => this.handleFileChange('agent-config', 'deleted', uri));
            
            this.watchers.push(agentConfigWatcher);

            this.extensionContext.subscriptions.push(...this.watchers);

        } catch (error) {
            if (this.config.enableDebugLogging) {
                console.log('Could not setup file watchers:', error);
            }
        }
    }

    private handleFileChange(type: 'template' | 'agent-config', action: 'created' | 'changed' | 'deleted', uri: vscode.Uri): void {
        if (this.config.enableDebugLogging) {
            console.log(`File ${action}: ${type} at ${uri.fsPath}`);
        }

        // Emit a custom event that other components can listen to
        vscode.commands.executeCommand('docu.internal.fileChanged', {
            type,
            action,
            uri: uri.toString()
        });
    }
}