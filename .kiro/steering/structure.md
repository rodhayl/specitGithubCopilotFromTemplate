# Project Structure

## Root Directory Layout

```
├── src/                    # Source code
├── out/                    # Compiled JavaScript (generated)
├── docs/                   # Documentation
├── examples/               # Example workflows and demo projects
├── .vscode/               # VS Code workspace settings
├── .kiro/                 # Kiro steering rules
├── package.json           # Extension manifest and dependencies
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest testing configuration
├── eslint.config.mjs      # ESLint configuration
└── icon.png              # Extension icon
```

## Source Code Organization (`src/`)

### Core Architecture Modules

- **`extension.ts`**: Main entry point, extension activation/deactivation
- **`agents/`**: AI agent implementations and management
- **`commands/`**: Command parsing, routing, and implementations
- **`config/`**: Configuration management and settings UI
- **`conversation/`**: Chat interaction and workflow orchestration
- **`llm/`**: Language model service and prompt building
- **`templates/`**: Template system and management
- **`tools/`**: File operations and workspace tools

### Supporting Modules

- **`debugging/`**: Debug utilities and diagnostics
- **`error/`**: Error handling and recovery
- **`logging/`**: Structured logging system
- **`offline/`**: Offline mode and fallback handling
- **`security/`**: Security validation and workspace isolation
- **`telemetry/`**: Usage analytics and performance tracking
- **`test/`**: Test suites (unit, integration, e2e)

## Architectural Patterns

### Manager Pattern
Core functionality organized around manager classes:
- `AgentManager`: Handles AI agent lifecycle and switching
- `TemplateManager`: Manages document templates
- `ToolManager`: Coordinates file operations
- `ConfigurationManager`: Handles extension settings
- `ConversationManager`: Orchestrates chat workflows

### Command Pattern
- `CommandRouter`: Routes slash commands to handlers
- `CommandParser`: Parses command syntax and flags
- Individual command implementations with consistent interface

### Tool Pattern
- `BaseTool`: Abstract base for all workspace operations
- Specific tools: `ApplyTemplateTool`, `WriteFileTool`, `ReadFileTool`, etc.
- `ToolManager`: Coordinates tool execution with proper context

### Agent Pattern
- `BaseAgent`: Abstract base for all AI agents
- Specialized agents for different workflow phases
- Agent switching and context management

## File Naming Conventions

- **Classes**: PascalCase (e.g., `AgentManager.ts`, `BaseAgent.ts`)
- **Interfaces/Types**: PascalCase with descriptive names
- **Utilities**: camelCase (e.g., `testUtils.ts`)
- **Tests**: `*.test.ts` or `*.spec.ts`
- **Index files**: `index.ts` for module exports

## Import/Export Patterns

- Use barrel exports (`index.ts`) for clean module interfaces
- Prefer named exports over default exports
- Import VS Code API as `import * as vscode from 'vscode'`
- Group imports: external dependencies, then internal modules

## Testing Structure

```
src/test/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests across modules
├── e2e/           # End-to-end workflow tests
├── mocks/         # Mock implementations
├── utils/         # Test utilities and helpers
└── setup.ts       # Jest setup configuration
```

## Configuration Files

- **Extension Settings**: Defined in `package.json` contributes.configuration
- **User Templates**: `.vscode/docu/templates/`
- **Agent Configs**: `.vscode/docu/`
- **Workspace Isolation**: All operations restricted to workspace root