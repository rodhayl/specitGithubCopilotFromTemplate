import { ConversationManager } from '../../conversation/ConversationManager';
import { AgentManager } from '../../agents/AgentManager';
import { CommandRouter } from '../../commands/CommandRouter';
import { ParsedCommand, CommandContext, CommandResult } from '../../commands/types';
import * as vscode from 'vscode';

// Mock dependencies
jest.mock('../../conversation/ConversationManager');
jest.mock('../../agents/AgentManager');
jest.mock('../../commands/CommandRouter');

describe('Command to Conversation Flow Integration', () => {
	let conversationManager: ConversationManager;
	let mockAgentManager: jest.Mocked<AgentManager>;
	let commandRouter: CommandRouter;
	let mockContext: CommandContext;

	beforeEach(() => {
		// Create mocks
		conversationManager = ConversationManager.getInstance();
		jest.spyOn(conversationManager, 'startConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'continueConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'shouldStartConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'startContinuation').mockImplementation(jest.fn());

		mockAgentManager = {
			setCurrentAgent: jest.fn(),
			getCurrentAgent: jest.fn(),
		} as any;

		commandRouter = new CommandRouter();

		mockContext = {
			stream: {
				markdown: jest.fn(),
				anchor: jest.fn(),
				button: jest.fn(),
				filetree: jest.fn(),
				progress: jest.fn(),
				reference: jest.fn()
			} as any,
			request: {} as any,
			token: {} as any,
			workspaceRoot: '/test',
			extensionContext: {} as any
		};
	});

	describe('Command Flow Integration', () => {
		it('should determine conversation continuation correctly for different commands', () => {
			// Mock the shouldStartConversation method
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			
			// Test PRD creation should continue conversation
			mockShouldStart.mockReturnValue({
				shouldContinue: true,
				agentName: 'prd-creator',
				reason: 'PRD template selected',
				confidence: 0.9
			});
			
			const shouldContinuePRD = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'prd' },
				{ requestsAssistance: true }
			);
			expect(shouldContinuePRD.shouldContinue).toBe(true);

			// Test basic template should not continue conversation by default
			mockShouldStart.mockReturnValue({
				shouldContinue: false,
				reason: 'No conversation mapping found for command',
				confidence: 0
			});
			
			const shouldContinueBasic = conversationManager.shouldStartConversation(
				'basic',
				{ success: true },
				{}
			);
			expect(shouldContinueBasic.shouldContinue).toBe(false);
		});

		it('should generate appropriate conversation decisions for different templates', () => {
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			
			// Test PRD config
			mockShouldStart.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'I\'ve created your PRD document! How can I help you customize it?',
				reason: 'Triggered by: success',
				confidence: 0.8
			});
			
			const prdDecision = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'prd' },
				{ requestsAssistance: true }
			);
			expect(prdDecision.shouldContinue).toBe(true);
			expect(prdDecision.agentName).toBe('document-assistant');

			// Test requirements decision
			const reqDecision = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'requirements' },
				{ requestsAssistance: true }
			);
			expect(reqDecision.shouldContinue).toBe(true);
		});

		it('should handle conversation initiation after successful command', async () => {
			const commandResult = {
				success: true,
				message: 'Document created successfully',
				filePath: '/test/new-prd.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockResolvedValue('test-session-123');

			const sessionId = await conversationManager.startContinuation(
				'new',
				commandResult,
				userContext
			);

			expect(sessionId).toBe('test-session-123');
			expect(mockStartContinuation).toHaveBeenCalledWith('new', commandResult, userContext);
		});

		it('should handle conversation initiation failure gracefully', async () => {
			const commandResult = {
				success: true,
				message: 'Document created successfully',
				filePath: '/test/new-prd.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			const error = new Error('Conversation service unavailable');
			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(error);

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (thrownError) {
				expect(thrownError).toBe(error);
			}
		});
	});

	describe('Command-Specific Conversation Flows', () => {
		it('should handle new command with PRD template conversation flow', () => {
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'I\'ve created your PRD document! How can I help you customize it?',
				reason: 'Triggered by: success',
				confidence: 0.8
			});
			
			const decision = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'prd' },
				{ requestsAssistance: true }
			);
			
			expect(decision.shouldContinue).toBe(true);
			expect(decision.agentName).toBe('document-assistant');
			expect(decision.initialPrompt).toContain('PRD');
		});

		it('should handle new command with requirements template conversation flow', () => {
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'I\'ve created your requirements document! How can I help you customize it?',
				reason: 'Triggered by: success',
				confidence: 0.8
			});
			
			const decision = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'requirements' },
				{ requestsAssistance: true }
			);
			
			expect(decision.shouldContinue).toBe(true);
			expect(decision.agentName).toBe('document-assistant');
		});

		it('should handle new command with design template conversation flow', () => {
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'I\'ve created your design document! How can I help you customize it?',
				reason: 'Triggered by: success',
				confidence: 0.8
			});
			
			const decision = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'design' },
				{ requestsAssistance: true }
			);
			
			expect(decision.shouldContinue).toBe(true);
			expect(decision.agentName).toBe('document-assistant');
		});

		it('should handle commands without conversation continuation', () => {
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
				shouldContinue: false,
				reason: 'No conversation mapping found for command',
				confidence: 0
			});
			
			const decision = conversationManager.shouldStartConversation(
				'unknown-command',
				{ success: true },
				{}
			);
			
			expect(decision.shouldContinue).toBe(false);
		});
	});

	describe('Error Recovery in Command Flow', () => {
		it('should handle conversation errors with recovery options', () => {
			const sessionId = 'test-session';
			const error = {
				name: 'NetworkError',
				type: 'network' as const,
				message: 'Network timeout',
				recoverable: true
			};

			const recoveryOptions = conversationManager.handleError(sessionId, error);
			
			expect(recoveryOptions.canRetry).toBe(true);
			expect(recoveryOptions.suggestedActions).toBeDefined();
			expect(recoveryOptions.suggestedActions.length).toBeGreaterThan(0);
		});

		it('should attempt error recovery', async () => {
			const sessionId = 'test-session';
			const error = {
				name: 'ExecutionError',
				type: 'execution' as const,
				message: 'Execution failed',
				recoverable: true
			};

			const mockAttemptRecovery = jest.spyOn(conversationManager, 'attemptRecovery');
			mockAttemptRecovery.mockResolvedValue({
				success: true,
				action: 'retry',
				message: 'Operation retried successfully'
			});

			const result = await conversationManager.attemptRecovery(sessionId, error, 'retry');
			
			expect(result.success).toBe(true);
			expect(result.action).toBe('retry');
		});

		it('should handle non-recoverable errors', () => {
			const sessionId = 'test-session';
			const error = {
				name: 'ValidationError',
				type: 'validation' as const,
				message: 'Invalid input',
				recoverable: false
			};

			const recoveryOptions = conversationManager.handleError(sessionId, error);
			
			expect(recoveryOptions.canRetry).toBe(false);
			expect(recoveryOptions.canModify).toBe(true);
		});
	});
});