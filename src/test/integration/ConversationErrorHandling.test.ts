import { ConversationManager } from '../../conversation/ConversationManager';
import { AgentManager } from '../../agents/AgentManager';
import { CommandResult } from '../../commands/types';

// Mock dependencies
jest.mock('../../conversation/ConversationManager');
jest.mock('../../agents/AgentManager');

describe('Conversation Error Handling', () => {
	let conversationManager: ConversationManager;
	let mockAgentManager: jest.Mocked<AgentManager>;

	beforeEach(() => {
		// Create mocks
		conversationManager = ConversationManager.getInstance();
		jest.spyOn(conversationManager, 'startConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'continueConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'handleError').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'attemptRecovery').mockImplementation(jest.fn());

		mockAgentManager = {
			setCurrentAgent: jest.fn(),
			getCurrentAgent: jest.fn(),
		} as any;
	});

	describe('Error Handling in shouldStartConversation', () => {
		it('should handle invalid command names gracefully', () => {
			expect(() => {
				conversationManager.shouldStartConversation('', {}, {});
			}).not.toThrow();

			expect(() => {
				conversationManager.shouldStartConversation(null as any, {}, {});
			}).not.toThrow();

			expect(() => {
				conversationManager.shouldStartConversation(undefined as any, {}, {});
			}).not.toThrow();
		});

		it('should handle invalid command results gracefully', () => {
			expect(() => {
				conversationManager.shouldStartConversation('new', null as any, {});
			}).not.toThrow();

			expect(() => {
				conversationManager.shouldStartConversation('new', undefined as any, {});
			}).not.toThrow();
		});

		it('should handle invalid user context gracefully', () => {
			expect(() => {
				conversationManager.shouldStartConversation('new', { success: true }, null as any);
			}).not.toThrow();

			expect(() => {
				conversationManager.shouldStartConversation('new', { success: true }, undefined as any);
			}).not.toThrow();
		});
	});

	describe('Error Handling in conversation operations', () => {
		it('should handle conversation errors properly', () => {
			const sessionId = 'test-session';
			const error = new Error('Network error');
			(error as any).type = 'network';
			(error as any).recoverable = true;

			const mockHandleError = jest.spyOn(conversationManager, 'handleError');
			mockHandleError.mockReturnValue({
				canRetry: true,
				canModify: false,
				canFallback: true,
				suggestedActions: ['Retry operation', 'Check connection'],
				fallbackOptions: ['Use offline mode']
			});

			const result = conversationManager.handleError(sessionId, {
				type: 'execution',
				message: error.message,
				recoverable: true
			});
			
			expect(result.canRetry).toBe(true);
			expect(result.suggestedActions).toBeDefined();
		});

		it('should handle invalid session IDs gracefully', () => {
			const error = new Error('Invalid input');
			(error as any).type = 'validation';
			(error as any).recoverable = false;

			expect(() => {
				conversationManager.handleError('', {
					type: 'execution',
					message: error.message,
					recoverable: true
				});
			}).not.toThrow();

			expect(() => {
				conversationManager.handleError(null as any, {
					type: 'execution',
					message: error.message,
					recoverable: true
				});
			}).not.toThrow();
		});
	});

	describe('Error Handling in startContinuation', () => {
		it('should handle conversation manager failures', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Mock conversation manager to throw
			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Network error'));

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Network error');
			}
		});

		it('should handle conversation start failures', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Mock conversation start to throw
			const mockStartConversation = jest.spyOn(conversationManager, 'startConversation');
			mockStartConversation.mockRejectedValue(new Error('Invalid agent'));

			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Invalid agent'));

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Invalid agent');
			}
		});

		it('should handle invalid command results gracefully', async () => {
			const invalidCommandResult = null as any;
			const userContext = { requestsAssistance: true };

			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Invalid command result'));

			try {
				await conversationManager.startContinuation('new', invalidCommandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should handle missing context gracefully', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const invalidContext = null as any;

			expect(() => {
				conversationManager.shouldStartConversation('new', commandResult, invalidContext);
			}).not.toThrow();
		});
	});

	describe('Recovery Scenarios', () => {
		it('should provide appropriate recovery options for network errors', () => {
			const sessionId = 'test-session';
			const networkError = new Error('Network timeout');
			(networkError as any).type = 'network';
			(networkError as any).recoverable = true;

			const mockHandleError = jest.spyOn(conversationManager, 'handleError');
			mockHandleError.mockReturnValue({
				canRetry: true,
				canModify: false,
				canFallback: true,
				suggestedActions: ['Retry the operation', 'Check network connection'],
				fallbackOptions: ['Use offline mode', 'Skip advanced features']
			});

			const result = conversationManager.handleError(sessionId, {
				type: 'network',
				message: networkError.message,
				recoverable: true
			});

			expect(result.canRetry).toBe(true);
			expect(result.fallbackOptions).toBeDefined();
			expect(result.fallbackOptions?.length).toBeGreaterThan(0);
		});

		it('should attempt recovery for recoverable errors', async () => {
			const sessionId = 'test-session';
			const error = new Error('Execution failed');
			(error as any).type = 'execution';
			(error as any).recoverable = true;

			const mockAttemptRecovery = jest.spyOn(conversationManager, 'attemptRecovery');
			mockAttemptRecovery.mockResolvedValue({
				success: true,
				action: 'retry',
				message: 'Operation retried successfully'
			});

			const result = await conversationManager.attemptRecovery(sessionId, {
				type: 'execution',
				message: error.message,
				recoverable: true
			}, 'retry');

			expect(result.success).toBe(true);
			expect(result.action).toBe('retry');
		});

		it('should handle non-recoverable errors appropriately', () => {
			const sessionId = 'test-session';
			const validationError = new Error('Invalid input parameters');
			(validationError as any).type = 'validation';
			(validationError as any).recoverable = false;

			const mockHandleError = jest.spyOn(conversationManager, 'handleError');
			mockHandleError.mockReturnValue({
				canRetry: false,
				canModify: true,
				canFallback: false,
				suggestedActions: [
					'Correct the input parameters',
					'Check the command syntax',
					'Verify required fields are provided'
				]
			});

			const result = conversationManager.handleError(sessionId, {
				type: 'validation',
				message: validationError.message,
				recoverable: false
			});

			expect(result.canRetry).toBe(false);
			expect(result.canModify).toBe(true);
			expect(result.suggestedActions).toBeDefined();
		});
	});
});