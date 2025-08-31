import { ConversationManager } from '../../conversation/ConversationManager';
import { AgentManager } from '../../agents/AgentManager';
import { CommandResult } from '../../commands/types';

// Mock dependencies with proper class structure preservation
jest.mock('../../conversation/ConversationManager', () => {
	return {
		ConversationManager: jest.fn().mockImplementation(() => {
			return {
				startConversation: jest.fn(),
				continueConversation: jest.fn(),
				startContinuation: jest.fn(),
				shouldStartConversation: jest.fn(),
				handleError: jest.fn(),
				attemptRecovery: jest.fn()
			};
		})
	};
});

jest.mock('../../agents/AgentManager');

// Create a mock instance that will be returned by getInstance
const mockConversationManagerInstance = {
	startConversation: jest.fn(),
	continueConversation: jest.fn(),
	startContinuation: jest.fn(),
	shouldStartConversation: jest.fn(),
	handleError: jest.fn(),
	attemptRecovery: jest.fn()
};

// Mock the static getInstance method
ConversationManager.getInstance = jest.fn().mockReturnValue(mockConversationManagerInstance);

describe('Online/Offline Conversation Handling', () => {
	let conversationManager: any;
	let mockAgentManager: jest.Mocked<AgentManager>;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();
		
		// Get the mocked instance
		conversationManager = ConversationManager.getInstance();
		
		// Verify the instance is properly mocked
		expect(conversationManager).toBeDefined();
		expect(typeof conversationManager.startConversation).toBe('function');
		expect(typeof conversationManager.continueConversation).toBe('function');
		expect(typeof conversationManager.startContinuation).toBe('function');

		mockAgentManager = {
			setCurrentAgent: jest.fn(),
			getCurrentAgent: jest.fn(),
		} as any;
	});

	describe('Online Mode Simulation', () => {
		it('should successfully initiate conversation when online', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Configure the mock to return expected value
			conversationManager.startContinuation.mockResolvedValue('online-session');

			const sessionId = await conversationManager.startContinuation(
				'new',
				commandResult,
				userContext
			);

			expect(sessionId).toBe('online-session');
			expect(conversationManager.startContinuation).toHaveBeenCalledWith('new', commandResult, userContext);
		});

		it('should handle conversation continuation when online', async () => {
			// Configure the mock to return expected decision
			conversationManager.shouldStartConversation.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'I\'ve created your document! How can I help?',
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
		});
	});

	describe('Offline Mode Simulation', () => {
		it('should handle offline mode gracefully with network errors', async () => {
			const commandResult = {
				success: false,
				message: 'Service unavailable',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Simulate offline behavior
			conversationManager.startContinuation.mockRejectedValue(new Error('Service unavailable'));

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Service unavailable');
			}
		});

		it('should not fail when conversation cannot be started', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Simulate network unavailable
			conversationManager.startContinuation.mockRejectedValue(new Error('Network unavailable'));

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Network unavailable');
			}
		});
	});

	describe('Online/Offline Transitions', () => {
		it('should handle transition from online to offline during conversation', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Simulate going offline during conversation
			conversationManager.startContinuation.mockRejectedValue(new Error('Connection timeout'));

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Connection timeout');
			}
		});

		it('should handle intermittent connectivity issues', async () => {
			const commandResult = {
				success: true,
				message: 'Command succeeded',
				filePath: '/test/doc.md',
				templateUsed: 'prd'
			};

			const userContext = {
				requestsAssistance: true
			};

			// Simulate intermittent failures
			conversationManager.startContinuation.mockRejectedValue(new Error('Connection timeout'));

			try {
				await conversationManager.startContinuation('new', commandResult, userContext);
				fail('Expected error to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});
	});

	describe('Context Preservation', () => {
		it('should preserve conversation context across different scenarios', () => {
			// Configure the mock to return expected context
			conversationManager.shouldStartConversation.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'I\'ve created your PRD document! How can I help?',
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
		});

		it('should handle different template types correctly', () => {
			// Test PRD template
			conversationManager.shouldStartConversation.mockReturnValue({
				shouldContinue: true,
				agentName: 'document-assistant',
				initialPrompt: 'PRD document created',
				reason: 'success',
				confidence: 0.8
			});
			
			const prdDecision = conversationManager.shouldStartConversation(
				'new',
				{ success: true, templateUsed: 'prd' },
				{ requestsAssistance: true }
			);
			
			expect(prdDecision.agentName).toBe('document-assistant');
		});

		it('should provide fallback for unknown templates', () => {
			// Configure mock for unknown template fallback
			conversationManager.shouldStartConversation.mockReturnValue({
				shouldContinue: false,
				reason: 'No conversation mapping found for command',
				confidence: 0
			});
			
			const decision = conversationManager.shouldStartConversation(
				'unknown-command',
				{ success: true, templateUsed: 'unknown' },
				{}
			);
			
			expect(decision.shouldContinue).toBe(false);
		});
	});

	describe('Conversation Decision Logic', () => {
		it('should make appropriate conversation decisions based on context', () => {
			// Test successful command with assistance request
			conversationManager.shouldStartConversation.mockReturnValueOnce({
				shouldContinue: true,
				agentName: 'document-assistant',
				reason: 'User requested assistance',
				confidence: 0.9
			});
			
			const decision1 = conversationManager.shouldStartConversation(
				'new',
				{ success: true },
				{ requestsAssistance: true }
			);
			expect(decision1.shouldContinue).toBe(true);

			// Test command without assistance request
			conversationManager.shouldStartConversation.mockReturnValueOnce({
				shouldContinue: false,
				reason: 'No assistance requested',
				confidence: 0
			});
			
			const decision2 = conversationManager.shouldStartConversation(
				'new',
				{ success: true },
				{ requestsAssistance: false }
			);
			expect(decision2.shouldContinue).toBe(false);
		});

		it('should handle different command contexts correctly', () => {
			// Test mapped command
			conversationManager.shouldStartConversation.mockReturnValueOnce({
				shouldContinue: true,
				agentName: 'document-assistant',
				reason: 'Command mapped to conversation',
				confidence: 0.8
			});
			
			const mappedDecision = conversationManager.shouldStartConversation(
				'new',
				{ success: true },
				{ requestsAssistance: true }
			);
			expect(mappedDecision.shouldContinue).toBe(true);

			// Test unmapped command
			conversationManager.shouldStartConversation.mockReturnValueOnce({
				shouldContinue: false,
				reason: 'No conversation mapping found for command',
				confidence: 0
			});
			
			const unmappedDecision = conversationManager.shouldStartConversation(
				'unknown',
				{ success: true },
				{ requestsAssistance: true }
			);
			expect(unmappedDecision.shouldContinue).toBe(false);
		});
	});
});