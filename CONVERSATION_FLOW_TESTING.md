# Conversation Flow Testing Documentation

This document describes the comprehensive testing strategy for the command-to-conversation flow fix implementation.

## Test Structure

### Unit Tests

#### ConversationContinuationManager.test.ts
Tests the core conversation continuation logic:

- **shouldContinueConversation**: Validates when conversations should continue based on command results
- **prepareConversationContext**: Tests context extraction and preparation
- **generateContinuationPrompt**: Validates prompt generation for different command types
- **createConversationRequest**: Tests request object creation

**Coverage Areas:**
- Success and failure scenarios
- Different command types (new, review, chat, etc.)
- Edge cases (empty context, missing fields)
- Error handling

### Integration Tests

#### CommandConversationFlow.test.ts
Tests the complete flow from command execution to conversation start:

- **New Command Flow**: Document creation to conversation continuation
- **Review Command Flow**: Document review to follow-up conversation
- **Chat Command Flow**: Chat interaction continuation
- **Error Handling**: Command failures and conversation start failures
- **Context Preparation**: Proper context passing between components

**Coverage Areas:**
- All command types with conversation continuation
- Success and failure paths
- Conversation context preservation
- Error recovery scenarios

#### ConversationErrorHandling.test.ts
Tests error handling and recovery mechanisms:

- **ConversationRecoveryManager**: Error categorization and recovery options
- **ConversationFlowHandler**: Conversation start error handling
- **Retry Logic**: Automatic retry for transient failures
- **Recovery Options**: User-facing recovery suggestions

**Coverage Areas:**
- Network errors, authentication errors, rate limits
- Transient vs permanent error classification
- Retry delays and exponential backoff
- User guidance and recovery instructions

#### OnlineOfflineConversation.test.ts
Tests conversation continuation in different connectivity modes:

- **Online Mode**: Normal conversation continuation
- **Offline Mode**: Offline guidance provision
- **Mode Transitions**: Handling connectivity changes
- **Context Preservation**: Maintaining context across modes

**Coverage Areas:**
- Online conversation start success/failure
- Offline guidance for different commands
- Mode transition scenarios
- Context preservation and recovery

## Test Scenarios

### 1. Command Result Evaluation
```typescript
// Test that commands properly set shouldContinueConversation flag
const result = await handleNewCommand(parsedCommand, context);
expect(result.shouldContinueConversation).toBe(true);
expect(result.conversationContext).toBeDefined();
```

### 2. Conversation Context Preparation
```typescript
// Test context extraction and validation
const context = manager.prepareConversationContext(commandResult);
expect(context.command).toBe('new');
expect(context.title).toBe('Test Document');
```

### 3. Prompt Generation
```typescript
// Test appropriate prompt generation for different commands
const prompt = manager.generateContinuationPrompt(context);
expect(prompt).toContain('Test Document');
expect(prompt).toContain('created successfully');
```

### 4. Error Recovery
```typescript
// Test error categorization and recovery options
const options = recoveryManager.getRecoveryOptions(networkError);
expect(options).toContain('Check your internet connection');
```

### 5. Offline Mode Handling
```typescript
// Test offline guidance provision
await flowHandler.handleOfflineMode(context, streamContext);
expect(mockStream.markdown).toHaveBeenCalledWith(
  expect.stringContaining('offline')
);
```

## Running Tests

### All Conversation Flow Tests
```bash
npm test -- --testPathPattern="conversation"
```

### Specific Test Suites
```bash
# Unit tests only
npm test -- src/test/unit/ConversationContinuationManager.test.ts

# Integration tests only
npm test -- --testPathPattern="integration.*Conversation"

# Error handling tests
npm test -- --testNamePattern="Error"

# Online/Offline tests
npm test -- --testNamePattern="Online.*Offline"
```

### With Coverage
```bash
npm run test:coverage -- --testPathPattern="conversation"
```

## Coverage Requirements

### Minimum Coverage Targets
- **ConversationContinuationManager**: 95% function coverage, 90% line coverage
- **ConversationRecoveryManager**: 90% function coverage, 85% line coverage
- **ConversationFlowHandler**: 90% function coverage, 85% line coverage
- **Command Handlers**: 80% coverage for conversation-related code paths

### Critical Paths
1. Command result evaluation for conversation continuation
2. Conversation context preparation and validation
3. Error handling and recovery option generation
4. Online/offline mode handling
5. Retry logic for transient failures

## Test Data and Mocks

### Mock Command Results
```typescript
const successfulNewCommand: CommandResult = {
  success: true,
  shouldContinueConversation: true,
  conversationContext: {
    command: 'new',
    title: 'Test Document',
    template: 'prd'
  }
};

const failedCommand: CommandResult = {
  success: false,
  error: 'Validation failed',
  shouldContinueConversation: false
};
```

### Mock Error Scenarios
```typescript
const networkError = new Error('Network timeout');
const authError = new Error('Authentication failed');
const rateLimitError = new Error('Rate limit exceeded');
```

### Mock Context Objects
```typescript
const mockContext = {
  stream: mockStream,
  request: { command: '', prompt: '' },
  workspaceRoot: '/test/workspace',
  extensionContext: {} as vscode.ExtensionContext,
  token: {} as vscode.CancellationToken
};
```

## Validation Criteria

### Functional Requirements
- ✅ Commands properly set conversation continuation flags
- ✅ Conversation context is correctly prepared and passed
- ✅ Appropriate prompts are generated for different commands
- ✅ Error handling provides useful recovery options
- ✅ Offline mode provides command-specific guidance

### Non-Functional Requirements
- ✅ Tests run in under 10 seconds total
- ✅ No external dependencies or network calls in tests
- ✅ Proper mocking of VS Code APIs and external services
- ✅ Clear test descriptions and assertions
- ✅ Comprehensive error scenario coverage

### Integration Requirements
- ✅ End-to-end flow from command to conversation works
- ✅ Error recovery flows are properly tested
- ✅ Mode transitions are handled correctly
- ✅ Context preservation across components is validated

## Debugging and Troubleshooting

### Common Test Failures
1. **Mock not properly configured**: Ensure all dependencies are mocked
2. **Async/await issues**: Use proper async/await in test functions
3. **Context not preserved**: Verify context passing between components
4. **Error not properly categorized**: Check error message matching logic

### Debug Commands
```bash
# Run single test with debug output
npm test -- --testNamePattern="specific test" --verbose

# Run with coverage and debug
npm run test:coverage -- --testPathPattern="conversation" --verbose

# Run specific file with watch mode
npm test -- --watch src/test/unit/ConversationContinuationManager.test.ts
```

### Test Environment Setup
Ensure the following are properly configured:
- Jest configuration includes conversation test files
- VS Code API mocks are available
- Test setup file initializes required mocks
- TypeScript compilation includes test files

## Maintenance

### Adding New Tests
1. Follow existing naming conventions
2. Include both success and failure scenarios
3. Mock all external dependencies
4. Add appropriate assertions and error messages
5. Update this documentation with new test scenarios

### Updating Existing Tests
1. Maintain backward compatibility where possible
2. Update test descriptions to reflect changes
3. Ensure coverage requirements are still met
4. Validate that all scenarios are still covered

### Performance Considerations
- Keep test execution time under 10 seconds total
- Use efficient mocking strategies
- Avoid unnecessary async operations in tests
- Group related tests in describe blocks for better organization