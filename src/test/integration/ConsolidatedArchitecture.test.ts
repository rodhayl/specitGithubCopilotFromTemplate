import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { CommandRouter } from '../../commands/CommandRouter';
import { ConversationManager } from '../../conversation/ConversationManager';
import { OutputCoordinator } from '../../commands/OutputCoordinator';
import { TemplateService } from '../../templates/TemplateService';
import { MessageFormatter } from '../../utils/MessageFormatter';

// Mock VS Code API
const mockStream = {
    markdown: jest.fn(),
    button: jest.fn(),
    filetree: jest.fn(),
    anchor: jest.fn(),
    progress: jest.fn(),
    reference: jest.fn(),
    push: jest.fn()
};

const mockContext = {
    history: []
};

const mockRequest = {
    prompt: '',
    command: undefined,
    references: [],
    toolReferences: [],
    toolInvocationToken: null as never,
    model: undefined
};

const mockToken = {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn()
};

describe('Consolidated Architecture Integration Tests', () => {
    let commandRouter: CommandRouter;
    let conversationManager: ConversationManager;
    let outputCoordinator: OutputCoordinator;
    let templateService: TemplateService;
    let messageFormatter: MessageFormatter;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Initialize consolidated services
        templateService = TemplateService.getInstance();
        outputCoordinator = OutputCoordinator.getInstance();
        conversationManager = ConversationManager.getInstance();
        messageFormatter = MessageFormatter.getInstance();
        
        commandRouter = new CommandRouter();
    });

    afterEach(() => {
        // Clean up
        outputCoordinator.clear();
    });

    describe('Code Duplication Detection', () => {
        it('should ensure no duplicate manager classes exist', () => {
            // Test that removed duplicate classes don't exist
            expect(() => require('../../conversation/ConversationFeedbackManager')).toThrow();
            expect(() => require('../../conversation/ConversationRecoveryManager')).toThrow();
            expect(() => require('../../conversation/ConversationContinuationManager')).toThrow();
            expect(() => require('../../commands/FeedbackCoordinator')).toThrow();
        });

        it('should have single instance of each core service', () => {
            // Test singleton pattern
            const templateService2 = TemplateService.getInstance();
            const outputCoordinator2 = OutputCoordinator.getInstance();
            const conversationManager2 = ConversationManager.getInstance();
            const messageFormatter2 = MessageFormatter.getInstance();

            expect(templateService).toBe(templateService2);
            expect(outputCoordinator).toBe(outputCoordinator2);
            expect(conversationManager).toBe(conversationManager2);
            expect(messageFormatter).toBe(messageFormatter2);
        });

        it('should not have duplicate functionality across services', () => {
            // Test that each service has distinct responsibilities
            expect(typeof outputCoordinator.registerPrimaryOutput).toBe('function');
            expect(typeof outputCoordinator.addFeedback).toBe('function');
            expect(typeof conversationManager.startConversation).toBe('function');
            expect(typeof templateService.getTemplate).toBe('function');
            expect(typeof messageFormatter.formatMessage).toBe('function');

            // Ensure no cross-contamination of methods
            expect((outputCoordinator as any).startConversation).toBeUndefined();
            expect((conversationManager as any).registerPrimaryOutput).toBeUndefined();
            expect((templateService as any).formatMessage).toBeUndefined();
        });
    });

    describe('Message Quality Validation', () => {
        it('should provide meaningful success messages', async () => {
            // Test document creation success message
            const request = { ...mockRequest, prompt: '/new readme "Test Project"' };
            
            await commandRouter.routeCommand(
                request.prompt,
                {
                    request: request as unknown as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Verify meaningful message was rendered
            expect(mockStream.markdown).toHaveBeenCalled();
            const calls = mockStream.markdown.mock.calls;
            const allContent = calls.map(call => call[0]).join('');
            
            // Should contain specific success information
            expect(allContent).toMatch(/success|created|document/i);
            expect(allContent).toMatch(/test project/i);
            expect(allContent).not.toMatch(/todo|placeholder|generic/i);
        });

        it('should provide meaningful error messages with recovery options', async () => {
            // Test error handling with invalid command
            const request = { ...mockRequest, prompt: '/invalid-command' };
            
            await commandRouter.routeCommand(
                request.prompt,
                {
                    request: request as unknown as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Verify error message was rendered
            expect(mockStream.markdown).toHaveBeenCalled();
            const calls = mockStream.markdown.mock.calls;
            const allContent = calls.map(call => call[0]).join('');
            
            // Should contain specific error information and recovery
            expect(allContent).toMatch(/error|unknown|invalid/i);
            expect(allContent).toMatch(/try|help|command/i);
        });

        it('should format messages consistently', () => {
            const testMessage = {
                type: 'success' as const,
                title: 'Test Success',
                message: 'This is a test message',
                details: ['Detail 1', 'Detail 2'],
                metadata: { 'Test Key': 'Test Value' }
            };

            const formatted = messageFormatter.formatMessage(testMessage);
            
            // Should have consistent structure
            expect(formatted).toContain('✅'); // Success icon
            expect(formatted).toContain('## Test Success'); // Header
            expect(formatted).toContain('This is a test message'); // Message
            expect(formatted).toContain('**Details:**'); // Details section
            expect(formatted).toContain('Detail 1'); // Detail content
            expect(formatted).toContain('**Information:**'); // Metadata section
            expect(formatted).toContain('**Test Key:** Test Value'); // Metadata content
            expect(formatted).toContain('---'); // Divider
        });

        it('should handle multiple message coordination', () => {
            const messages = [
                {
                    type: 'info' as const,
                    title: 'First Message',
                    message: 'First content'
                },
                {
                    type: 'success' as const,
                    title: 'Second Message', 
                    message: 'Second content'
                }
            ];

            const formatted = messageFormatter.formatMultipleMessages(messages);
            
            // Should contain both messages in order
            expect(formatted).toContain('First Message');
            expect(formatted).toContain('Second Message');
            expect(formatted.indexOf('First Message')).toBeLessThan(formatted.indexOf('Second Message'));
        });
    });

    describe('Integration Workflow Tests', () => {
        it('should handle complete document creation workflow', async () => {
            // Test the example case from requirements
            const request = { ...mockRequest, prompt: '/new "CardCraft Online Store PRD" --template basic --path docs/01-prd/' };
            
            await commandRouter.routeCommand(
                request.prompt,
                {
                    request: request as unknown as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Verify workflow completed successfully
            expect(mockStream.markdown).toHaveBeenCalled();
            const calls = mockStream.markdown.mock.calls;
            const allContent = calls.map(call => call[0]).join('');
            
            // Should contain workflow-specific information
            expect(allContent).toMatch(/cardcraft.*online.*store.*prd/i);
            expect(allContent).toMatch(/basic.*template/i);
            expect(allContent).toMatch(/docs.*01-prd/i);
        });

        it('should coordinate feedback from multiple sources', () => {
            // Add feedback from different sources
            outputCoordinator.addFeedback({
                type: 'tip',
                message: 'Tip from source 1',
                priority: 5,
                source: 'test-source-1'
            });

            outputCoordinator.addFeedback({
                type: 'guidance',
                message: 'Guidance from source 2',
                priority: 8,
                source: 'test-source-2'
            });

            const feedback = outputCoordinator.getPendingFeedback();
            
            // Should coordinate feedback properly
            expect(feedback).toHaveLength(2);
            expect(feedback[0].priority).toBe(8); // Higher priority first
            expect(feedback[1].priority).toBe(5);
        });

        it('should prevent duplicate feedback from same source', () => {
            const feedback = {
                type: 'tip' as const,
                message: 'Test feedback',
                priority: 5,
                source: 'duplicate-test'
            };

            // Add same feedback twice
            outputCoordinator.addFeedback(feedback);
            outputCoordinator.addFeedback(feedback);

            const pendingFeedback = outputCoordinator.getPendingFeedback();
            
            // Should only have one instance
            expect(pendingFeedback).toHaveLength(1);
        });

        it('should handle conversation continuation properly', async () => {
            // Start a conversation
            const session = await conversationManager.startConversation('test-agent', {
                documentType: 'test',
                documentPath: '/test/path',
                workflowPhase: 'initial'
            });

            expect(session.sessionId).toBeTruthy();
            expect(session.agentName).toBe('test-agent');

            // Test conversation continuation
            const response = await conversationManager.handleUserInput(
                session.sessionId,
                'Continue conversation',
                {}
            );

            expect(response.agentMessage).toBeTruthy();
            expect(typeof response.conversationComplete).toBe('boolean');
        });
    });

    describe('Performance and Reliability Tests', () => {
        it('should complete simple operations within 2 seconds', async () => {
            const startTime = Date.now();
            
            const request = { ...mockRequest, prompt: '/help' };
            
            await commandRouter.routeCommand(
                request.prompt,
                {
                    request: request as unknown as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(2000);
        });

        it('should handle errors gracefully without breaking subsequent operations', async () => {
            // First operation that should fail
            const errorRequest = { ...mockRequest, prompt: '/invalid-command' };
            
            await commandRouter.routeCommand(
                errorRequest.prompt,
                {
                    request: errorRequest as unknown as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Clear previous calls
            jest.clearAllMocks();

            // Second operation that should succeed
            const successRequest = { ...mockRequest, prompt: '/help' };
            
            await commandRouter.routeCommand(
                successRequest.prompt,
                {
                    request: successRequest as unknown as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Should have succeeded despite previous error
            expect(mockStream.markdown).toHaveBeenCalled();
        });

        it('should maintain consistent state across operations', () => {
            // Test that services maintain consistent state
            const initialOutputSections = outputCoordinator.getOutputSections().size;
            
            // Add some output
            outputCoordinator.registerPrimaryOutput('test', {
                type: 'info',
                title: 'Test',
                message: 'Test message'
            });

            expect(outputCoordinator.getOutputSections().size).toBe(initialOutputSections + 1);

            // Clear should reset state
            outputCoordinator.clear();
            expect(outputCoordinator.getOutputSections().size).toBe(0);
        });
    });

    describe('Architecture Validation Tests', () => {
        it('should have proper dependency injection', () => {
            // Test that CommandRouter properly uses injected dependencies
            expect(commandRouter).toBeDefined();
            
            // Should not create its own instances
            const routerTemplateService = (commandRouter as any).templateService;
            const routerOutputCoordinator = (commandRouter as any).outputCoordinator;
            const routerConversationManager = (commandRouter as any).conversationManager;

            expect(routerTemplateService).toBe(templateService);
            expect(routerOutputCoordinator).toBe(outputCoordinator);
            expect(routerConversationManager).toBe(conversationManager);
        });

        it('should follow single responsibility principle', () => {
            // Each service should have distinct, non-overlapping responsibilities
            
            // OutputCoordinator: message coordination and rendering
            expect(typeof outputCoordinator.registerPrimaryOutput).toBe('function');
            expect(typeof outputCoordinator.render).toBe('function');
            
            // ConversationManager: conversation lifecycle
            expect(typeof conversationManager.startConversation).toBe('function');
            expect(typeof conversationManager.endConversation).toBe('function');
            
            // TemplateService: template management
            expect(typeof templateService.getTemplate).toBe('function');
            expect(typeof templateService.renderTemplate).toBe('function');
            
            // MessageFormatter: message formatting
            expect(typeof messageFormatter.formatMessage).toBe('function');
            expect(typeof messageFormatter.formatError).toBe('function');
        });

        it('should use consistent error handling patterns', async () => {
            // Test that all services handle errors consistently
            try {
                await conversationManager.handleUserInput('invalid-session', 'test', {});
                // Should not reach here
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBeTruthy();
            }
        });
    });
});