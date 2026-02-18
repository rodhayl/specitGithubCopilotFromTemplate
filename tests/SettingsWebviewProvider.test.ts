import { SettingsWebviewProvider } from '../src/config/SettingsWebviewProvider';
import { AgentManager } from '../src/agents/AgentManager';
import { LLMService } from '../src/llm/LLMService';
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
            get: jest.fn().mockReturnValue('.vscode/docu'),
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
        showErrorMessage: jest.fn()
    },
    ConfigurationTarget: {
        Workspace: 2
    }
}));

describe('SettingsWebviewProvider', () => {
    let settingsProvider: SettingsWebviewProvider;
    let mockAgentManager: jest.Mocked<AgentManager>;
    let mockLLMService: jest.Mocked<LLMService>;
    let mockExtensionUri: vscode.Uri;

    beforeEach(() => {
        mockExtensionUri = { fsPath: '/test/extension' } as vscode.Uri;
        
        mockAgentManager = {
            listAgents: jest.fn().mockReturnValue([
                {
                    name: 'prd-creator',
                    description: 'Creates PRDs',
                    phase: 'prd',
                    active: true
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
                }
            ]),
            getConfig: jest.fn().mockReturnValue({
                preferredModel: 'gpt-4'
            }),
            updateConfig: jest.fn()
        } as any;

        settingsProvider = new SettingsWebviewProvider(
            mockExtensionUri,
            mockAgentManager,
            mockLLMService
        );
    });

    describe('resolveWebviewView', () => {
        it('should initialize webview with proper options', () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            expect(mockWebviewView.webview.options.enableScripts).toBe(true);
            expect(mockWebviewView.webview.options.localResourceRoots).toEqual([mockExtensionUri]);
            expect(mockWebviewView.webview.html).toContain('Docu Settings');
        });

        it('should handle getAgents message', async () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate receiving getAgents message
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
            await messageHandler({ type: 'getAgents' });

            expect(mockAgentManager.listAgents).toHaveBeenCalled();
            expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
                type: 'agentData',
                agents: expect.any(Array),
                configurations: expect.any(Array)
            });
        });

        it('should handle getModels message', async () => {
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn()
                }
            } as any;

            settingsProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate receiving getModels message
            const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
            await messageHandler({ type: 'getModels' });

            expect(mockLLMService.getAvailableModels).toHaveBeenCalled();
            expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
                type: 'modelData',
                models: expect.any(Array),
                selectedModel: 'gpt-4'
            });
        });
    });

    describe('agent configuration management', () => {
        it('should provide builtin configurations', () => {
            const provider = settingsProvider as any;
            const builtinConfigs = provider.getBuiltinConfigurations();

            expect(builtinConfigs).toHaveLength(6);
            expect(builtinConfigs[0].name).toBe('prd-creator');
            expect(builtinConfigs[0].systemPrompt).toContain('PRD Creator');
        });
    });

    describe('HTML generation', () => {
        it('should generate valid HTML for webview', () => {
            const provider = settingsProvider as any;
            const html = provider._getHtmlForWebview({} as vscode.Webview);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Docu Settings');
            expect(html).toContain('Model Selection');
            expect(html).toContain('Agent Configuration');
            expect(html).toContain('acquireVsCodeApi()');
        });
    });
});