# Tool Workspace Requirements Audit

This document classifies all tools based on their workspace requirements.

## Classification Categories

- **Workspace-Required**: Tool cannot function without a workspace folder
- **Workspace-Optional**: Tool can function with or without workspace, with graceful degradation
- **Workspace-Independent**: Tool functions completely independently of workspace

## Tool Classifications

### Workspace-Required Tools

These tools require a workspace folder to function properly:

1. **ApplyTemplateTool** (`requiresWorkspace: true`)
   - **Reason**: Creates files in workspace, needs workspace root for path resolution
   - **Functionality**: Template application and document creation
   - **Error Handling**: Enhanced workspace error messages with setup guidance

2. **WriteFileTool** (`requiresWorkspace: true`)
   - **Reason**: Writes files to workspace, requires workspace boundaries for security
   - **Functionality**: File creation and modification
   - **Error Handling**: Standard workspace validation

3. **ReadFileTool** (`requiresWorkspace: true`)
   - **Reason**: Reads files from workspace, needs workspace context for path resolution
   - **Functionality**: File content reading
   - **Error Handling**: Standard workspace validation

4. **OpenInEditorTool** (`requiresWorkspace: true`)
   - **Reason**: Opens files in editor, requires workspace context for proper file handling
   - **Functionality**: File opening in VS Code editor
   - **Error Handling**: Standard workspace validation

5. **ListFilesTool** (`requiresWorkspace: true`)
   - **Reason**: Lists files in workspace directories
   - **Functionality**: Directory and file listing with glob patterns
   - **Error Handling**: Standard workspace validation

6. **CreateTemplateTool** (`requiresWorkspace: true`)
   - **Reason**: Creates template files in workspace .vscode/docu/templates directory
   - **Functionality**: User template creation
   - **Error Handling**: Standard workspace validation

7. **InsertSectionTool** (`requiresWorkspace: true`)
   - **Reason**: Modifies files in workspace
   - **Functionality**: Markdown section insertion and updates
   - **Error Handling**: Standard workspace validation

### Workspace-Optional Tools

These tools can function with or without workspace, providing graceful degradation:

1. **ListTemplatesTool** (`requiresWorkspace: false`, `workspaceOptional: true`)
   - **Without Workspace**: Shows built-in templates only
   - **With Workspace**: Shows built-in + user templates
   - **Functionality**: Template listing and discovery
   - **Graceful Degradation**: ✅ Implemented

2. **OpenTemplateTool** (`requiresWorkspace: false`, `workspaceOptional: true`)
   - **Without Workspace**: Can open built-in templates for viewing
   - **With Workspace**: Can open built-in + user templates
   - **Functionality**: Template file opening in editor
   - **Graceful Degradation**: ✅ Implemented

3. **ValidateTemplateTool** (`requiresWorkspace: false`, `workspaceOptional: true`)
   - **Without Workspace**: Can validate built-in templates and content strings
   - **With Workspace**: Can validate built-in + user templates and files
   - **Functionality**: Template syntax and structure validation
   - **Graceful Degradation**: ✅ Implemented

### Workspace-Independent Tools

These tools function completely independently of workspace:

*Currently no tools are classified as completely workspace-independent, as all tools have some relationship to workspace context.*

## Recommendations

### Security Considerations
- All workspace-required tools use SecurityManager for path validation
- Workspace boundaries are enforced to prevent directory traversal
- File operations are restricted to allowed extensions and directories

### Error Handling
- Workspace-required tools provide enhanced error messages with actionable guidance
- Workspace-optional tools gracefully degrade functionality when workspace is unavailable
- All tools use WorkspaceErrorHandler for consistent error messaging

### Future Enhancements
1. Consider making ValidateTemplateTool fully workspace-independent for content validation
2. Add more workspace-optional tools where appropriate
3. Implement better caching for workspace-optional tools to improve performance

## Testing Requirements

Each tool category requires specific testing:

### Workspace-Required Tools
- Test proper error handling when no workspace is available
- Test workspace permission validation
- Test path security validation

### Workspace-Optional Tools
- Test functionality with workspace available
- Test graceful degradation without workspace
- Test workspace status reporting

### All Tools
- Test getRequirements() method returns correct classification
- Test integration with BaseTool workspace validation
- Test error message clarity and actionability