/**
 * Test runner for conversation flow tests
 * 
 * This file can be used to run all conversation flow related tests
 * or specific test suites for debugging purposes.
 */

// Import all conversation flow test suites
import './unit/ConversationContinuationManager.test';
import './integration/CommandConversationFlow.test';
import './integration/ConversationErrorHandling.test';
import './integration/OnlineOfflineConversation.test';

// Test categories for organized execution
export const testCategories = {
	unit: [
		'ConversationContinuationManager.test.ts'
	],
	integration: [
		'CommandConversationFlow.test.ts',
		'ConversationErrorHandling.test.ts',
		'OnlineOfflineConversation.test.ts'
	],
	all: [
		'ConversationContinuationManager.test.ts',
		'CommandConversationFlow.test.ts',
		'ConversationErrorHandling.test.ts',
		'OnlineOfflineConversation.test.ts'
	]
};

// Test scenarios covered
export const testScenarios = {
	conversationContinuation: [
		'Command result evaluation for conversation continuation',
		'Conversation context preparation and validation',
		'Conversation prompt generation for different commands',
		'Conversation request creation and formatting'
	],
	commandToConversationFlow: [
		'New command to conversation flow',
		'Review command to conversation flow',
		'Chat command to conversation flow',
		'Command failure handling without conversation',
		'Conversation start failure handling'
	],
	errorHandlingAndRecovery: [
		'Network error recovery options',
		'Authentication error handling',
		'Rate limit error handling',
		'Automatic retry for transient failures',
		'Manual recovery for permanent failures',
		'Offline mode error handling'
	],
	onlineOfflineModes: [
		'Online mode conversation continuation',
		'Offline mode guidance provision',
		'Mode transition handling',
		'Context preservation across modes',
		'Command-specific offline guidance'
	]
};

// Coverage requirements
export const coverageRequirements = {
	ConversationContinuationManager: {
		functions: ['shouldContinueConversation', 'prepareConversationContext', 'generateContinuationPrompt', 'createConversationRequest'],
		scenarios: ['success cases', 'failure cases', 'edge cases', 'empty/null inputs']
	},
	ConversationRecoveryManager: {
		functions: ['handleConversationFailure', 'getRecoveryOptions', 'shouldRetryAutomatically', 'getRetryDelay'],
		scenarios: ['network errors', 'auth errors', 'rate limits', 'generic errors', 'offline mode']
	},
	ConversationFlowHandler: {
		functions: ['handleConversationStart', 'handleOfflineMode'],
		scenarios: ['successful starts', 'failed starts', 'retries', 'offline guidance']
	},
	CommandRouter: {
		functions: ['routeCommand with conversation continuation'],
		scenarios: ['all command types', 'success/failure paths', 'online/offline modes']
	}
};

console.log('Conversation Flow Test Suite');
console.log('============================');
console.log('');
console.log('Test Categories:', Object.keys(testCategories));
console.log('Test Scenarios:', Object.keys(testScenarios));
console.log('');
console.log('To run specific tests:');
console.log('npm test -- --testNamePattern="ConversationContinuationManager"');
console.log('npm test -- --testPathPattern="conversation"');
console.log('npm test -- src/test/unit/ConversationContinuationManager.test.ts');
console.log('');
console.log('To run with coverage:');
console.log('npm run test:coverage -- --testPathPattern="conversation"');