# Technology Stack

## Core Technologies

- **TypeScript**: Primary language for all source code
- **Node.js**: Runtime environment (version 20.x)
- **VS Code Extension API**: Core platform integration (requires VS Code 1.97.0+)
- **GitHub Copilot Chat API**: AI integration for chat participants and language models

## Dependencies

### Runtime Dependencies
- `js-yaml`: YAML parsing for configuration and templates
- `vscode`: VS Code extension API

### Development Dependencies
- **Testing**: Jest with ts-jest preset
- **Linting**: ESLint with TypeScript plugin
- **Build**: TypeScript compiler
- **Packaging**: @vscode/vsce for extension packaging

## Build System

### Common Commands

```bash
# Development
npm run compile          # Compile TypeScript
npm run watch           # Watch mode compilation
npm run lint            # Run ESLint

# Testing
npm test                # Run Jest tests
npm run test:watch      # Watch mode testing
npm run test:coverage   # Generate coverage report
npm run test:vscode     # Run VS Code integration tests

# Packaging & Publishing
npm run package         # Create VSIX package
npm run publish         # Publish to marketplace
npm run vscode:prepublish # Pre-publish compilation
```

### Build Configuration

- **TypeScript**: ES2022 target, Node16 modules, strict mode enabled
- **Output**: Compiled to `out/` directory
- **Source Maps**: Enabled for debugging
- **Entry Point**: `src/extension.ts` → `out/extension.js`

## Code Quality Standards

### ESLint Rules
- TypeScript naming conventions (camelCase/PascalCase for imports)
- Curly braces required
- Strict equality (`===`)
- No throw literals
- Semicolons required

### Testing Standards
- Jest framework with TypeScript support
- 10-second test timeout
- Coverage collection from `src/**/*.ts` (excluding test files)
- Setup file: `src/test/setup.ts`