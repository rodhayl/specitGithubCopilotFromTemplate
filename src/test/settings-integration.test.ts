// Integration test for settings functionality
import { SettingsWebviewProvider } from '../config/SettingsWebviewProvider';
import { SettingsCommand } from '../commands/SettingsCommand';
import { AgentManager } from '../agents/AgentManager';
import { LLMService } from '../llm/LLMService';
import { ConfigurationManager } from '../config/ConfigurationManager';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
    Uri: {
        joinPath: jest.fn().mockReturnValue({ fsPath: '/test/path' }),
        file: jest.fn().mockReturnValue({ fsPath: '/test/file' })
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                const config: any = {
                    'agentConfigDirectory': '.vscode/docu',
                    'preferredModel': 'gpt-4',
                    'defaultAgent': 'prd-creator'
                };
                return config[key] || defaultValue;
            }),
            update: jest.fn().mockResolvedValue(undefined)
        }),
        fs: {
            createDirectory: jest.fn().mockResolvedValue(undefined),
            readFile: jest.fn().mockResolvedValue(Buffer.from('[]')),
            writeFile: jest.fn().mockResolvedValue(undefined)
        }
    },
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        registerWebviewViewProvider: jest.fn()
    },
    commands: {
        registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: jest.fn()
    },
    ConfigurationTarget: {
        Workspace: 2
    }
}));

describe('Settings Integration Tests', () => {
    let settingsProvider: SettingsWebviewProvider;
    let mockAgentManager: jest.Mocked<AgentManager>;
    let mockLLMService: jest.Mocked<LLMService>;
    let mockExtensionContext: vscode.ExtensionContext;

    beforeEach(() => {
        mockExtensionContext = {
            extensionUri: { fsPath: '/test/extension' } as vscode.Uri,
            subscriptions: []
        } as any;

        mockAgentManager = {
            listAgents: jest.fn().mockReturnValue([
                {
                    name: 'prd-creator',
                    description: 'Creates PRDs',
                    phase: 'prd',
                    active: true
                },
                {
                    name: 'brainstormer',
                    description: 'Facilitates ideation',
                    phase: 'prd',
                    active: false
                }
            ])
        } as any;

        mockLLMService = {
            getAvailableModels: jest.fn().mockReturnValue([
                {
                    id: 'gpt-4',
                    name: 'GPT-4',
                    vendor: 'openai',
                    family: 'gpt-4',
                    maxTokens: 8192,
                    available: true
                },
                {
                    id: 'gpt-3.5-turbo',
                    name: 'GPT-3.5 Turbo',
                    vendor: 'openai',
                    family: 'gpt-3.5',
                    maxTokens: 4096,
                    available: true
                }
            ]),
            getConfig: jest.fn().mockReturnValue({
                preferredModel: 'gpt-4'
            }),
            updateConfig: jest.fn()
        } as any;

        settingsProvider = new SettingsWebviewProvider(
            mockExtensionContext.extensionUri,
            mockAgentManager,
            mockLLMService
        );
    });

    describe('Settings Webview Provider Integration', () => {
        it('should handle complete agent update workflow', async () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            // Initialize webview
            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Get the message handler
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];

            // Test agent update
            const updatedAgent = {
                name: 'prd-creator',
                systemPrompt: 'Updated system prompt for PRD creator',
                allowedTools: ['writeFile', 'applyTemplate'],
                workflowPhase: 'prd',
                description: 'Creates PRDs',
                enabled: true
            };

            await messageHandler({
                type: 'updateAgent',
                agent: updatedAgent
            });

            // Verify success message was shown
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Agent "prd-creator" updated successfully'
            );
        });

        it('should handle model selection workflow', async () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            // Initialize webview
            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Get the message handler
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];

            // Test model selection
            await messageHandler({
                type: 'selectModel',
                modelId: 'gpt-3.5-turbo'
            });

            // Verify LLM service was updated
            expect(mockLLMService.updateConfig).toHaveBeenCalledWith({
                preferredModel: 'gpt-3.5-turbo'
            });

            // Verify success message was shown
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Model "gpt-3.5-turbo" selected successfully'
            );
        });

        it('should handle agent reset workflow', async () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            // Initialize webview
            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Get the message handler
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];

            // Test agent reset
            await messageHandler({
                type: 'resetAgent',
                agentName: 'prd-creator'
            });

            // Verify success message was shown
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Agent "prd-creator" reset to default configuration'
            );
        });
    });

    describe('Settings Command Integration', () => {
        it('should register settings command successfully', () => {
            const disposable = SettingsCommand.register(mockExtensionContext, settingsProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'docu.openSettings',
                expect.any(Function)
            );
            expect(disposable).toBeDefined();
        });
    });

    describe('Configuration Management Integration', () => {
        it('should handle configuration updates through settings', async () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            // Initialize webview
            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Get the message handler
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];

            // Test settings save
            const settings = {
                defaultAgent: 'brainstormer',
                autoSaveDocuments: false,
                showWorkflowProgress: true
            };

            await messageHandler({
                type: 'saveSettings',
                settings
            });

            // Verify configuration was updated
            const mockConfig = vscode.workspace.getConfiguration('docu');
            expect(mockConfig.update).toHaveBeenCalledWith('defaultAgent', 'brainstormer', 2);
            expect(mockConfig.update).toHaveBeenCalledWith('autoSaveDocuments', false, 2);
            expect(mockConfig.update).toHaveBeenCalledWith('showWorkflowProgress', true, 2);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Settings saved successfully'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle agent update errors gracefully', async () => {
            // Mock workspace error
            (vscode.workspace.fs.writeFile as jest.Mock).mockRejectedValueOnce(
                new Error('Permission denied')
            );

            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            // Initialize webview
            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Get the message handler
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];

            // Test agent update with error
            const updatedAgent = {
                name: 'prd-creator',
                systemPrompt: 'Updated prompt',
                allowedTools: ['writeFile'],
                workflowPhase: 'prd',
                description: 'Creates PRDs',
                enabled: true
            };

            await messageHandler({
                type: 'updateAgent',
                agent: updatedAgent
            });

            // Verify error message was shown
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to update agent')
            );
        });
    });

    describe('Data Validation', () => {
        it('should provide correct builtin agent configurations', () => {
            const provider = settingsProvider as any;
            const builtinConfigs = provider.getBuiltinConfigurations();

            expect(builtinConfigs).toHaveLength(6);
            
            // Verify all required agents are present
            const agentNames = builtinConfigs.map((config: any) => config.name);
            expect(agentNames).toContain('prd-creator');
            expect(agentNames).toContain('brainstormer');
            expect(agentNames).toContain('requirements-gatherer');
            expect(agentNames).toContain('solution-architect');
            expect(agentNames).toContain('specification-writer');
            expect(agentNames).toContain('quality-reviewer');

            // Verify configuration structure
            builtinConfigs.forEach((config: any) => {
                expect(config).toHaveProperty('name');
                expect(config).toHaveProperty('systemPrompt');
                expect(config).toHaveProperty('allowedTools');
                expect(config).toHaveProperty('workflowPhase');
                expect(config).toHaveProperty('description');
                expect(config).toHaveProperty('enabled');
            });
        });
    });
});