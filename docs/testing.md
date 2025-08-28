# Testing Documentation

This document describes the comprehensive test suite for the Docu VS Code extension.

## Test Structure

The test suite is organized into three main categories:

### Unit Tests (`src/test/unit/`)
Tests individual components in isolation:

- **TemplateManager.test.ts** - Template loading, rendering, and validation
- **SecurityManager.test.ts** - Path validation, input sanitization, security checks
- **ErrorHandler.test.ts** - Error categorization, recovery options, history management
- **OfflineManager.test.ts** - Offline mode detection, capability management, fallback responses

### Integration Tests (`src/test/integration/`)
Tests component interactions and workflows:

- **CommandRouter.test.ts** - Command parsing, routing, parameter extraction
- **ToolManager.test.ts** - Tool registration, execution, error handling

### End-to-End Tests (`src/test/e2e/`)
Tests complete user workflows:

- **WorkflowTests.test.ts** - Complete PRD → Requirements → Design → Tasks workflows

## Running Tests

### Prerequisites
- VS Code with the extension development environment
- Node.js and npm installed
- Extension dependencies installed (`npm install`)

### Running All Tests
```bash
# From VS Code Command Palette
> Test: Run All Tests

# Or from terminal
npm test
```

### Running Specific Test Suites
```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only e2e tests
npm run test:e2e
```

### Running Individual Test Files
```bash
# Run specific test file
npx mocha out/test/unit/TemplateManager.test.js
```

## Test Coverage

### TemplateManager Tests
- ✅ Built-in template initialization
- ✅ Template retrieval by ID
- ✅ Template rendering with variables
- ✅ Variable validation and defaults
- ✅ Agent-specific template filtering
- ✅ Template metadata validation

### SecurityManager Tests
- ✅ Workspace path validation
- ✅ Directory traversal prevention
- ✅ Blocked directory access prevention
- ✅ File extension validation
- ✅ Input sanitization (XSS prevention)
- ✅ Security recommendations

### ErrorHandler Tests
- ✅ Error categorization by type
- ✅ Severity level assignment
- ✅ Recovery option generation
- ✅ Error history management
- ✅ Statistics and reporting

### OfflineManager Tests
- ✅ Online/offline mode detection
- ✅ Capability management
- ✅ Operation validation
- ✅ Fallback response generation
- ✅ Mode transitions

### CommandRouter Tests
- ✅ Command identification
- ✅ Command parsing (name, subcommands, flags, arguments)
- ✅ Quoted argument handling
- ✅ Boolean flag processing
- ✅ Short flag support
- ✅ Complex command parsing

### ToolManager Tests
- ✅ Tool registration and discovery
- ✅ Tool availability validation
- ✅ Tool execution with parameters
- ✅ Error handling and reporting
- ✅ Documentation generation

### Workflow Tests
- ✅ Complete PRD creation workflow
- ✅ Template management workflow
- ✅ Agent progression workflow
- ✅ Command processing workflow
- ✅ Error handling workflow
- ✅ Multi-agent collaboration

## Test Utilities

### Mock Objects
The test suite includes comprehensive mock objects for VS Code APIs:

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
Tests run in a VS Code extension host environment with:
- Mock workspace folders
- Mock file system operations
- Mock VS Code APIs
- Isolated extension context

### Mocking Strategy
- **File System**: Mock `vscode.workspace.fs` operations
- **UI Components**: Mock `vscode.window` dialogs and notifications
- **Language Models**: Mock `vscode.lm` API calls
- **Chat API**: Mock `vscode.chat` participant registration

## Test Data

### Sample Templates
Tests use predefined sample templates:
- Basic document template
- PRD template with complex variables
- Requirements template with EARS format
- Custom user-defined templates

### Sample Agents
Tests include mock agents for each workflow phase:
- PRD Creator (prd phase)
- Brainstormer (prd phase)
- Requirements Gatherer (requirements phase)
- Solution Architect (design phase)
- Specification Writer (implementation phase)
- Quality Reviewer (implementation phase)

### Error Scenarios
Tests cover various error conditions:
- File not found (ENOENT)
- Permission denied (EACCES)
- Network timeouts
- Model unavailability
- Invalid templates
- Workspace issues

## Continuous Integration

### GitHub Actions
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
- Coverage reports generated with `nyc`
- Test results in JUnit format
- Performance benchmarks for critical paths

## Manual Testing Scenarios

### Extension Activation
1. Install extension in VS Code
2. Open workspace folder
3. Verify chat participant registration
4. Test basic commands

### Template Workflow
1. List available templates: `/templates list`
2. Create new document: `/new "Test Doc" --template basic`
3. Validate template: `/templates validate basic`
4. Create custom template: `/templates create my-template --interactive`

### Agent Workflow
1. List agents: `/agent list`
2. Set agent: `/agent set prd-creator`
3. Progress through workflow phases
4. Verify agent-specific behavior

### Error Handling
1. Test invalid commands
2. Test missing files
3. Test permission issues
4. Verify recovery suggestions

## Performance Testing

### Benchmarks
- Template rendering: < 100ms for complex templates
- Command parsing: < 10ms for complex commands
- Tool execution: < 500ms for file operations
- Agent switching: < 50ms

### Memory Usage
- Extension activation: < 50MB
- Template cache: < 10MB
- Error history: < 5MB (with 100 error limit)

## Debugging Tests

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

### Test Debugging Tips
1. Use `console.log()` for debugging output
2. Set breakpoints in test files
3. Use VS Code's test explorer
4. Check extension host console for errors

## Test Maintenance

### Adding New Tests
1. Create test file in appropriate directory
2. Import test utilities
3. Follow existing test patterns
4. Update test documentation

### Updating Tests
1. Keep tests in sync with code changes
2. Update mock objects when APIs change
3. Maintain test data consistency
4. Review test coverage regularly

### Best Practices
- Test one thing per test case
- Use descriptive test names
- Keep tests independent
- Mock external dependencies
- Test both success and failure paths
- Include edge cases and boundary conditions

This comprehensive test suite ensures the Docu extension works reliably across all supported scenarios and provides confidence for future development and maintenance.