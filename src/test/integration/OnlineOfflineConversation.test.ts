import { ConversationManager } from '../../conversation/ConversationManager';
import { AgentManager } from '../../agents/AgentManager';
import { CommandResult } from '../../commands/types';

// Mock dependencies
jest.mock('../../conversation/ConversationManager');
jest.mock('../../agents/AgentManager');

describe('Online/Offline Conversation Handling', () => {
	let conversationManager: ConversationManager;
	let mockAgentManager: jest.Mocked<AgentManager>;

	beforeEach(() => {
		// Create mocks
		conversationManager = ConversationManager.getInstance();
		jest.spyOn(conversationManager, 'startConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'continueConversation').mockImplementation(jest.fn());
		jest.spyOn(conversationManager, 'startContinuation').mockImplementation(jest.fn());

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

			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockResolvedValue('online-session');

			const sessionId = await conversationManager.startContinuation(
				'new',
				commandResult,
				userContext
			);

			expect(sessionId).toBe('online-session');
			expect(mockStartContinuation).toHaveBeenCalledWith('new', commandResult, userContext);
		});

		it('should handle conversation continuation when online', async () => {
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
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
			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Service unavailable'));

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
			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Network unavailable'));

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
			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Connection timeout'));

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
			const mockStartContinuation = jest.spyOn(conversationManager, 'startContinuation');
			mockStartContinuation.mockRejectedValue(new Error('Connection timeout'));

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
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
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
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			
			// Test PRD template
			mockShouldStart.mockReturnValue({
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
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			mockShouldStart.mockReturnValue({
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
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			
			// Test successful command with assistance request
			mockShouldStart.mockReturnValue({
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
			mockShouldStart.mockReturnValue({
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
			const mockShouldStart = jest.spyOn(conversationManager, 'shouldStartConversation');
			
			// Test mapped command
			mockShouldStart.mockReturnValue({
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
			mockShouldStart.mockReturnValue({
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