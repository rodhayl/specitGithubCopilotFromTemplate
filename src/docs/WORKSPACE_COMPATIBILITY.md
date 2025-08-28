# Workspace Compatibility Guide

This document outlines how each command behaves with and without a workspace folder open in VS Code.

## Command Classifications

### 🟢 Workspace-Independent Commands
These commands work completely independently of workspace state:

#### `/agent` - Agent Management
- **Functionality**: Manage AI agents (list, set, current)
- **Workspace Dependency**: None
- **Behavior without workspace**: Full functionality available
- **Behavior with workspace**: Full functionality available
- **Implementation**: Uses AgentManager only, no file operations

**Test Results:**
- ✅ `/agent list` - Works without workspace
- ✅ `/agent set <name>` - Works without workspace  
- ✅ `/agent current` - Works without workspace

### 🟡 Workspace-Optional Commands
These commands provide graceful degradation when no workspace is available:

#### `/templates` - Template Management
- **Functionality**: List, show, validate templates
- **Workspace Dependency**: Optional for user templates
- **Behavior without workspace**: Shows built-in templates only
- **Behavior with workspace**: Shows built-in + user templates
- **Implementation**: ListTemplatesTool with `requiresWorkspace: false`

**Test Results:**
- ✅ `/templates list` - Shows built-in templates without workspace
- ✅ `/templates show <id>` - Shows built-in template details without workspace
- ✅ `/templates validate <id>` - Validates built-in templates without workspace
- ❌ `/templates create` - Requires workspace (creates user templates)
- ❌ `/templates open` - Requires workspace for user templates

### 🔴 Workspace-Required Commands
These commands require a workspace folder to function:

#### `/new` - Document Creation
- **Functionality**: Create new documents from templates
- **Workspace Dependency**: Required for file creation
- **Behavior without workspace**: Enhanced error with setup guidance
- **Behavior with workspace**: Full functionality
- **Implementation**: ApplyTemplateTool with `requiresWorkspace: true`

**Error Handling:**
```
❌ Document creation requires a workspace folder to be open

What to do:
1. Open a folder or workspace in VS Code
2. Use File → Open Folder to select a project directory
3. Try the /new command again once a workspace is open

Alternative options:
- Create a new folder on your computer and open it in VS Code
- Use File → Open Recent to select a previously used workspace

💡 For more help, try: /help workspace
```

#### `/update` - Document Updates
- **Functionality**: Update sections in existing documents
- **Workspace Dependency**: Required for file operations
- **Behavior without workspace**: Error with workspace guidance
- **Behavior with workspace**: Full functionality
- **Implementation**: InsertSectionTool with `requiresWorkspace: true`

#### `/review` - Document Review
- **Functionality**: Review documents for quality and consistency
- **Workspace Dependency**: Required for file access
- **Behavior without workspace**: Error with workspace guidance
- **Behavior with workspace**: Full functionality
- **Implementation**: ReadFileTool with `requiresWorkspace: true`

#### `/summarize` - Document Summarization
- **Functionality**: Generate summaries of multiple documents
- **Workspace Dependency**: Required for file access
- **Behavior without workspace**: Error with workspace guidance
- **Behavior with workspace**: Full functionality
- **Implementation**: ListFilesTool + ReadFileTool with `requiresWorkspace: true`

#### `/catalog` - Document Cataloging
- **Functionality**: Generate catalog/index of documents
- **Workspace Dependency**: Required for file access
- **Behavior without workspace**: Error with workspace guidance
- **Behavior with workspace**: Full functionality
- **Implementation**: ListFilesTool + ReadFileTool with `requiresWorkspace: true`

## Error Handling Patterns

### Enhanced Workspace Error Messages
All workspace-required commands provide enhanced error messages with:

1. **Clear Error Description**: Explains why workspace is needed
2. **Actionable Steps**: Step-by-step instructions to resolve
3. **Alternative Options**: Multiple ways to set up workspace
4. **Help References**: Links to additional help resources

### Graceful Degradation
Workspace-optional commands provide:

1. **Status Indicators**: Clear indication of workspace availability
2. **Feature Limitations**: Explanation of reduced functionality
3. **Upgrade Path**: Instructions to access full features

## Implementation Details

### BaseTool Workspace Validation
All tools inherit workspace validation from BaseTool:

```typescript
// Workspace-required tools
protected getRequirements() {
    return {
        requiresWorkspace: true,
        requiresFileSystem: true,
        workspaceOptional: false
    };
}

// Workspace-optional tools
protected getRequirements() {
    return {
        requiresWorkspace: false,
        requiresFileSystem: false,
        workspaceOptional: true,
        gracefulDegradation: {
            withoutWorkspace: ['Limited functionality'],
            withWorkspace: ['Full functionality']
        }
    };
}
```

### WorkspaceErrorHandler Integration
Enhanced error messages are provided by WorkspaceErrorHandler:

- **Error Type Detection**: Automatically determines error type
- **Contextual Guidance**: Provides relevant solutions
- **Consistent Messaging**: Standardized error format across all tools

## Testing Strategy

### Manual Testing Scenarios
1. **No Workspace Open**: Test all commands with no folder open
2. **Single Folder Workspace**: Test with single folder open
3. **Multi-Root Workspace**: Test with multiple folders open
4. **Permission Issues**: Test with read-only workspace
5. **Invalid Workspace**: Test with corrupted/missing workspace

### Automated Testing
- Unit tests for WorkspaceErrorHandler
- Integration tests for BaseTool workspace validation
- Tool-specific workspace scenario tests

## User Experience Guidelines

### Error Message Principles
1. **Be Helpful**: Provide actionable solutions
2. **Be Clear**: Use simple, non-technical language
3. **Be Consistent**: Use standardized error formats
4. **Be Encouraging**: Frame as setup steps, not failures

### Status Communication
1. **Workspace Indicators**: Show workspace status in command output
2. **Feature Availability**: Clearly indicate what's available/unavailable
3. **Progress Feedback**: Show when workspace operations are in progress

## Troubleshooting

### Common Issues
1. **"No workspace folder is open"**: User needs to open a folder
2. **"Insufficient permissions"**: Workspace folder is read-only
3. **"Invalid workspace"**: Workspace folder is corrupted or missing
4. **"Multi-root complexity"**: Multiple workspace folders detected

### Solutions
1. **Open Folder**: File → Open Folder
2. **Check Permissions**: Ensure folder is writable
3. **Refresh Workspace**: Close and reopen VS Code
4. **Simplify Workspace**: Use single folder workspace

## Future Enhancements

### Planned Improvements
1. **Workspace Setup Wizard**: Guided workspace creation
2. **Template Workspace**: Pre-configured workspace templates
3. **Cloud Workspace**: Support for remote/cloud workspaces
4. **Workspace Validation**: Enhanced workspace health checks