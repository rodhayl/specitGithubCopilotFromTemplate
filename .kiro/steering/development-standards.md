# Development Standards

## Technology Stack Enforcement

### Core Dependencies (MUST MAINTAIN)
- **TypeScript**: ^5.7.3 (ES2022 target, Node16 modules, strict mode)
- **Node.js**: 20.x runtime environment
- **VS Code Extension API**: ^1.97.0+ (core platform integration)
- **GitHub Copilot Chat API**: AI integration for chat participants

### Runtime Dependencies (LOCKED)
- `js-yaml`: ^4.1.0 (YAML parsing for configuration and templates)
- `vscode`: Extension API access

### Development Dependencies (LOCKED VERSIONS)
- **Testing**: Jest ^30.1.1 with ts-jest ^29.4.1 preset
- **Linting**: ESLint ^9.19.0 with @typescript-eslint/* ^8.22.0
- **Build**: TypeScript ^5.7.3 compiler
- **Packaging**: @vscode/vsce ^3.2.2 for extension packaging
- **VS Code Testing**: @vscode/test-cli ^0.0.10, @vscode/test-electron ^2.4.1

## Build System Standards

### Required Scripts (package.json)
```json
{
  "vscode:prepublish": "npm run compile",
  "compile": "tsc -p ./",
  "watch": "tsc -watch -p ./",
  "pretest": "npm run compile && npm run lint",
  "lint": "eslint src",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:vscode": "vscode-test",
  "package": "vsce package",
  "publish": "vsce publish"
}
```

### TypeScript Configuration (LOCKED)
- **Target**: ES2022
- **Module**: Node16
- **Output**: out/ directory
- **Source Maps**: Enabled
- **Strict Mode**: Enabled
- **Types**: ["jest", "node", "vscode"]

### ESLint Rules (ENFORCED)
- TypeScript naming conventions (camelCase/PascalCase for imports)
- Curly braces required
- Strict equality (===)
- No throw literals
- Semicolons required

## Testing Methodology (CONSOLIDATED)

### Single Testing Configuration File
ALL testing information MUST be consolidated into: `TESTING.md`

### Testing Framework (LOCKED)
- **Framework**: Jest with ts-jest preset
- **Environment**: Node.js
- **Timeout**: 10 seconds
- **Coverage**: Collect from src/**/*.ts (excluding test files)
- **Setup**: src/test/setup.ts

### Test Structure (ENFORCED)
```
src/test/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests across modules  
├── e2e/           # End-to-end workflow tests
├── mocks/         # Mock implementations
├── utils/         # Test utilities and helpers
└── setup.ts       # Jest setup configuration
```

### Test File Patterns (REQUIRED)
- Unit tests: `**/__tests__/**/*.test.ts`
- Spec tests: `**/?(*.)+(spec|test).ts`
- All test files MUST end with `.test.ts` or `.spec.ts`

## Development Tracking

### DEVELOPMENTS Folder Structure
- **Location**: `DEVELOPMENTS/` (root level)
- **Format**: One file per day: `DDMMYYYY.md`
- **Entry Format**: `DDMMYYYY-HH:MM Title of task Description of task`
- **Rule**: Only 1 paragraph per implementation/task (only if needed)

### Development Entry Guidelines
- **When to add**: Only for significant implementations or tasks
- **Format**: Date-time stamp + concise title + brief description
- **Length**: Maximum 1 paragraph per entry
- **Frequency**: As needed, not mandatory for every change

## Code Quality Standards (ENFORCED)

### Architecture Patterns (REQUIRED)
- **Manager Pattern**: Core functionality in manager classes
- **Command Pattern**: CommandRouter + CommandParser + handlers
- **Tool Pattern**: BaseTool abstract + specific implementations
- **Agent Pattern**: BaseAgent abstract + specialized agents

### File Naming (ENFORCED)
- **Classes**: PascalCase (AgentManager.ts, BaseAgent.ts)
- **Interfaces/Types**: PascalCase with descriptive names
- **Utilities**: camelCase (testUtils.ts)
- **Tests**: *.test.ts or *.spec.ts
- **Index files**: index.ts for module exports

### Import/Export Standards (REQUIRED)
- Use barrel exports (index.ts) for clean module interfaces
- Prefer named exports over default exports
- Import VS Code API as `import * as vscode from 'vscode'`
- Group imports: external dependencies, then internal modules

## Security & Performance Standards

### Workspace Isolation (ENFORCED)
- All operations restricted to workspace root
- Path validation through SecurityManager
- No access to system directories outside workspace

### Performance Benchmarks (MONITORED)
- Template rendering: < 100ms for complex templates
- Command parsing: < 10ms for complex commands
- Tool execution: < 500ms for file operations
- Agent switching: < 50ms
- Extension activation: < 50MB memory usage

## Dependency Management

### Version Lock Policy
- Major versions LOCKED for stability
- Minor/patch updates allowed for security
- All dependencies MUST be compatible with Node.js 20.x
- VS Code API compatibility MUST be maintained

### Prohibited Dependencies
- No additional testing frameworks (Jest only)
- No alternative build systems (TypeScript only)
- No runtime dependencies beyond js-yaml and vscode
- No UI frameworks (VS Code API only)

## Compliance Monitoring

When making changes, ALWAYS verify:
1. ✅ TypeScript compilation passes
2. ✅ ESLint rules pass
3. ✅ Jest tests pass
4. ✅ No new runtime dependencies added
5. ✅ Testing information consolidated in TESTING.md
6. ✅ Development entry added to DEVELOPMENTS/ if significant
7. ✅ Architecture patterns followed
8. ✅ Performance benchmarks maintained