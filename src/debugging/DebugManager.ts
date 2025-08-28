// Debugging and diagnostics system
import * as vscode from 'vscode';
import { Logger } from '../logging/Logger';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import { ErrorHandler } from '../error/ErrorHandler';

export interface DebugInfo {
    timestamp: Date;
    category: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    data?: any;
    stackTrace?: string;
}

export interface SystemDiagnostics {
    extension: {
        version: string;
        isActive: boolean;
        activationTime?: number;
    };
    vscode: {
        version: string;
        language: string;
        machineId: string;
        sessionId: string;
    };
    workspace: {
        hasWorkspace: boolean;
        workspaceName?: string;
        folderCount: number;
    };
    copilot: {
        isAvailable: boolean;
        isAuthenticated?: boolean;
        modelCount?: number;
    };
    performance: {
        memoryUsage: NodeJS.MemoryUsage;
        uptime: number;
    };
}

export class DebugManager {
    private static instance: DebugManager;
    private logger: Logger;
    private telemetry: TelemetryManager;
    private errorHandler: ErrorHandler;
    private context: vscode.ExtensionContext;
    private debugInfo: DebugInfo[] = [];
    private diagnosticsPanel: vscode.WebviewPanel | undefined;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = Logger.getInstance();
        this.telemetry = TelemetryManager.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
    }

    static initialize(context: vscode.ExtensionContext): DebugManager {
        if (!DebugManager.instance) {
            DebugManager.instance = new DebugManager(context);
        }
        return DebugManager.instance;
    }

    static getInstance(): DebugManager {
        if (!DebugManager.instance) {
            throw new Error('DebugManager not initialized. Call DebugManager.initialize() first.');
        }
        return DebugManager.instance;
    }

    addDebugInfo(category: string, level: 'info' | 'warning' | 'error', message: string, data?: any): void {
        const debugInfo: DebugInfo = {
            timestamp: new Date(),
            category,
            level,
            message,
            data,
            stackTrace: level === 'error' ? new Error().stack : undefined
        };

        this.debugInfo.push(debugInfo);

        // Keep only last 500 debug entries
        if (this.debugInfo.length > 500) {
            this.debugInfo = this.debugInfo.slice(-500);
        }

        this.logger.extension.debug(`Debug info added: ${category}`, { level, message, data });
    }

    async getSystemDiagnostics(): Promise<SystemDiagnostics> {
        const extension = vscode.extensions.getExtension('docu.vscode-docu-extension');
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        
        // Check Copilot availability
        let copilotInfo = {
            isAvailable: false,
            isAuthenticated: undefined as boolean | undefined,
            modelCount: undefined as number | undefined
        };

        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            copilotInfo = {
                isAvailable: true,
                isAuthenticated: models.length > 0,
                modelCount: models.length
            };
        } catch (error) {
            this.logger.extension.debug('Copilot diagnostics failed', { error: error instanceof Error ? error.message : error });
        }

        return {
            extension: {
                version: extension?.packageJSON.version || 'unknown',
                isActive: extension?.isActive || false,
                activationTime: this.getActivationTime()
            },
            vscode: {
                version: vscode.version,
                language: vscode.env.language,
                machineId: vscode.env.machineId,
                sessionId: vscode.env.sessionId
            },
            workspace: {
                hasWorkspace: workspaceFolders.length > 0,
                workspaceName: vscode.workspace.name,
                folderCount: workspaceFolders.length
            },
            copilot: copilotInfo,
            performance: {
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
    }

    private getActivationTime(): number | undefined {
        const activationEvent = this.debugInfo.find(info => 
            info.category === 'extension' && info.message.includes('activated')
        );
        return activationEvent ? activationEvent.timestamp.getTime() : undefined;
    }

    generateDiagnosticReport(): string {
        const report = [];
        
        report.push('# Docu Extension Diagnostic Report');
        report.push(`Generated: ${new Date().toISOString()}`);
        report.push('');

        // System diagnostics
        report.push('## System Diagnostics');
        this.getSystemDiagnostics().then(diagnostics => {
            report.push(`**Extension Version:** ${diagnostics.extension.version}`);
            report.push(`**Extension Active:** ${diagnostics.extension.isActive}`);
            report.push(`**VS Code Version:** ${diagnostics.vscode.version}`);
            report.push(`**Language:** ${diagnostics.vscode.language}`);
            report.push(`**Workspace:** ${diagnostics.workspace.hasWorkspace ? diagnostics.workspace.workspaceName || 'Unnamed' : 'None'}`);
            report.push(`**Copilot Available:** ${diagnostics.copilot.isAvailable}`);
            report.push(`**Memory Usage:** ${Math.round(diagnostics.performance.memoryUsage.heapUsed / 1024 / 1024)}MB`);
            report.push('');
        });

        // Recent debug info
        report.push('## Recent Debug Information');
        const recentDebugInfo = this.debugInfo.slice(-20);
        for (const info of recentDebugInfo) {
            report.push(`**${info.timestamp.toISOString()}** [${info.level.toUpperCase()}] [${info.category}] ${info.message}`);
            if (info.data) {
                report.push(`  Data: ${JSON.stringify(info.data, null, 2)}`);
            }
        }
        report.push('');

        // Error statistics
        const errorStats = this.errorHandler.getErrorStatistics();
        report.push('## Error Statistics');
        report.push(`**Total Errors:** ${errorStats.totalErrors}`);
        report.push('**Errors by Severity:**');
        for (const [severity, count] of Object.entries(errorStats.errorsBySeverity)) {
            report.push(`  - ${severity}: ${count}`);
        }
        report.push('**Errors by Operation:**');
        for (const [operation, count] of Object.entries(errorStats.errorsByOperation)) {
            report.push(`  - ${operation}: ${count}`);
        }
        report.push('');

        // Telemetry statistics
        const telemetryStats = this.telemetry.getUsageStatistics();
        report.push('## Usage Statistics');
        report.push(`**Total Events:** ${telemetryStats.totalEvents}`);
        report.push(`**Session Duration:** ${Math.round(telemetryStats.sessionDuration / 1000)}s`);
        report.push(`**Error Rate:** ${(telemetryStats.errorRate * 100).toFixed(2)}%`);
        report.push('**Most Used Commands:**');
        for (const command of telemetryStats.mostUsedCommands.slice(0, 5)) {
            report.push(`  - ${command.command}: ${command.count}`);
        }
        report.push('');

        // Performance statistics
        const perfStats = this.telemetry.getPerformanceStatistics();
        report.push('## Performance Statistics');
        report.push(`**Average Command Duration:** ${perfStats.averageCommandDuration.toFixed(2)}ms`);
        report.push(`**Average Tool Duration:** ${perfStats.averageToolDuration.toFixed(2)}ms`);
        report.push('**Slowest Operations:**');
        for (const op of perfStats.slowestOperations.slice(0, 5)) {
            report.push(`  - ${op.name}: ${op.duration.toFixed(2)}ms`);
        }
        report.push('');

        // Logger statistics
        const logStats = this.logger.getStatistics();
        report.push('## Logging Statistics');
        report.push(`**Total Log Entries:** ${logStats.totalEntries}`);
        report.push('**Entries by Level:**');
        for (const [level, count] of Object.entries(logStats.entriesByLevel)) {
            report.push(`  - ${level}: ${count}`);
        }
        report.push('**Entries by Category:**');
        for (const [category, count] of Object.entries(logStats.entriesByCategory)) {
            report.push(`  - ${category}: ${count}`);
        }

        return report.join('\n');
    }

    async showDiagnosticsPanel(): Promise<void> {
        if (this.diagnosticsPanel) {
            this.diagnosticsPanel.reveal();
            return;
        }

        this.diagnosticsPanel = vscode.window.createWebviewPanel(
            'docuDiagnostics',
            'Docu Diagnostics',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.diagnosticsPanel.onDidDispose(() => {
            this.diagnosticsPanel = undefined;
        });

        await this.updateDiagnosticsPanel();
    }

    private async updateDiagnosticsPanel(): Promise<void> {
        if (!this.diagnosticsPanel) {
            return;
        }

        const diagnostics = await this.getSystemDiagnostics();
        const errorStats = this.errorHandler.getErrorStatistics();
        const telemetryStats = this.telemetry.getUsageStatistics();
        const perfStats = this.telemetry.getPerformanceStatistics();
        const logStats = this.logger.getStatistics();

        this.diagnosticsPanel.webview.html = this.getDiagnosticsHtml(
            diagnostics,
            errorStats,
            telemetryStats,
            perfStats,
            logStats
        );
    }

    private getDiagnosticsHtml(
        diagnostics: SystemDiagnostics,
        errorStats: any,
        telemetryStats: any,
        perfStats: any,
        logStats: any
    ): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docu Diagnostics</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .section {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            background-color: var(--vscode-editor-background);
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
        }
        .metric-label {
            font-weight: bold;
        }
        .metric-value {
            color: var(--vscode-textPreformat-foreground);
        }
        .status-good { color: var(--vscode-testing-iconPassed); }
        .status-warning { color: var(--vscode-testing-iconQueued); }
        .status-error { color: var(--vscode-testing-iconFailed); }
        .debug-entry {
            margin: 5px 0;
            padding: 8px;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .debug-timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }
        .debug-level-info { border-left-color: var(--vscode-testing-iconPassed); }
        .debug-level-warning { border-left-color: var(--vscode-testing-iconQueued); }
        .debug-level-error { border-left-color: var(--vscode-testing-iconFailed); }
        .refresh-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .refresh-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h1>🔧 Docu Extension Diagnostics</h1>
    
    <button class="refresh-button" onclick="location.reload()">🔄 Refresh</button>

    <div class="section">
        <h2>System Information</h2>
        <div class="metric">
            <span class="metric-label">Extension Version:</span>
            <span class="metric-value">${diagnostics.extension.version}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Extension Active:</span>
            <span class="metric-value ${diagnostics.extension.isActive ? 'status-good' : 'status-error'}">
                ${diagnostics.extension.isActive ? '✅ Yes' : '❌ No'}
            </span>
        </div>
        <div class="metric">
            <span class="metric-label">VS Code Version:</span>
            <span class="metric-value">${diagnostics.vscode.version}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Workspace:</span>
            <span class="metric-value ${diagnostics.workspace.hasWorkspace ? 'status-good' : 'status-warning'}">
                ${diagnostics.workspace.hasWorkspace ? diagnostics.workspace.workspaceName || 'Unnamed' : 'None'}
            </span>
        </div>
        <div class="metric">
            <span class="metric-label">GitHub Copilot:</span>
            <span class="metric-value ${diagnostics.copilot.isAvailable ? 'status-good' : 'status-error'}">
                ${diagnostics.copilot.isAvailable ? '✅ Available' : '❌ Not Available'}
            </span>
        </div>
        <div class="metric">
            <span class="metric-label">Memory Usage:</span>
            <span class="metric-value">${Math.round(diagnostics.performance.memoryUsage.heapUsed / 1024 / 1024)}MB</span>
        </div>
    </div>

    <div class="section">
        <h2>Error Statistics</h2>
        <div class="metric">
            <span class="metric-label">Total Errors:</span>
            <span class="metric-value ${errorStats.totalErrors > 0 ? 'status-warning' : 'status-good'}">${errorStats.totalErrors}</span>
        </div>
        ${Object.entries(errorStats.errorsBySeverity).map(([severity, count]) => `
            <div class="metric">
                <span class="metric-label">${severity}:</span>
                <span class="metric-value">${count}</span>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Usage Statistics</h2>
        <div class="metric">
            <span class="metric-label">Total Events:</span>
            <span class="metric-value">${telemetryStats.totalEvents}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Session Duration:</span>
            <span class="metric-value">${Math.round(telemetryStats.sessionDuration / 1000)}s</span>
        </div>
        <div class="metric">
            <span class="metric-label">Error Rate:</span>
            <span class="metric-value ${telemetryStats.errorRate > 0.1 ? 'status-warning' : 'status-good'}">
                ${(telemetryStats.errorRate * 100).toFixed(2)}%
            </span>
        </div>
        <h3>Most Used Commands:</h3>
        ${telemetryStats.mostUsedCommands.slice(0, 5).map((cmd: any) => `
            <div class="metric">
                <span class="metric-label">${cmd.command}:</span>
                <span class="metric-value">${cmd.count}</span>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Performance Statistics</h2>
        <div class="metric">
            <span class="metric-label">Avg Command Duration:</span>
            <span class="metric-value">${perfStats.averageCommandDuration.toFixed(2)}ms</span>
        </div>
        <div class="metric">
            <span class="metric-label">Avg Tool Duration:</span>
            <span class="metric-value">${perfStats.averageToolDuration.toFixed(2)}ms</span>
        </div>
        <h3>Slowest Operations:</h3>
        ${perfStats.slowestOperations.slice(0, 5).map((op: any) => `
            <div class="metric">
                <span class="metric-label">${op.name}:</span>
                <span class="metric-value">${op.duration.toFixed(2)}ms</span>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Recent Debug Information</h2>
        ${this.debugInfo.slice(-10).map(info => `
            <div class="debug-entry debug-level-${info.level}">
                <div class="debug-timestamp">${info.timestamp.toISOString()}</div>
                <strong>[${info.level.toUpperCase()}] [${info.category}]</strong> ${info.message}
                ${info.data ? `<pre>${JSON.stringify(info.data, null, 2)}</pre>` : ''}
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Actions</h2>
        <button class="refresh-button" onclick="copyDiagnostics()">📋 Copy Diagnostic Report</button>
        <button class="refresh-button" onclick="clearLogs()">🗑️ Clear Logs</button>
        <button class="refresh-button" onclick="showOutputChannel()">📄 Show Output Channel</button>
    </div>

    <script>
        function copyDiagnostics() {
            // This would need to be implemented with VS Code API
            alert('Diagnostic report copied to clipboard');
        }
        
        function clearLogs() {
            if (confirm('Are you sure you want to clear all logs?')) {
                // This would need to be implemented with VS Code API
                alert('Logs cleared');
            }
        }
        
        function showOutputChannel() {
            // This would need to be implemented with VS Code API
            alert('Output channel opened');
        }
    </script>
</body>
</html>`;
    }

    async exportDiagnostics(): Promise<void> {
        const report = this.generateDiagnosticReport();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `docu-diagnostics-${timestamp}.md`;

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: {
                'Markdown': ['md'],
                'Text': ['txt']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(report, 'utf8'));
            vscode.window.showInformationMessage(`Diagnostics exported to ${uri.fsPath}`);
        }
    }

    clearDebugInfo(): void {
        this.debugInfo = [];
        this.addDebugInfo('debug', 'info', 'Debug information cleared');
    }

    dispose(): void {
        if (this.diagnosticsPanel) {
            this.diagnosticsPanel.dispose();
        }
    }
}