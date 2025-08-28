# Design Document

## Overview

The VSCode extension is failing on commands like "Create Templates" and "Create Document" due to overly restrictive workspace validation in the `BaseTool` class. The current implementation requires a workspace to be open for ALL tool operations, including those that should work without a workspace (like listing built-in templates). This design addresses the workspace detection issues by implementing selective workspace validation and improving error handling for workspace-dependent operations.

## Architecture

### Current Problem Analysis
- **Root Cause**: `BaseTool.run()` method calls `securityManager.validateWorkspaceState()` for ALL tools
- **Impact**: Commands that should work without workspace (like listing built-in templates) fail unnecessarily
- **Error Flow**: `SecurityManager.validateWorkspaceState()` → returns `"No workspace folder is open"` → `BaseTool` returns error result

### Proposed Solution Architecture
- **Selective Workspace Validation**: Tools declare whether they require workspace access
- **Graceful Degradation**: Tools that can work without workspace provide limited functionality
- **Enhanced Error Messages**: Clear guidance when workspace is actually required
- **Workspace Detection Improvements**: Better handling of edge cases and multi-root workspaces

## Components and Interfaces

### Enhanced BaseTool Interface
```typescript
interface ToolRequirements {
  requiresWorkspace: boolean;
  requiresFileSystem: boolean;
  workspaceOptional?: boolean; // Can work with limited functionality
}

abstract class BaseTool {
  protected abstract getRequirements(): ToolRequirements;
  
  async run(params: any, context: ToolContext): Promise<ToolResult> {
    const requirements = this.getRequirements();
    
    if (requirements.requiresWorkspace) {
      const workspaceValidation = await this.securityManager.validateWorkspaceState();
      if (!workspaceValidation.valid) {
        return this.createWorkspaceErrorResult(workspaceValidation.error!);
      }
    }
    
    return await this.execute(params, context);
  }
}
```

### Tool Classification
```typescript
// Tools that should work WITHOUT workspace
const WORKSPACE_INDEPENDENT_TOOLS = [
  'listTemplates',    // Can list built-in templates
  'validateTemplate', // Can validate template syntax
  'help'             // General help
];

// Tools that require workspace but can provide guidance
const WORKSPACE_DEPENDENT_TOOLS = [
  'applyTemplate',   // Needs workspace to write files
  'writeFile',       // Needs workspace for file operations
  'readFile',        // Needs workspace context
  'openInEditor'     // Needs workspace to open files
];

// Tools that can work with limited functionality
const WORKSPACE_OPTIONAL_TOOLS = [
  'listTemplates'    // Can show built-in + user templates when workspace available
];
```

### Enhanced SecurityManager Interface
```typescript
interface WorkspaceDetectionResult {
  hasWorkspace: boolean;
  workspaceFolders: readonly vscode.WorkspaceFolder[];
  primaryWorkspace?: vscode.WorkspaceFolder;
  isMultiRoot: boolean;
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };
}

class SecurityManager {
  async detectWorkspaceState(): Promise<WorkspaceDetectionResult> {
    // Enhanced workspace detection logic
  }
  
  async validateWorkspaceState(): Promise<SecurityValidationResult> {
    // Existing validation for tools that require workspace
  }
}
```

## Data Models

### Tool Requirements Model
```typescript
interface ToolRequirements {
  requiresWorkspace: boolean;      // Must have workspace to function
  requiresFileSystem: boolean;     // Needs file system access
  workspaceOptional?: boolean;     // Can provide limited functionality without workspace
  gracefulDegradation?: {
    withoutWorkspace: string[];    // Features available without workspace
    withWorkspace: string[];       // Additional features with workspace
  };
}
```

### Enhanced Error Response Model
```typescript
interface WorkspaceErrorResult extends ToolResult {
  success: false;
  error: string;
  errorType: 'workspace-required' | 'workspace-permissions' | 'workspace-invalid';
  guidance: {
    action: string;                // What user should do
    alternatives?: string[];       // Alternative approaches
    helpCommand?: string;          // Command to get more help
  };
}
```

## Error Handling

### Workspace Error Categories
1. **No Workspace Open**: User hasn't opened a folder/workspace
2. **Insufficient Permissions**: Workspace exists but lacks write permissions
3. **Multi-root Complexity**: Multiple workspace folders causing confusion
4. **Invalid Workspace**: Workspace folder doesn't exist or is inaccessible

