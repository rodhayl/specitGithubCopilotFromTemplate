# Design Document

## Overview

This design document outlines the technical architecture for a VS Code extension that integrates with GitHub Copilot Chat through the Chat Participant API. The extension implements a Kiro-inspired workflow for business requirements gathering, starting with PRD creation and progressing through structured requirements, design, and implementation phases.

## Architecture

### Core Components

The extension follows VS Code's extension architecture patterns with these key components:

1. **Extension Host** - Main extension entry point (`extension.ts`)
2. **Chat Participant** - Registered with VS Code's Chat API (`vscode.chat.createChatParticipant`)
3. **Agent System** - Specialized AI agents with unique prompts and behaviors
4. **Tool System** - File system operations and document manipulation tools
5. **Template Engine** - Document template processing and rendering
6. **Configuration Manager** - VS Code settings integration

### VS Code Integration Points

#### Chat Participant Registration
```typescript
// Extension activation
export function activate(context: vscode.ExtensionContext) {
    const participant = vscode.chat.createChatParticipant('docu', handler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
    participant.followupProvider = {
        provideFollowups: (result, context, token) => {
            // Provide contextual follow-up suggestions
        }
    };
}
```

#### Language Model API Integration
```typescript
// Access to Copilot models
const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4'
});
const chatRequest = models[0].sendRequest(messages, {}, token);
```#
# Components and Interfaces

### Chat Handler Flow

The main chat handler processes user requests through this flow:

1. **Request Parsing** - Parse slash commands and extract parameters
2. **Agent Selection** - Determine which agent should handle the request
3. **Context Building** - Gather relevant workspace context and previous outputs
4. **LLM Interaction** - Send structured prompts to Copilot models
5. **Tool Execution** - Execute file system operations based on LLM responses
6. **Response Formatting** - Format results with clickable links and summaries

### Agent System Architecture

#### Agent Interface
```typescript
interface Agent {
    name: string;
    systemPrompt: string;
    allowedTools: string[];
    workflowPhase: 'prd' | 'requirements' | 'design' | 'implementation';
    handleRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse>;
}
```

#### Agent Implementations

**PRD Creator Agent**
- **Purpose**: Initial product concept exploration and PRD generation
- **System Prompt**: Focuses on strategic questions about goals, users, scope, and constraints
- **Tools**: writeFile, applyTemplate, openInEditor
- **Output**: Structured PRD.txt with executive summary, objectives, personas, success criteria

**Brainstormer Agent**
- **Purpose**: Ideation and concept exploration based on PRD context
- **System Prompt**: Open-ended conversation with clarifying questions
- **Tools**: readFile, writeFile, insertSection
- **Output**: Expanded ideas and concepts for requirements gathering

**Requirements Gatherer Agent**
- **Purpose**: Systematic collection and structuring of business requirements
- **System Prompt**: EARS format requirements with user stories and acceptance criteria
- **Tools**: readFile, writeFile, insertSection, applyTemplate
- **Output**: Structured requirements.md following EARS methodology

**Solution Architect Agent**
- **Purpose**: Technical solution design and system architecture
- **System Prompt**: Focus on technical decisions, trade-offs, and architecture patterns
- **Tools**: readFile, writeFile, insertSection, applyTemplate
- **Output**: design.md with architecture diagrams and technical specifications

**Specification Writer Agent**
- **Purpose**: Detailed technical specifications and implementation plans
- **System Prompt**: Create actionable implementation tasks and specifications
- **Tools**: readFile, writeFile, insertSection, listFiles
- **Output**: tasks.md with implementation checklist and technical details

**Quality Reviewer Agent**
- **Purpose**: Validation and improvement of all document types
- **System Prompt**: Strict review criteria with concrete improvement suggestions
- **Tools**: readFile, writeFile, insertSection
- **Output**: Review reports and corrected documents### Tool S
ystem

#### Tool Interface
```typescript
interface Tool {
    name: string;
    description: string;
    parameters: ToolParameter[];
    execute(params: any, context: ToolContext): Promise<ToolResult>;
}
```

#### Core Tools

**readFile Tool**
- **Purpose**: Read file contents with error handling
- **Parameters**: `{ path: string }`
- **Security**: Validates path is within workspace
- **Output**: `{ content: string, metadata: FileMetadata }`

**writeFile Tool**
- **Purpose**: Write file with directory creation and conflict detection
- **Parameters**: `{ path: string, content: string, createIfMissing?: boolean, overwrite?: boolean }`
- **Security**: Workspace boundary validation, backup on overwrite
- **Output**: `{ path: string, bytes: number, created: boolean }`

**insertSection Tool**
- **Purpose**: Update specific sections in Markdown documents
- **Parameters**: `{ path: string, header: string, mode: 'replace'|'append'|'prepend', content: string }`
- **Logic**: Parse Markdown headers, locate section, apply changes
- **Output**: `{ changed: boolean, diff: string }`

**applyTemplate Tool**
- **Purpose**: Process templates with variable substitution
- **Parameters**: `{ id: string, vars: Record<string, string> }`
- **Logic**: Load template, substitute {{variables}}, handle front-matter
- **Output**: `{ rendered: string, template: TemplateMetadata }`

**listFiles Tool**
- **Purpose**: List files with glob pattern support
- **Parameters**: `{ dir?: string, glob?: string }`
- **Logic**: Use workspace.findFiles with pattern matching
- **Output**: `Array<{ path: string, size: number, mtime: number }>`

