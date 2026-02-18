# Testing Guide

This document is the single source of truth for all testing information for the Docu VS Code extension.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file change)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Jest Configuration

`jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  },
  testTimeout: 10000,
  verbose: true
};
```

Tests use a dedicated `tsconfig.test.json` that extends the root config with `rootDir: "."` so both `src/` and `tests/` compile together.

## Test Structure

```
tests/
├── setup.ts                    # Global Jest setup — VS Code API mock
├── testUtils.ts                # Shared test factory helpers
├── unit/                       # Unit tests (isolated, no VS Code runtime)
│   ├── agents/
│   │   ├── AgentManager.test.ts
│   │   ├── BaseAgent.test.ts
│   │   └── PRDCreatorAgent.test.ts
│   ├── commands/
│   │   ├── CommandParser.test.ts
│   │   └── CommandRouter.test.ts
│   ├── config/
│   │   └── ConfigurationManager.test.ts
│   ├── conversation/
│   │   ├── ConversationManager.test.ts
│   │   └── WorkflowOrchestrator.test.ts
│   ├── error/
│   │   └── ErrorHandler.test.ts
│   ├── llm/
│   │   └── LLMService.test.ts
│   ├── offline/
│   │   └── OfflineManager.test.ts
│   ├── security/
│   │   └── SecurityManager.test.ts
│   ├── state/
│   │   └── StateManager.test.ts
│   └── utils/
│       └── ValidationUtils.test.ts
├── integration/                # Integration tests (require VS Code runtime)
│   └── ExtensionActivation.test.ts
├── conversation/               # Conversation module tests
├── fixes/                      # Regression / bug-fix tests
├── validation/                 # Validation utility tests
├── mocks/                      # Mock implementations (vscode, VSCodeAPIMocks)
└── utils/                      # Test utilities and helpers
```

### Test File Naming (enforced)

All test files **must** end with `.test.ts` or `.spec.ts`.

## Writing Tests

### Unit Test Template

```typescript
import { MyClass } from '../../src/path/MyClass';

// Access the VS Code mock (defined in tests/setup.ts)
const vscode = require('vscode');

describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    jest.clearAllMocks();
    instance = new MyClass();
  });

  it('should do something', () => {
    const result = instance.doSomething('input');
    expect(result).toBe('expected');
  });
});
```

### Mock Objects

```typescript
const mockContext = createMockExtensionContext();
const mockToken  = createMockCancellationToken();
const mockStream = createMockChatResponseStream();
const mockRequest = createMockChatRequest('/templates list');
```

### Test Data Generators

```typescript
const template = TestData.createSampleTemplate('my-template');
const agent    = TestData.createSampleAgent('test-agent');
const error    = TestData.createSampleError('Test error message');
```

### Custom Assertions

```typescript
TestAssertions.assertResult(result, true);
TestAssertions.assertHasProperties(obj, ['id', 'name', 'description']);
TestAssertions.assertValidTemplate(template);
```

### Mocking VS Code APIs

The global VS Code mock is configured in `tests/setup.ts`. All `vscode.*` calls are mocked automatically. Override per test:

```typescript
const vscode = require('vscode');

it('should handle model selection', async () => {
  const mockModel = { id: 'gpt-4o', name: 'GPT-4o', sendRequest: jest.fn() };
  vscode.lm.selectChatModels.mockResolvedValueOnce([mockModel]);

  const result = await myService.selectModel();
  expect(result).toBe(mockModel);
});
```

### Testing Chat Participants

```typescript
it('should respond to @docu commands', async () => {
  const mockRequest = {
    prompt: '/help',
    command: 'help',
    model: { id: 'gpt-4o' },
  };
  const mockStream = { markdown: jest.fn(), progress: jest.fn() };
  const mockToken  = { isCancellationRequested: false };

  const result = await handleChatRequest(mockRequest, {}, mockStream, mockToken);
  expect(mockStream.markdown).toHaveBeenCalled();
  expect(result).not.toHaveProperty('errorDetails');
});
```

## Coverage

### Target

**60% overall coverage** for new code. Run:

```bash
npm run test:coverage
```

Coverage reports are output to `coverage/` (excluded from git). Open `coverage/lcov-report/index.html` in a browser for the full report.

### Per-Module Coverage Requirements

| Module | Coverage Areas |
|--------|---------------|
| **TemplateManager** | Loading, rendering, validation, agent-specific filtering |
| **SecurityManager** | Path validation, directory traversal prevention, input sanitization |
| **ErrorHandler** | Error categorization, severity assignment, recovery options, history |
| **OfflineManager** | Online/offline detection, capability management, fallback responses |
| **CommandRouter** | Parsing, routing, parameter extraction, flag processing |
| **ToolManager** | Registration, execution, error handling, documentation generation |

### Integration Test Coverage

- **Agent Workflows**: Complete PRD → Requirements → Design → Tasks workflows
- **Template System**: Template management with agent integration
- **Command Processing**: End-to-end command execution with tool coordination
- **Error Recovery**: Cross-component error handling and recovery workflows

## CI

Tests run automatically on every push and pull request via [GitHub Actions](../.github/workflows/ci.yml):

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run compile
      - run: npm run lint
      - run: npm run test:coverage
```

## Performance Benchmarks

| Operation | Target |
|-----------|--------|
| Template rendering (complex) | < 100 ms |
| Command parsing (complex) | < 10 ms |
| Tool execution (file ops) | < 500 ms |
| Agent switching | < 50 ms |
| Extension activation memory | < 50 MB |
| Template cache memory | < 10 MB |
| Error history memory | < 5 MB (100-error limit) |

## Manual Testing Scenarios

### Extension Activation

1. Open a workspace
2. Open GitHub Copilot Chat
3. Type `@docu /help`
4. Verify response lists all available commands

### Template Workflow

1. `@docu /templates list` — verify templates appear
2. `@docu /new "Test PRD" --template prd` — verify PRD file created
3. Open the created file — verify content is correct

### Agent Workflow

1. `@docu /agent set brainstormer` — verify agent switches
2. Ask a brainstorming question — verify LLM-powered response
3. `@docu /agent status` — verify current agent shown

### Error Handling

1. `@docu /new ""` (empty title) — verify graceful error message
2. Disconnect from internet — verify offline mode message
3. Enter invalid template name — verify helpful error with alternatives

## VS Code Debug Configuration

```json
{
  "name": "Extension Tests",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}",
    "--extensionTestsPath=${workspaceFolder}/out-test/tests/e2e"
  ]
}
```

## Troubleshooting

**`Cannot find module 'vscode'`** — The global mock in `tests/setup.ts` provides the `vscode` module. Ensure `jest.config.js` includes `setupFilesAfterEnv: ['./tests/setup.ts']`.

**`TypeError: vscode.chat is not a function`** — Add the missing mock to `tests/setup.ts` under the `chat` namespace.

**Tests pass locally but fail in CI** — Check that no test relies on a local file path or environment variable. Use `process.env.NODE_ENV === 'test'` guards where needed.
