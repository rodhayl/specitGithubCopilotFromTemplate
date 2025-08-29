# Testing Documentation

This document consolidates ALL testing information for the Docu VS Code extension.

## Test Framework Configuration

### Jest Configuration (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/**/__tests__/**/*'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testTimeout: 10000,
  verbose: true
};
```

## Test Structure

### Directory Organization
```
src/test/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests across modules  
├── e2e/           # End-to-end workflow tests
├── mocks/         # Mock implementations
├── utils/         # Test utilities and helpers
└── setup.ts       # Jest setup configuration
```

### Test File Patterns (ENFORCED)
- Unit tests: `**/__tests__/**/*.test.ts`
- Spec tests: `**/?(*.)+(spec|test).ts`
- All test files MUST end with `.test.ts` or `.spec.ts`

## Running Tests

### Command Reference
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# VS Code integration tests
npm run test:vscode

# Specific test file
npx jest src/test/unit/TemplateManager.test.ts
```

## Test Coverage Requirements

### Unit Tests Coverage
- **TemplateManager**: Template loading, rendering, validation, agent-specific filtering
- **SecurityManager**: Path validation, directory traversal prevention, input sanitization
- **ErrorHandler**: Error categorization, severity assignment, recovery options, history management
- **OfflineManager**: Online/offline detection, capability management, fallback responses
- **CommandRouter**: Command parsing, routing, parameter extraction, flag processing
- **ToolManager**: Tool registration, execution, error handling, documentation generation

### Integration Tests Coverage
- **Agent Workflows**: Complete PRD → Requirements → Design → Tasks workflows
- **Template System**: Template management with agent integration
- **Command Processing**: End-to-end command execution with tool coordination
- **Error Recovery**: Cross-component error handling and recovery workflows

### End-to-End Tests Coverage
- **Complete User Workflows**: Full document creation and management flows
- **Multi-Agent Collaboration**: Agent switching and context preservation
- **Template Lifecycle**: Creation, validation, usage, and management
- **Command Workflows**: Complex command sequences with multiple tools

## Test Utilities and Mocks

### Mock Objects
```typescript
// Extension context
const mockContext = createMockExtensionContext();

// Cancellation token
const mockToken = createMockCancellationToken();

// Chat response stream
const mockStream = createMockChatResponseStream();

// Chat request
const mockRequest = createMockChatRequest('/templates list');
```

### Test Data Generators
```typescript
// Sample template
const template = TestData.createSampleTemplate('my-template');

// Sample agent
const agent = TestData.createSampleAgent('test-agent');

// Sample error
const error = TestData.createSampleError('Test error message');
```

### Custom Assertions
```typescript
// Assert result structure
TestAssertions.assertResult(result, true);

// Assert object properties
TestAssertions.assertHasProperties(obj, ['id', 'name', 'description']);

// Assert template validity
TestAssertions.assertValidTemplate(template);
```

## Test Environment Setup

### VS Code Test Environment
- Mock workspace folders
- Mock file system operations
- Mock VS Code APIs
- Isolated extension context

### Mocking Strategy
- **File System**: Mock `vscode.workspace.fs` operations
- **UI Components**: Mock `vscode.window` dialogs and notifications
- **Language Models**: Mock `vscode.lm` API calls
- **Chat API**: Mock `vscode.chat` participant registration

## Performance Benchmarks

### Required Performance Standards
- Template rendering: < 100ms for complex templates
- Command parsing: < 10ms for complex commands
- Tool execution: < 500ms for file operations
- Agent switching: < 50ms
- Extension activation: < 50MB memory usage

### Memory Usage Limits
- Extension activation: < 50MB
- Template cache: < 10MB
- Error history: < 5MB (with 100 error limit)

## Test Data and Scenarios

### Sample Templates
- Basic document template
- PRD template with complex variables
- Requirements template with EARS format
- Custom user-defined templates

### Sample Agents
- PRD Creator (prd phase)
- Brainstormer (prd phase)
- Requirements Gatherer (requirements phase)
- Solution Architect (design phase)
- Specification Writer (implementation phase)
- Quality Reviewer (implementation phase)

### Error Scenarios
- File not found (ENOENT)
- Permission denied (EACCES)
- Network timeouts
- Model unavailability
- Invalid templates
- Workspace issues

## Debugging and Maintenance

### VS Code Debug Configuration
```json
{
  "name": "Extension Tests",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}",
    "--extensionTestsPath=${workspaceFolder}/out/test"
  ]
}
```

### Test Maintenance Guidelines
- Keep tests in sync with code changes
- Update mock objects when APIs change
- Maintain test data consistency
- Review test coverage regularly
- Test one thing per test case
- Use descriptive test names
- Keep tests independent
- Mock external dependencies
- Test both success and failure paths
- Include edge cases and boundary conditions

## Continuous Integration

### GitHub Actions Configuration
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

### Test Reports
- Coverage reports generated with Jest
- Test results in standard format
- Performance benchmarks for critical paths

## Manual Testing Scenarios

### Extension Activation Flow
1. Install extension in VS Code
2. Open workspace folder
3. Verify chat participant registration
4. Test basic commands

### Template Workflow Testing
1. List available templates: `/templates list`
2. Create new document: `/new "Test Doc" --template basic`
3. Validate template: `/templates validate basic`
4. Create custom template: `/templates create my-template --interactive`

### Agent Workflow Testing
1. List agents: `/agent list`
2. Set agent: `/agent set prd-creator`
3. Progress through workflow phases
4. Verify agent-specific behavior

### Error Handling Testing
1. Test invalid commands
2. Test missing files
3. Test permission issues
4. Verify recovery suggestions

This document serves as the single source of truth for all testing information in the Docu extension project.