**openInEditor Tool**
- **Purpose**: Open files in VS Code editor
- **Parameters**: `{ path: string, preview?: boolean }`
- **Logic**: Use vscode.window.showTextDocument
- **Output**: `{ opened: boolean, viewColumn: number }`

## Data Models

### Workflow State
```typescript
interface WorkflowState {
    projectId: string;
    currentPhase: 'prd' | 'requirements' | 'design' | 'implementation';
    activeAgent: string;
    documents: {
        prd?: string;
        requirements?: string;
        design?: string;
        tasks?: string;
    };
    context: Record<string, any>;
    history: WorkflowEvent[];
}
```

### Agent Context
```typescript
interface AgentContext {
    workspaceRoot: string;
    currentDocument?: string;
    previousOutputs: string[];
    userPreferences: UserPreferences;
    workflowState: WorkflowState;
}
```

### Template System
```typescript
interface Template {
    id: string;
    name: string;
    description: string;
    content: string;
    variables: TemplateVariable[];
    frontMatter: Record<string, any>;
    agentRestrictions?: string[];
}
```## E
rror Handling

### Security Boundaries
- **Path Validation**: All file operations validate paths are within workspace using `vscode.workspace.asRelativePath`
- **Tool Restrictions**: Agents can only access tools specified in their configuration
- **Content Sanitization**: User inputs are sanitized before LLM processing

### Error Recovery Patterns
- **File Not Found**: Suggest alternative paths or offer to create file
- **Permission Denied**: Clear error message with troubleshooting steps
- **LLM Failures**: Retry with simplified prompts, fallback to basic responses
- **Workspace Changes**: Detect file modifications, offer conflict resolution

### Graceful Degradation
- **Offline Mode**: Basic file operations continue without LLM features
- **Model Unavailable**: Clear messaging about Copilot requirements
- **Configuration Errors**: Use sensible defaults, warn about misconfigurations

## Testing Strategy

### Unit Tests
- **Agent Prompt Generation**: Verify correct system prompts for each agent
- **Tool Execution**: Mock file system operations, test parameter validation
- **Template Processing**: Test variable substitution and front-matter handling
- **Command Parsing**: Validate slash command parsing and parameter extraction

### Integration Tests
- **Chat Participant Registration**: Verify extension activates and registers participant
- **End-to-End Workflows**: Test complete PRD → Requirements → Design flow
- **File System Operations**: Test actual file creation, reading, and modification
- **VS Code Integration**: Test editor opening, settings reading, workspace detection

### Manual Testing Scenarios
- **New Project Flow**: Start with PRD Creator, progress through all phases
- **Existing Project**: Update existing documents, maintain consistency
- **Error Conditions**: Test various error scenarios and recovery paths
- **Configuration Changes**: Test agent switching, template customization

## Performance Considerations

### Async Operations
- All file system operations use VS Code's async APIs
- LLM requests are cancellable using CancellationToken
- Large file operations show progress indicators

### Memory Management
- Stream large file contents instead of loading entirely into memory
- Cache frequently accessed templates and configurations
- Clean up agent contexts after workflow completion

### User Experience
- Provide immediate feedback for user actions
- Show progress for long-running operations
- Enable cancellation of LLM requests
- Maintain responsive UI during file operations## Impl
ementation Flow

### Extension Activation Sequence
1. **Extension Loads** - VS Code calls `activate()` function
2. **Chat Participant Registration** - Register @docu with VS Code Chat API
3. **Configuration Loading** - Read user settings and agent configurations
4. **Template Discovery** - Load built-in and user-defined templates
5. **Tool Registration** - Initialize file system and editor tools
6. **Ready State** - Extension ready to handle chat requests

### Chat Request Processing Flow
1. **Request Reception** - VS Code Chat API calls participant handler
2. **Command Parsing** - Extract slash command and parameters
3. **Agent Resolution** - Determine which agent should handle request
4. **Context Building** - Gather workspace context, previous outputs
5. **LLM Prompt Construction** - Build agent-specific system prompt
6. **Model Selection** - Choose appropriate Copilot model
7. **LLM Request** - Send request with cancellation support
8. **Response Processing** - Parse LLM response for tool calls
9. **Tool Execution** - Execute requested file operations
10. **Result Formatting** - Format response with links and summaries
11. **Follow-up Suggestions** - Provide contextual next steps

### Workflow State Management
- **State Persistence** - Store workflow state in workspace settings
- **Phase Transitions** - Track progression through PRD → Requirements → Design → Tasks
- **Context Preservation** - Maintain agent context across requests
- **History Tracking** - Log workflow events for debugging and analytics

### Configuration System
- **VS Code Settings Integration** - Use standard VS Code configuration API
- **Agent Configuration Files** - Support JSON/YAML files for agent customization
- **Template Management** - Built-in templates with user override capability
- **Hot Reload** - Apply configuration changes without restart

### Security Model
- **Workspace Isolation** - All operations restricted to current workspace
- **Path Validation** - Prevent directory traversal attacks
- **Content Filtering** - Sanitize user inputs before LLM processing
- **Tool Restrictions** - Agents limited to configured tool subset
- **No External Calls** - Only use VS Code's internal Copilot integration

This design ensures the extension integrates seamlessly with VS Code and GitHub Copilot while providing a robust, secure, and user-friendly experience for business requirements gathering and documentation workflows.