### Error Response Strategy
```typescript
class WorkspaceErrorHandler {
  createWorkspaceGuidance(errorType: string, toolName: string): WorkspaceErrorResult {
    switch (errorType) {
      case 'no-workspace':
        return {
          success: false,
          error: 'This command requires a workspace folder to be open',
          errorType: 'workspace-required',
          guidance: {
            action: 'Open a folder or workspace in VS Code',
            alternatives: [
              'Use File → Open Folder to open a project',
              'Use File → Open Workspace to open a saved workspace'
            ],
            helpCommand: '/help workspace'
          }
        };
      
      case 'permissions':
        return {
          success: false,
          error: 'Insufficient permissions to write to workspace',
          errorType: 'workspace-permissions',
          guidance: {
            action: 'Check folder permissions and try again',
            alternatives: [
              'Run VS Code as administrator (if needed)',
              'Choose a different folder with write permissions'
            ]
          }
        };
    }
  }
}
```

## Testing Strategy

### Workspace Scenarios to Test
1. **No Workspace Open**: Extension starts without any folder open
2. **Single Folder Workspace**: Standard single project folder
3. **Multi-root Workspace**: Workspace with multiple folders
4. **Read-only Workspace**: Folder with restricted permissions
5. **Invalid Workspace**: Workspace folder that no longer exists

### Tool Testing Matrix
```typescript
interface ToolTestScenario {
  toolName: string;
  workspaceState: 'none' | 'single' | 'multi' | 'readonly' | 'invalid';
  expectedBehavior: 'success' | 'error' | 'limited-functionality';
  expectedMessage?: string;
}

const TEST_SCENARIOS: ToolTestScenario[] = [
  {
    toolName: 'listTemplates',
    workspaceState: 'none',
    expectedBehavior: 'limited-functionality', // Shows built-in templates only
  },
  {
    toolName: 'listTemplates',
    workspaceState: 'single',
    expectedBehavior: 'success', // Shows built-in + user templates
  },
  {
    toolName: 'applyTemplate',
    workspaceState: 'none',
    expectedBehavior: 'error',
    expectedMessage: 'This command requires a workspace folder to be open'
  },
  {
    toolName: 'applyTemplate',
    workspaceState: 'readonly',
    expectedBehavior: 'error',
    expectedMessage: 'Insufficient permissions to write to workspace'
  }
];
```

## Implementation Phases

### Phase 1: Tool Requirements Classification
- Add `getRequirements()` method to `BaseTool` abstract class
- Classify all existing tools by workspace requirements
- Update tool implementations to declare their requirements
- Create workspace-independent tool base class if needed

### Phase 2: Enhanced Workspace Detection
- Improve `SecurityManager.detectWorkspaceState()` method
- Add better multi-root workspace handling
- Implement permission checking improvements
- Add workspace state caching for performance

### Phase 3: Selective Validation Implementation
- Modify `BaseTool.run()` to use selective workspace validation
- Implement graceful degradation for workspace-optional tools
- Update error handling to provide better guidance
- Add workspace error result types

### Phase 4: Tool-Specific Improvements
- Update `ListTemplatesTool` to work without workspace
- Enhance `ApplyTemplateTool` error messages
- Improve other workspace-dependent tools
- Add fallback behaviors where appropriate

### Phase 5: Testing and Validation
- Create comprehensive test suite for all workspace scenarios
- Test all @docu commands in different workspace states
- Validate error messages and guidance
- Performance testing for workspace detection

## Command-Specific Solutions

### "Create Templates" Command Fix
- **Root Issue**: `ListTemplatesTool` requires workspace validation
- **Solution**: Make `listTemplates` workspace-optional
- **Behavior**: Show built-in templates without workspace, add user templates when workspace available
- **Error Handling**: No error when no workspace, just show available built-in templates

### "Create Document" Command Fix  
- **Root Issue**: `ApplyTemplateTool` fails workspace validation
- **Solution**: Provide clear guidance when workspace is missing
- **Behavior**: Clear error message with actionable steps
- **Error Handling**: Enhanced error message explaining how to open workspace

### All @docu Commands Validation
- **Approach**: Systematic review of all command handlers
- **Classification**: Categorize each command by workspace requirements
- **Testing**: Validate each command in no-workspace scenario
- **Documentation**: Update help text to indicate workspace requirements