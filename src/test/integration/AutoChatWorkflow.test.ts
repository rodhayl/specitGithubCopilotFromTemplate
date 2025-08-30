import { AutoChatStateManager } from '../../conversation/AutoChatStateManager';
import { DocumentUpdateEngine } from '../../conversation/DocumentUpdateEngine';
import { ConversationSessionRouter } from '../../conversation/ConversationSessionRouter';
import { NewCommandHandler } from '../../commands/NewCommandHandler';
import { ParsedCommand, CommandContext } from '../../commands/types';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
    ExtensionContext: jest.fn(),
    ChatResponseStream: jest.fn(),
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => defaultValue)
        })),
        fs: {
            writeFile: jest.fn(),
            stat: jest.fn(() => ({ size: 1024 }))
        },
        workspaceFolders: [{
            uri: { fsPath: '/workspace' }
        }]
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    window: {
        showTextDocument: jest.fn()
    }
}));

// Mock dependencies
jest.mock('../../logging', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

jest.mock('../../templates/TemplateService', () => ({
    TemplateService: {
        getInstance: jest.fn(() => ({
            getTemplate: jest.fn(() => ({
                name: 'PRD Template',
                content: '# {{title}}\n\n## Problem Statement\n\n{{PROBLEM_STATEMENT}}\n'
            })),
            renderTemplate: jest.fn(() => ({
                success: true,
                content: '# Test Document\n\n## Problem Statement\n\n[To be filled]\n'
            })),
            getDefaultVariables: jest.fn(() => ({})),
            listTemplates: jest.fn(() => [
                { id: 'prd', name: 'PRD Template' },
                { id: 'basic', name: 'Basic Template' }
            ])
        }))
    }
}));

jest.mock('../../commands/OutputCoordinator', () => ({
    OutputCoordinator: {
        getInstance: jest.fn(() => ({
            clear: jest.fn(),
            registerPrimaryOutput: jest.fn(),
            render: jest.fn()
        }))
    }
}));

jest.mock('../../utils/FileUtils', () => ({
    FileUtils: {
        generateSafeFilePath: jest.fn(() => '/workspace/test-document.md'),
        ensureDirectoryExists: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

describe('Auto-Chat Workflow Integration', () => {
    let autoChatManager: AutoChatStateManager;
    let documentUpdateEngine: DocumentUpdateEngine;
    let newCommandHandler: NewCommandHandler;
    let mockExtensionContext: any;
    let mockStream: any;

    beforeEach(() => {
        mockExtensionContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        };

        mockStream = {
            markdown: jest.fn()
        };

        autoChatManager = new AutoChatStateManager(mockExtensionContext);
        documentUpdateEngine = new DocumentUpdateEngine();
        newCommandHandler = new NewCommandHandler();
        
        // Set up dependencies
        newCommandHandler.setAutoChatManager(autoChatManager);
        newCommandHandler.setDocumentUpdateEngine(documentUpdateEngine);

        jest.clearAllMocks();
    });

    describe('Agent Set → Auto-Chat Workflow', () => {
        it('should enable auto-chat when agent is set', () => {
            const agentName = 'prd-creator';
            
            // Simulate agent set command
            autoChatManager.enableAutoChat(agentName);
            
            expect(autoChatManager.isAutoChatActive()).toBe(true);
            
            const context = autoChatManager.getAutoChatContext();
            expect(context?.agentName).toBe(agentName);
        });

        it('should show appropriate prompt after agent is set', () => {
            const agentName = 'prd-creator';
            
            autoChatManager.enableAutoChat(agentName);
            autoChatManager.showAutoChatPrompt(mockStream);
            
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Agent Set: prd-creator')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Ready for conversation!')
            );
        });

        it('should track session statistics correctly', () => {
            const agentName = 'prd-creator';
            
            autoChatManager.enableAutoChat(agentName);
            autoChatManager.updateActivity();
            autoChatManager.updateActivity();
            
            const stats = autoChatManager.getSessionStats();
            expect(stats.isActive).toBe(true);
            expect(stats.agentName).toBe(agentName);
            expect(stats.messageCount).toBe(2);
        });
    });

    describe('Document Creation → Auto-Chat Workflow', () => {
        it('should create document and enable auto-chat with --with-conversation flag', async () => {
            const parsedCommand: ParsedCommand = {
                command: 'new',
                arguments: ['Test PRD'],
                flags: {
                    'template': 'prd',
                    'with-conversation': true
                },
                subcommand: undefined,
                rawInput: '/new Test PRD --template=prd --with-conversation'
            };

            const context: CommandContext = {
                request: {} as any,
                stream: mockStream,
                token: {} as any,
                workspaceRoot: '/workspace',
                extensionContext: mockExtensionContext
            };

            const result = await newCommandHandler.execute(parsedCommand, context);

            expect(result.success).toBe(true);
            expect(result.autoChatEnabled).toBe(true);
            expect(autoChatManager.isAutoChatActive()).toBe(true);
            
            const autoChatContext = autoChatManager.getAutoChatContext();
            expect(autoChatContext?.agentName).toBe('prd-creator'); // Recommended agent for PRD template
        });

        it('should show document creation prompt with auto-chat guidance', async () => {
            const parsedCommand: ParsedCommand = {
                command: 'new',
                arguments: ['Test Document'],
                flags: {
                    'template': 'prd',
                    'with-conversation': true
                },
                subcommand: undefined,
                rawInput: '/new Test Document --template=prd --with-conversation'
            };

            const context: CommandContext = {
                request: {} as any,
                stream: mockStream,
                token: {} as any,
                workspaceRoot: '/workspace',
                extensionContext: mockExtensionContext
            };

            await newCommandHandler.execute(parsedCommand, context);

            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Document Created: Test Document')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Auto-chat enabled!')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('no need for `/chat`')
            );
        });

        it('should not enable auto-chat without --with-conversation flag', async () => {
            const parsedCommand: ParsedCommand = {
                command: 'new',
                arguments: ['Test Document'],
                flags: {
                    'template': 'basic'
                },
                subcommand: undefined,
                rawInput: '/new Test Document --template=basic'
            };

            const context: CommandContext = {
                request: {} as any,
                stream: mockStream,
                token: {} as any,
                workspaceRoot: '/workspace',
                extensionContext: mockExtensionContext
            };

            const result = await newCommandHandler.execute(parsedCommand, context);

            expect(result.success).toBe(true);
            expect(result.autoChatEnabled).toBeUndefined();
            expect(autoChatManager.isAutoChatActive()).toBe(false);
        });
    });

    describe('Conversation → Document Update Workflow', () => {
        it('should update document when conversation response is processed', async () => {
            const documentPath = '/workspace/test-prd.md';
            const agentName = 'prd-creator';
            
            // Enable auto-chat with document
            autoChatManager.enableAutoChat(agentName, documentPath, {
                templateId: 'prd'
            });

            const conversationResponse = {
                agentMessage: 'The main problem is that card game enthusiasts struggle to find reliable pricing information for their collections.',
                extractedContent: {
                    problemStatement: 'Card game enthusiasts struggle to find reliable pricing information'
                }
            };

            const templateStructure = {
                sections: {
                    'Problem Statement': { header: '## Problem Statement', required: true, order: 1 }
                },
                placeholders: {
                    '{{PROBLEM_STATEMENT}}': { section: 'Problem Statement', description: 'Main problem' }
                }
            };

            const conversationContext = {
                agentName,
                templateId: 'prd',
                currentTurn: 1,
                previousResponses: [],
                documentPath
            };

            const result = await documentUpdateEngine.updateDocumentFromConversation(
                documentPath,
                conversationResponse,
                templateStructure,
                conversationContext
            );

            expect(result.success).toBe(true);
            expect(result.sectionsUpdated).toContain('Problem Statement');
            expect(result.progressPercentage).toBeGreaterThan(0);
        });

        it('should track document update progress across multiple conversation turns', async () => {
            const documentPath = '/workspace/test-prd.md';
            
            // First update
            const firstResponse = {
                agentMessage: 'Problem statement content',
                extractedContent: { problemStatement: 'First problem' }
            };

            const templateStructure = {
                sections: {
                    'Problem Statement': { header: '## Problem Statement', required: true, order: 1 },
                    'Target Users': { header: '## Target Users', required: true, order: 2 }
                },
                placeholders: {}
            };

            await documentUpdateEngine.updateDocumentFromConversation(
                documentPath,
                firstResponse,
                templateStructure,
                {
                    agentName: 'prd-creator',
                    templateId: 'prd',
                    currentTurn: 1,
                    previousResponses: [],
                    documentPath
                }
            );

            // Second update
            const secondResponse = {
                agentMessage: 'Target users are card collectors and gamers',
                extractedContent: { targetUsers: 'Card collectors and gamers' }
            };

            await documentUpdateEngine.updateDocumentFromConversation(
                documentPath,
                secondResponse,
                templateStructure,
                {
                    agentName: 'prd-creator',
                    templateId: 'prd',
                    currentTurn: 2,
                    previousResponses: ['First problem'],
                    documentPath
                }
            );

            const progress = documentUpdateEngine.getUpdateProgress(documentPath);
            expect(progress.completedSections).toBeGreaterThan(1);
            expect(progress.updateHistory.length).toBeGreaterThan(1);
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle auto-chat timeout gracefully', () => {
            const agentName = 'prd-creator';
            
            autoChatManager.enableAutoChat(agentName);
            
            // Mock expired session
            const context = autoChatManager.getAutoChatContext();
            if (context) {
                context.lastActivity = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
            }

            // Should automatically disable when checked
            expect(autoChatManager.isAutoChatActive()).toBe(false);
        });

        it('should handle document update failures', async () => {
            const documentPath = '/workspace/test-document.md';
            const conversationResponse = {
                agentMessage: 'Test response'
            };
            const templateStructure = {
                sections: {},
                placeholders: {}
            };
            const conversationContext = {
                agentName: 'prd-creator',
                templateId: 'prd',
                currentTurn: 1,
                previousResponses: [],
                documentPath
            };

            // Mock file operation failure
            const FileUtils = require('../../utils/FileUtils').FileUtils;
            FileUtils.writeFile.mockRejectedValue(new Error('Permission denied'));

            const result = await documentUpdateEngine.updateDocumentFromConversation(
                documentPath,
                conversationResponse,
                templateStructure,
                conversationContext
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should clean up expired sessions automatically', () => {
            const agentName = 'prd-creator';
            
            autoChatManager.enableAutoChat(agentName);
            
            // Mock expired session
            const context = autoChatManager.getAutoChatContext();
            if (context) {
                context.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
            }

            autoChatManager.cleanupExpiredSessions();
            
            expect(autoChatManager.isAutoChatActive()).toBe(false);
        });
    });

    describe('State Persistence', () => {
        it('should persist auto-chat state across extension reloads', () => {
            const agentName = 'prd-creator';
            const documentPath = '/workspace/test.md';
            
            autoChatManager.enableAutoChat(agentName, documentPath);
            
            // Verify state was saved
            expect(mockExtensionContext.globalState.update).toHaveBeenCalledWith(
                'autoChatState',
                expect.objectContaining({
                    isActive: true,
                    context: expect.objectContaining({
                        agentName,
                        documentPath
                    })
                })
            );
        });

        it('should restore auto-chat state from persistence', () => {
            const persistedState = {
                isActive: true,
                context: {
                    agentName: 'prd-creator',
                    documentPath: '/workspace/test.md',
                    enabledAt: new Date().toISOString(),
                    lastActivity: new Date().toISOString()
                },
                messageCount: 3
            };

            mockExtensionContext.globalState.get.mockReturnValue(persistedState);

            const newManager = new AutoChatStateManager(mockExtensionContext);
            
            expect(newManager.isAutoChatActive()).toBe(true);
            const context = newManager.getAutoChatContext();
            expect(context?.agentName).toBe('prd-creator');
            expect(context?.documentPath).toBe('/workspace/test.md');
        });
    });

    describe('Multi-Agent Workflow', () => {
        it('should handle agent switching during active auto-chat', () => {
            // Start with PRD creator
            autoChatManager.enableAutoChat('prd-creator', '/workspace/prd.md');
            expect(autoChatManager.getAutoChatContext()?.agentName).toBe('prd-creator');
            
            // Switch to requirements gatherer
            autoChatManager.enableAutoChat('requirements-gatherer', '/workspace/requirements.md');
            expect(autoChatManager.getAutoChatContext()?.agentName).toBe('requirements-gatherer');
            
            // Should maintain active state
            expect(autoChatManager.isAutoChatActive()).toBe(true);
        });

        it('should provide agent-specific prompts and guidance', () => {
            const agents = ['prd-creator', 'requirements-gatherer', 'solution-architect'];
            
            agents.forEach(agentName => {
                autoChatManager.enableAutoChat(agentName);
                autoChatManager.showAutoChatPrompt(mockStream);
                
                expect(mockStream.markdown).toHaveBeenCalledWith(
                    expect.stringContaining(`Agent Set: ${agentName}`)
                );
            });
        });
    });
});