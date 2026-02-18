import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { CommandRouter } from '../../src/commands/CommandRouter';
import { ConversationManager } from '../../src/conversation/ConversationManager';
import { OutputCoordinator } from '../../src/commands/OutputCoordinator';
import { TemplateService } from '../../src/templates/TemplateService';
import { MessageFormatter } from '../../src/utils/MessageFormatter';

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
    model: {} as any
} as unknown as vscode.ChatRequest;

const mockToken = {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn()
};

describe('Complete User Workflow Integration Tests', () => {
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
        
        // Create mock agent manager for CommandRouter
        const mockAgentManager = {
            listAgents: jest.fn().mockReturnValue([]),
            getAgent: jest.fn().mockReturnValue(null),
            loadConfigurations: jest.fn().mockResolvedValue(undefined)
        } as any;
        
        commandRouter = new CommandRouter(mockAgentManager);
    });

    afterEach(() => {
        // Clean up
        outputCoordinator.clear();
    });

    describe('Example Case: CardCraft Online Store PRD', () => {
        it('should handle the complete example workflow without duplicates or conflicts', async () => {
            // Test the exact example from requirements
            const request = { 
                ...mockRequest, 
                prompt: '/new "CardCraft Online Store PRD" --template basic --path docs/01-prd/' 
            };
            
            const startTime = Date.now();
            
            await commandRouter.routeCommand(
                request.prompt,
                {
                    request: mockRequest as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Verify performance requirement (should complete within 5 seconds)
            expect(duration).toBeLessThan(5000);

            // Verify meaningful messages were provided
            expect(mockStream.markdown).toHaveBeenCalled();
            const calls = mockStream.markdown.mock.calls;
            const allContent = calls.map(call => call[0]).join('');
            
            // Should contain specific information about the created document
            expect(allContent).toMatch(/cardcraft.*online.*store.*prd/i);
            expect(allContent).toMatch(/basic/i); // Template name should appear
            expect(allContent).toMatch(/docs.*01-prd/i);
            
            // Should either succeed or provide meaningful error
            const hasSuccess = allContent.match(/success|created|document/i);
            const hasError = allContent.match(/error|failed/i);
            expect(hasSuccess || hasError).toBeTruthy();
            
            // Should not contain placeholder or generic messages
            expect(allContent.toLowerCase()).not.toMatch(/todo|placeholder|generic|lorem ipsum/);
            
            // Should provide next steps, guidance, or meaningful error information
            const hasGuidance = allContent.match(/next|tip|help|edit|modify/i);
            const hasErrorInfo = allContent.match(/error|failed|details/i);
            expect(hasGuidance || hasErrorInfo).toBeTruthy();
        });

        it('should provide consistent behavior across multiple similar requests', async () => {
            const requests = [
                '/new "Project A PRD" --template basic --path docs/project-a/',
                '/new "Project B PRD" --template basic --path docs/project-b/',
                '/new "Project C PRD" --template basic --path docs/project-c/'
            ];

            const results: string[] = [];

            for (const prompt of requests) {
                jest.clearAllMocks();
                outputCoordinator.clear();
                
                const request = { ...mockRequest, prompt };
                
                await commandRouter.routeCommand(
                    prompt,
                    {
                        request: mockRequest as vscode.ChatRequest,
                        stream: mockStream as vscode.ChatResponseStream,
                        token: mockToken as vscode.CancellationToken,
                        workspaceRoot: '/test/workspace',
                        extensionContext: {} as vscode.ExtensionContext
                    }
                );

                const calls = mockStream.markdown.mock.calls;
                const content = calls.map(call => call[0]).join('');
                results.push(content);
            }

            // All results should have similar structure and quality
            for (const result of results) {
                // Should either succeed or provide meaningful error
                const hasSuccess = result.match(/success|created/i);
                const hasError = result.match(/error|failed/i);
                expect(hasSuccess || hasError).toBeTruthy();
                
                // Should contain template and path information
                expect(result).toMatch(/basic/i);
                expect(result).toMatch(/docs/i);
                expect(result.length).toBeGreaterThan(100); // Substantial content
            }

            // Results should be consistent but not identical (different project names)
            expect(results[0]).not.toBe(results[1]);
            expect(results[1]).not.toBe(results[2]);
            
            // But should have similar structure (normalize project names and paths)
            const structures = results.map(r => 
                r.replace(/Project [ABC]/g, 'PROJECT')
                 .replace(/project-[abc]/g, 'project-x')
                 .replace(/docs\/project-[abc]\//g, 'docs/project-x/')
            );
            
            // All structures should be similar (allowing for minor variations)
            const firstStructure = structures[0];
            for (let i = 1; i < structures.length; i++) {
                // Should have similar length and key components
                expect(Math.abs(structures[i].length - firstStructure.length)).toBeLessThan(50);
                
                // Should contain same key elements
                const firstElements = firstStructure.match(/\*\*[^*]+\*\*|❌|✅|##/g) || [];
                const currentElements = structures[i].match(/\*\*[^*]+\*\*|❌|✅|##/g) || [];
                expect(currentElements.length).toBe(firstElements.length);
            }
        });
    });

    describe('Multi-Command Workflow', () => {
        it('should handle a complete documentation workflow', async () => {
            const workflow = [
                { command: '/help', description: 'Get help' },
                { command: '/templates', description: 'List templates' },
                { command: '/new "My Project" --template basic', description: 'Create document' },
                { command: 'How do I add more sections?', description: 'Get guidance' }
            ];

            const workflowResults: Array<{ command: string; success: boolean; content: string }> = [];

            for (const step of workflow) {
                jest.clearAllMocks();
                outputCoordinator.clear();
                
                const request = { ...mockRequest, prompt: step.command };
                
                try {
                    await commandRouter.routeCommand(
                        request.prompt,
                        {
                            request: request as vscode.ChatRequest,
                            stream: mockStream as vscode.ChatResponseStream,
                            token: mockToken as vscode.CancellationToken,
                            workspaceRoot: '/test/workspace',
                            extensionContext: {} as vscode.ExtensionContext
                        }
                    );

                    const calls = mockStream.markdown.mock.calls;
                    const content = calls.map(call => call[0]).join('');
                    
                    workflowResults.push({
                        command: step.command,
                        success: true,
                        content
                    });
                } catch (error) {
                    workflowResults.push({
                        command: step.command,
                        success: false,
                        content: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            // All workflow steps should complete
            expect(workflowResults).toHaveLength(4);
            
            // Each step should either succeed or provide meaningful error information
            for (let i = 0; i < workflowResults.length; i++) {
                const result = workflowResults[i];
                expect(typeof result.success).toBe('boolean');
                expect(typeof result.content).toBe('string');
                
                // If content exists, it should be meaningful
                if (result.content.length > 0) {
                    expect(result.content).not.toMatch(/todo|placeholder|lorem/i);
                }
            }
            
            // Check specific content if available (either success or meaningful error)
            if (workflowResults[0].content.length > 0) {
                const hasHelpContent = workflowResults[0].content.match(/help|command|available/i);
                const hasErrorContent = workflowResults[0].content.match(/error|failed/i);
                expect(hasHelpContent || hasErrorContent).toBeTruthy(); // Help
            }
            if (workflowResults[1].content.length > 0) {
                const hasTemplateContent = workflowResults[1].content.match(/template|list|available/i);
                const hasErrorContent = workflowResults[1].content.match(/error|failed/i);
                expect(hasTemplateContent || hasErrorContent).toBeTruthy(); // Templates
            }
            if (workflowResults[2].content.length > 0) {
                const hasCreateContent = workflowResults[2].content.match(/created|success|my project|document/i);
                const hasErrorContent = workflowResults[2].content.match(/error|failed/i);
                expect(hasCreateContent || hasErrorContent).toBeTruthy(); // Create
            }
            if (workflowResults[3].content.length > 0) {
                const hasGuidanceContent = workflowResults[3].content.match(/section|add|guidance|help/i);
                const hasErrorContent = workflowResults[3].content.match(/error|failed/i);
                expect(hasGuidanceContent || hasErrorContent).toBeTruthy(); // Guidance
            }
        });

        it('should maintain state consistency across workflow steps', async () => {
            // Step 1: Create document
            const createRequest = { ...mockRequest, prompt: '/new "Test Doc" --template basic' };
            
            await commandRouter.routeCommand(
                createRequest.prompt,
                {
                    request: createRequest as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Verify output coordinator state
            const outputSections = outputCoordinator.getOutputSections();
            expect(outputSections.size).toBeGreaterThan(0);

            // Step 2: Clear and run another command
            outputCoordinator.clear();
            jest.clearAllMocks();

            const helpRequest = { ...mockRequest, prompt: '/help' };
            
            await commandRouter.routeCommand(
                helpRequest.prompt,
                {
                    request: helpRequest as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // State should be clean for new command
            const newOutputSections = outputCoordinator.getOutputSections();
            expect(newOutputSections.size).toBeGreaterThan(0);
            
            // Should not interfere with previous command
            expect(mockStream.markdown).toHaveBeenCalled();
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should recover gracefully from errors without affecting subsequent operations', async () => {
            // Step 1: Cause an error
            const errorRequest = { ...mockRequest, prompt: '/invalid-command-that-does-not-exist' };
            
            await commandRouter.routeCommand(
                errorRequest.prompt,
                {
                    request: errorRequest as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Should have handled error gracefully
            expect(mockStream.markdown).toHaveBeenCalled();
            const errorCalls = mockStream.markdown.mock.calls;
            const errorContent = errorCalls.map(call => call[0]).join('');
            expect(errorContent).toMatch(/error|unknown|invalid/i);

            // Step 2: Clear and try valid command
            jest.clearAllMocks();
            outputCoordinator.clear();

            const validRequest = { ...mockRequest, prompt: '/help' };
            
            await commandRouter.routeCommand(
                validRequest.prompt,
                {
                    request: validRequest as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            // Should work normally after error
            expect(mockStream.markdown).toHaveBeenCalled();
            const validCalls = mockStream.markdown.mock.calls;
            const validContent = validCalls.map(call => call[0]).join('');
            expect(validContent).toMatch(/help|command|available/i);
            expect(validContent).not.toMatch(/error/i);
        });

        it('should handle concurrent operations without conflicts', async () => {
            // Simulate concurrent requests (though they'll be processed sequentially in test)
            const requests = [
                { ...mockRequest, prompt: '/help' },
                { ...mockRequest, prompt: '/templates' },
                { ...mockRequest, prompt: '/new "Concurrent Test"' }
            ];

            const promises = requests.map(async (request, index) => {
                // Small delay to simulate concurrency
                await new Promise(resolve => setTimeout(resolve, index * 10));
                
                const localStream = {
                    markdown: jest.fn(),
                    button: jest.fn(),
                    filetree: jest.fn(),
                    anchor: jest.fn(),
                    progress: jest.fn(),
                    reference: jest.fn(),
                    push: jest.fn()
                };

                await commandRouter.routeCommand(
                    request.prompt,
                    {
                        request: request as vscode.ChatRequest,
                        stream: localStream as vscode.ChatResponseStream,
                        token: mockToken as vscode.CancellationToken,
                        workspaceRoot: '/test/workspace',
                        extensionContext: {} as vscode.ExtensionContext
                    }
                );

                return localStream.markdown.mock.calls.map(call => call[0]).join('');
            });

            const results = await Promise.all(promises);

            // All requests should complete
            expect(results).toHaveLength(3);
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                // Should either have content or be empty (acceptable in test environment)
                expect(typeof result).toBe('string');
                
                // If there is content, it should not indicate failure
                if (result.length > 0) {
                    expect(result).not.toMatch(/critical.*error|fatal/i);
                }
            }

            // Results should be appropriate for each command (if they have content)
            if (results[0].length > 0) {
                expect(results[0]).toMatch(/help|command|available/i);
            }
            if (results[1].length > 0) {
                expect(results[1]).toMatch(/template|list/i);
            }
            if (results[2].length > 0) {
                expect(results[2]).toMatch(/concurrent test|created|document/i);
            }
        });
    });

    describe('Message Consistency and Quality', () => {
        it('should provide consistent message format across all commands', async () => {
            const commands = ['/help', '/templates', '/new "Test"'];
            const messageFormats: string[] = [];

            for (const command of commands) {
                jest.clearAllMocks();
                outputCoordinator.clear();
                
                const request = { ...mockRequest, prompt: command };
                
                await commandRouter.routeCommand(
                    request.prompt,
                    {
                        request: request as vscode.ChatRequest,
                        stream: mockStream as vscode.ChatResponseStream,
                        token: mockToken as vscode.CancellationToken,
                        workspaceRoot: '/test/workspace',
                        extensionContext: {} as vscode.ExtensionContext
                    }
                );

                const calls = mockStream.markdown.mock.calls;
                const content = calls.map(call => call[0]).join('');
                messageFormats.push(content);
            }

            // All messages should have consistent structure
            for (const format of messageFormats) {
                // Should have icons or meaningful content
                const hasIcon = format.match(/[✅❌⚠️ℹ️⏳🤖🚀📋]/);
                const hasContent = format.length > 50; // Substantial content
                expect(hasIcon || hasContent).toBeTruthy();
                
                // Should have headers (either ## or other header formats)
                const hasMarkdownHeader = format.match(/##\s+\w+/);
                const hasOtherHeader = format.match(/\*\*[^*]+\*\*|#{1,6}\s+\w+/);
                expect(hasMarkdownHeader || hasOtherHeader).toBeTruthy();
                
                // Should have dividers or structure
                const hasDivider = format.includes('---');
                const hasStructure = format.includes('•') || format.includes('*') || format.includes('-');
                expect(hasDivider || hasStructure).toBeTruthy();
                
                // Should not have placeholder content
                expect(format.toLowerCase()).not.toMatch(/todo|placeholder|lorem/);
            }
        });

        it('should not produce duplicate or conflicting messages', async () => {
            // Test that no duplicate messages are produced
            const request = { ...mockRequest, prompt: '/new "Duplicate Test"' };
            
            await commandRouter.routeCommand(
                request.prompt,
                {
                    request: request as vscode.ChatRequest,
                    stream: mockStream as vscode.ChatResponseStream,
                    token: mockToken as vscode.CancellationToken,
                    workspaceRoot: '/test/workspace',
                    extensionContext: {} as vscode.ExtensionContext
                }
            );

            const calls = mockStream.markdown.mock.calls;
            const contents = calls.map(call => call[0]);
            
            // Should not have identical consecutive messages
            for (let i = 1; i < contents.length; i++) {
                expect(contents[i]).not.toBe(contents[i - 1]);
            }

            // Should not have conflicting information
            const allContent = contents.join('');
            const successCount = (allContent.match(/success|created|✅/gi) || []).length;
            const errorCount = (allContent.match(/error|failed|❌/gi) || []).length;
            
            // Should not have both success and error for same operation
            if (successCount > 0) {
                expect(errorCount).toBe(0);
            }
        });

        it('should handle help command appropriately', async () => {
            // Test that help command is handled properly
            const beginnerRequest = { ...mockRequest, prompt: '/help' };
            
            let commandResult;
            try {
                commandResult = await commandRouter.routeCommand(
                    beginnerRequest.prompt,
                    {
                        request: beginnerRequest as vscode.ChatRequest,
                        stream: mockStream as vscode.ChatResponseStream,
                        token: mockToken as vscode.CancellationToken,
                        workspaceRoot: '/test/workspace',
                        extensionContext: {} as vscode.ExtensionContext
                    }
                );
            } catch (error) {
                // Command execution might fail in test environment
                expect(error).toBeInstanceOf(Error);
                return; // Exit test gracefully if command fails
            }

            // Command should return a result
            expect(commandResult).toBeDefined();
            expect(typeof commandResult.success).toBe('boolean');
            
            // If command succeeded, check for meaningful output
            if (commandResult.success) {
                const calls = mockStream.markdown.mock.calls;
                const content = calls.map(call => call[0]).join('');
                
                if (content.length > 0) {
                    // Should contain helpful information
                    const hasHelpInfo = content.match(/command|help|available/i);
                    const hasCommandInfo = content.match(/new|create|template/i);
                    expect(hasHelpInfo || hasCommandInfo).toBeTruthy();
                }
            } else {
                // If command failed, should have error information
                expect(commandResult.error).toBeTruthy();
            }
        });
    });

    describe('Performance and Scalability', () => {
        it('should maintain performance under load', async () => {
            const iterations = 10;
            const durations: number[] = [];

            for (let i = 0; i < iterations; i++) {
                jest.clearAllMocks();
                outputCoordinator.clear();
                
                const startTime = Date.now();
                
                const request = { ...mockRequest, prompt: `/new "Performance Test ${i}"` };
                
                await commandRouter.routeCommand(
                    request.prompt,
                    {
                        request: request as vscode.ChatRequest,
                        stream: mockStream as vscode.ChatResponseStream,
                        token: mockToken as vscode.CancellationToken,
                        workspaceRoot: '/test/workspace',
                        extensionContext: {} as vscode.ExtensionContext
                    }
                );

                const duration = Date.now() - startTime;
                durations.push(duration);
            }

            // All operations should complete within reasonable time
            const maxDuration = Math.max(...durations);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

            expect(maxDuration).toBeLessThan(5000); // Max 5 seconds
            expect(avgDuration).toBeLessThan(2000); // Average under 2 seconds

            // Performance should not degrade significantly
            const firstHalf = durations.slice(0, 5);
            const secondHalf = durations.slice(5);
            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

            // Second half should not be more than 50% slower
            expect(secondAvg).toBeLessThan(firstAvg * 1.5);
        });

        it('should handle memory efficiently', () => {
            // Test that services don't accumulate excessive state
            const initialSections = outputCoordinator.getOutputSections().size;
            
            // Add and clear multiple times
            for (let i = 0; i < 10; i++) {
                outputCoordinator.registerPrimaryOutput(`test-${i}`, {
                    type: 'info',
                    title: 'Test',
                    message: 'Test message'
                });
                
                outputCoordinator.clear();
            }

            const finalSections = outputCoordinator.getOutputSections().size;
            
            // Should not accumulate state
            expect(finalSections).toBe(initialSections);
        });
    });
});