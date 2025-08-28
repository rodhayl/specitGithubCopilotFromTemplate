import * as vscode from 'vscode';
import { AgentManager } from '../agents/AgentManager';
import { LLMService } from '../llm/LLMService';
import { AgentConfiguration } from '../agents/types';

export class SettingsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'docu.settingsView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentManager: AgentManager,
        private readonly llmService: LLMService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'getAgents':
                    await this.sendAgentData();
                    break;
                case 'getModels':
                    await this.sendModelData();
                    break;
                case 'updateAgent':
                    await this.updateAgent(data.agent);
                    break;
                case 'resetAgent':
                    await this.resetAgent(data.agentName);
                    break;
                case 'selectModel':
                    await this.selectModel(data.modelId);
                    break;
                case 'saveSettings':
                    await this.saveSettings(data.settings);
                    break;
            }
        });

        // Send initial data
        this.sendAgentData();
        this.sendModelData();
    }

    private async sendAgentData() {
        if (!this._view) {
            return;
        }

        const agents = this.agentManager.listAgents();
        const configurations = await this.getAgentConfigurations();
        
        this._view.webview.postMessage({
            type: 'agentData',
            agents,
            configurations
        });
    }

    private async sendModelData() {
        if (!this._view) {
            return;
        }

        const models = this.llmService.getAvailableModels();
        const currentConfig = this.llmService.getConfig();
        
        this._view.webview.postMessage({
            type: 'modelData',
            models,
            selectedModel: currentConfig.preferredModel || (models.length > 0 ? models[0].id : null)
        });
    }

    private async getAgentConfigurations(): Promise<AgentConfiguration[]> {
        // Get configurations from workspace settings
        const config = vscode.workspace.getConfiguration('docu');
        const agentConfigDir = config.get<string>('agentConfigDirectory', '.vscode/docu');
        
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                return this.getBuiltinConfigurations();
            }

            const configPath = vscode.Uri.joinPath(
                vscode.Uri.file(workspaceRoot), 
                agentConfigDir, 
                'agents.json'
            );

            try {
                const configData = await vscode.workspace.fs.readFile(configPath);
                const userConfigs: AgentConfiguration[] = JSON.parse(configData.toString());
                return [...this.getBuiltinConfigurations(), ...userConfigs];
            } catch {
                return this.getBuiltinConfigurations();
            }
        } catch (error) {
            console.error('Error loading agent configurations:', error);
            return this.getBuiltinConfigurations();
        }
    }

    private getBuiltinConfigurations(): AgentConfiguration[] {
        return [
            {
                name: 'prd-creator',
                systemPrompt: 'You are a PRD Creator agent that helps develop initial product ideas into comprehensive Product Requirements Documents. Focus on understanding user needs, market context, and business objectives.',
                allowedTools: ['writeFile', 'applyTemplate', 'openInEditor'],
                workflowPhase: 'prd',
                description: 'Creates Product Requirements Documents from initial ideas',
                enabled: true
            },
            {
                name: 'brainstormer',
                systemPrompt: 'You are a Brainstormer agent that facilitates ideation and concept exploration. Help users think through problems creatively and generate innovative solutions.',
                allowedTools: ['readFile', 'writeFile', 'insertSection'],
                workflowPhase: 'prd',
                description: 'Facilitates ideation and concept exploration',
                enabled: true
            },
            {
                name: 'requirements-gatherer',
                systemPrompt: 'You are a Requirements Gatherer agent that systematically collects and structures business requirements using EARS format (Event, Action, Response, State).',
                allowedTools: ['readFile', 'writeFile', 'insertSection', 'applyTemplate'],
                workflowPhase: 'requirements',
                description: 'Collects and structures business requirements',
                enabled: true
            },
            {
                name: 'solution-architect',
                systemPrompt: 'You are a Solution Architect agent that designs technical solutions and system architecture. Focus on scalability, maintainability, and best practices.',
                allowedTools: ['readFile', 'writeFile', 'insertSection', 'applyTemplate'],
                workflowPhase: 'design',
                description: 'Designs technical solutions and architecture',
                enabled: true
            },
            {
                name: 'specification-writer',
                systemPrompt: 'You are a Specification Writer agent that creates detailed technical specifications and implementation plans. Break down complex requirements into actionable tasks.',
                allowedTools: ['readFile', 'writeFile', 'insertSection', 'listFiles'],
                workflowPhase: 'implementation',
                description: 'Creates technical specifications and implementation plans',
                enabled: true
            },
            {
                name: 'quality-reviewer',
                systemPrompt: 'You are a Quality Reviewer agent that validates and improves all document types with strict review criteria. Ensure consistency, completeness, and clarity.',
                allowedTools: ['readFile', 'writeFile', 'insertSection'],
                workflowPhase: 'implementation',
                description: 'Reviews and improves document quality',
                enabled: true
            }
        ];
    }

    private async updateAgent(agentConfig: AgentConfiguration) {
        try {
            await this.saveAgentConfiguration(agentConfig);
            
            // Show success message
            vscode.window.showInformationMessage(`Agent "${agentConfig.name}" updated successfully`);
            
            // Refresh agent data
            await this.sendAgentData();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async resetAgent(agentName: string) {
        try {
            const builtinConfigs = this.getBuiltinConfigurations();
            const builtinConfig = builtinConfigs.find(config => config.name === agentName);
            
            if (builtinConfig) {
                await this.saveAgentConfiguration(builtinConfig);
                vscode.window.showInformationMessage(`Agent "${agentName}" reset to default configuration`);
                await this.sendAgentData();
            } else {
                vscode.window.showErrorMessage(`Cannot reset agent "${agentName}": no default configuration found`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to reset agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async selectModel(modelId: string) {
        try {
            // Update LLM service configuration
            this.llmService.updateConfig({ preferredModel: modelId });
            
            // Save to workspace settings
            const config = vscode.workspace.getConfiguration('docu');
            await config.update('preferredModel', modelId, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage(`Model "${modelId}" selected successfully`);
            
            // Refresh model data
            await this.sendModelData();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to select model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async saveSettings(settings: any) {
        try {
            const config = vscode.workspace.getConfiguration('docu');
            
            // Save general settings
            for (const [key, value] of Object.entries(settings)) {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
            
            vscode.window.showInformationMessage('Settings saved successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async saveAgentConfiguration(agentConfig: AgentConfiguration) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder is open');
        }

        const config = vscode.workspace.getConfiguration('docu');
        const agentConfigDir = config.get<string>('agentConfigDirectory', '.vscode/docu');
        
        const configDirUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), agentConfigDir);
        const configPath = vscode.Uri.joinPath(configDirUri, 'agents.json');

        // Ensure directory exists
        try {
            await vscode.workspace.fs.createDirectory(configDirUri);
        } catch {
            // Directory might already exist
        }

        // Load existing configurations
        let existingConfigs: AgentConfiguration[] = [];
        try {
            const configData = await vscode.workspace.fs.readFile(configPath);
            existingConfigs = JSON.parse(configData.toString());
        } catch {
            // File doesn't exist yet
        }

        // Update or add the configuration
        const existingIndex = existingConfigs.findIndex(config => config.name === agentConfig.name);
        if (existingIndex >= 0) {
            existingConfigs[existingIndex] = agentConfig;
        } else {
            existingConfigs.push(agentConfig);
        }

        // Save the updated configurations
        const configJson = JSON.stringify(existingConfigs, null, 2);
        await vscode.workspace.fs.writeFile(configPath, Buffer.from(configJson, 'utf8'));
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docu Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            margin: 0;
        }
        
        .section {
            margin-bottom: 24px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            color: var(--vscode-textLink-foreground);
        }
        
        .agent-item {
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
            background-color: var(--vscode-input-background);
        }
        
        .agent-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .agent-name {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .agent-phase {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
        
        .agent-description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .prompt-container {
            margin-bottom: 12px;
        }
        
        .prompt-label {
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
        }
        
        .prompt-textarea {
            width: 100%;
            min-height: 80px;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            resize: vertical;
        }
        
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        
        .button {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 13px;
        }
        
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .model-selector {
            margin-bottom: 16px;
        }
        
        .model-select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        
        .model-info {
            margin-top: 8px;
            padding: 8px;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            font-size: 13px;
        }
        
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
        }
        
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 12px;
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">🤖 Model Selection</div>
        <div id="modelSection">
            <div class="loading">Loading available models...</div>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">⚙️ Agent Configuration</div>
        <div id="agentSection">
            <div class="loading">Loading agent configurations...</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let agents = [];
        let configurations = [];
        let models = [];
        let selectedModel = null;
        
        // Request initial data
        vscode.postMessage({ type: 'getAgents' });
        vscode.postMessage({ type: 'getModels' });
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'agentData':
                    agents = message.agents;
                    configurations = message.configurations;
                    renderAgents();
                    break;
                case 'modelData':
                    models = message.models;
                    selectedModel = message.selectedModel;
                    renderModels();
                    break;
            }
        });
        
        function renderModels() {
            const modelSection = document.getElementById('modelSection');
            
            if (models.length === 0) {
                modelSection.innerHTML = '<div class="error">No models available. Please ensure GitHub Copilot is enabled.</div>';
                return;
            }
            
            const selectedModelInfo = models.find(m => m.id === selectedModel);
            
            modelSection.innerHTML = \`
                <div class="model-selector">
                    <label class="prompt-label" for="modelSelect">Select Language Model:</label>
                    <select id="modelSelect" class="model-select">
                        \${models.map(model => 
                            \`<option value="\${model.id}" \${model.id === selectedModel ? 'selected' : ''}>
                                \${model.name} (\${model.family})
                            </option>\`
                        ).join('')}
                    </select>
                </div>
                \${selectedModelInfo ? \`
                    <div class="model-info">
                        <strong>Selected Model:</strong> \${selectedModelInfo.name}<br>
                        <strong>Family:</strong> \${selectedModelInfo.family}<br>
                        <strong>Vendor:</strong> \${selectedModelInfo.vendor}<br>
                        <strong>Max Tokens:</strong> \${selectedModelInfo.maxTokens || 'Unknown'}
                    </div>
                \` : ''}
            \`;
            
            document.getElementById('modelSelect').addEventListener('change', (e) => {
                vscode.postMessage({ 
                    type: 'selectModel', 
                    modelId: e.target.value 
                });
            });
        }
        
        function renderAgents() {
            const agentSection = document.getElementById('agentSection');
            
            if (configurations.length === 0) {
                agentSection.innerHTML = '<div class="loading">No agent configurations found.</div>';
                return;
            }
            
            agentSection.innerHTML = configurations.map(config => \`
                <div class="agent-item">
                    <div class="agent-header">
                        <span class="agent-name">\${config.name}</span>
                        <span class="agent-phase">\${config.workflowPhase}</span>
                    </div>
                    <div class="agent-description">\${config.description}</div>
                    <div class="prompt-container">
                        <label class="prompt-label" for="prompt-\${config.name}">System Prompt:</label>
                        <textarea 
                            id="prompt-\${config.name}" 
                            class="prompt-textarea"
                            data-agent="\${config.name}"
                        >\${config.systemPrompt}</textarea>
                    </div>
                    <div class="button-group">
                        <button class="button" onclick="updateAgent('\${config.name}')">
                            Save Changes
                        </button>
                        <button class="button secondary" onclick="resetAgent('\${config.name}')">
                            Reset to Default
                        </button>
                    </div>
                </div>
            \`).join('');
        }
        
        function updateAgent(agentName) {
            const textarea = document.getElementById(\`prompt-\${agentName}\`);
            const config = configurations.find(c => c.name === agentName);
            
            if (config && textarea) {
                const updatedConfig = {
                    ...config,
                    systemPrompt: textarea.value
                };
                
                vscode.postMessage({
                    type: 'updateAgent',
                    agent: updatedConfig
                });
            }
        }
        
        function resetAgent(agentName) {
            vscode.postMessage({
                type: 'resetAgent',
                agentName: agentName
            });
        }
    </script>
</body>
</html>`;
    }
}