# Design Document

## Overview

This design document outlines the technical solutions for fixing 22 failing tests in the VSCode documentation extension. The failures span across security, error handling, command routing, tool management, and end-to-end workflow areas. The fixes must maintain backward compatibility while ensuring robust test coverage and reliable functionality.

The design focuses on identifying root causes and implementing targeted fixes that address both the immediate test failures and underlying architectural issues that could cause similar problems in the future.

## Architecture

### Problem Analysis

Based on the test failures and code analysis, the issues fall into these categories:

1. **SecurityManager Issues**
   - `sanitizeInput()` method has incorrect HTML tag removal logic
   - Expected: `<script>alert("xss")</script>` → `alert("xss")`
   - Actual: `<script>alert("xss")</script>` → `scriptalert("xss")/script`

2. **ErrorHandler Timeout Issues**
   - Async operations not properly awaited in test environment
   - VS Code dialog service interactions blocking in test mode
   - Missing proper promise resolution patterns

3. **CommandRouter Logic Issues**
   - `isCommand()` method incorrectly identifies comments and empty commands as valid
   - Missing proper validation for command format

4. **ToolManager Execution Issues**
   - Tools returning incorrect success/failure status
   - Missing proper error context in tool execution results
   - Template-related tools not properly initialized in test environment

5. **End-to-End Workflow Issues**
   - Integration between components not working correctly in test environment
   - Missing proper mocking for VS Code APIs
   - Async workflow steps not properly coordinated

## Components and Interfaces

### SecurityManager Fixes

#### Current Implementation Issue
```typescript
// Current problematic implementation
sanitizeInput(input: string): string {
    return input
        .replace(/[<>]/g, '') // This removes < and > but leaves content
        // ...
}
```

#### Fixed Implementation
```typescript
sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        // Remove complete HTML/XML tags while preserving inner content
        .replace(/<[^>]*>/g, '')
        // Remove protocol handlers
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '')
        // Remove event handlers
        .replace(/on\w+\s*=/gi, '')
        .trim();
}
```

### ErrorHandler Fixes

#### Async Operation Handling
```typescript
// Add proper async handling for all error categorization methods
private async categorizeError(error: Error, context: ErrorContext): Promise<ErrorReport> {
    // Ensure all operations are properly awaited
    // Add timeout handling for VS Code API calls
    // Implement proper promise resolution patterns
}

// Fix workspace error handling to avoid dialog blocking
private createWorkspaceError(error: Error, context: ErrorContext): ErrorReport {
    // Avoid calling VS Code dialog APIs in test environment
    // Use proper error detection without UI interactions
}
```

#### Test Environment Detection
```typescript
private isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || 
           process.env.VSCODE_PID === undefined ||
           vscode.env.appName.includes('Test');
}

private async showUserNotification(errorReport: ErrorReport): Promise<void> {
    if (this.isTestEnvironment()) {
        // Skip UI interactions in test environment
        return;
    }
    // Normal notification logic
}
```

### CommandRouter Fixes

#### Command Identification Logic
```typescript
isCommand(input: string): boolean {
    const trimmed = input.trim();
    
    // Must start with / and have content after it
    if (!trimmed.startsWith('/')) {
        return false;
    }
    
    // Must have at least one character after the /
    if (trimmed.length <= 1) {
        return false;
    }
    
    // Must not be just whitespace after /
    const afterSlash = trimmed.substring(1).trim();
    if (afterSlash.length === 0) {
        return false;
    }
    
    // Must not be a comment (// pattern)
    if (trimmed.startsWith('//')) {
        return false;
    }
    
    return true;
}
```

#### Enhanced Command Parsing
```typescript
parseCommand(input: string): ParsedCommand {
    // Add validation before parsing
    if (!this.isCommand(input)) {
        throw new Error(`Invalid command format: ${input}`);
    }
    
    // Existing parsing logic with better error handling
}
```

### ToolManager Fixes

#### Tool Execution Result Consistency
```typescript
async executeTool(toolName: string, parameters: any, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
        return {
            success: false,
            error: `Tool '${toolName}' not found`,
            metadata: {
                availableTools: Array.from(this.tools.keys()),
                requestedTool: toolName
            }
        };
    }

    try {
        const result = await tool.execute(parameters, context);
        
        // Ensure consistent result format
        return {
            success: result.success !== false, // Default to true if not explicitly false
            data: result.data,
            error: result.error,
            metadata: {
                ...result.metadata,
                toolName,
                executionTime: Date.now()
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
                toolName,
                errorType: error instanceof Error ? error.constructor.name : 'Unknown'
            }
        };
    }
}
```

#### Template Tool Initialization
```typescript
private registerBuiltinTools(): void {
    // Ensure template manager is properly initialized before registering template tools
    if (this.templateManager) {
        try {
            // Verify template manager is ready
            const templates = this.templateManager.listTemplates();
            
            this.registerTool(new ListTemplatesTool(this.templateManager));
            this.registerTool(new ValidateTemplateTool(this.templateManager));
            this.registerTool(new OpenTemplateTool(this.templateManager));
            this.registerTool(new ApplyTemplateTool(this.templateManager));
        } catch (error) {
            console.warn('Template tools registration failed:', error);
            // Register basic tools only
        }
    }
}
```

## Data Models

### Enhanced Error Context
```typescript
interface ErrorContext {
    operation: string;
    filePath?: string;
    agentName?: string;
    toolName?: string;
    userInput?: string;
    timestamp: Date;
    testEnvironment?: boolean; // Add test environment flag
    retryCount?: number; // Add retry tracking
}
```

### Tool Result Standardization
```typescript
interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        toolName?: string;
        executionTime?: number;
        errorType?: string;
        availableTools?: string[];
        [key: string]: any;
    };
}
```

### Test Context Enhancement
```typescript
interface TestContext {
    mockVSCodeAPIs: boolean;
    skipUIInteractions: boolean;
    timeoutOverride?: number;
    mockFileSystem: boolean;
}
```

## Error Handling

### Test Environment Adaptations

#### VS Code API Mocking Strategy
```typescript
// Create comprehensive mocks for VS Code APIs in test environment
class VSCodeAPIMocks {
    static setupMocks(): void {
        if (process.env.NODE_ENV === 'test') {
            // Mock workspace APIs
            (vscode.workspace as any).openTextDocument = jest.fn();
            (vscode.window as any).showTextDocument = jest.fn();
            (vscode.window as any).showErrorMessage = jest.fn();
            (vscode.window as any).showWarningMessage = jest.fn();
            (vscode.window as any).showInformationMessage = jest.fn();
        }
    }
}
```

#### Timeout Management
```typescript
class TestTimeoutManager {
    static getTimeout(operation: string): number {
        const timeouts = {
            'file-operation': 1000,
            'llm-request': 3000,
            'error-handling': 500,
            'default': 2000
        };
        
        return timeouts[operation] || timeouts.default;
    }
    
    static wrapWithTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
        const timeout = this.getTimeout(operation);
        
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
                setTimeout(() => reject(new Error(`Operation ${operation} timed out after ${timeout}ms`)), timeout)
            )
        ]);
    }
}
```

### Graceful Degradation Patterns

#### Test-Safe Error Handling
```typescript
class TestSafeErrorHandler extends ErrorHandler {
    protected async showUserNotification(errorReport: ErrorReport): Promise<void> {
        if (this.isTestEnvironment()) {
            // Log instead of showing UI
            console.log(`[TEST] Error notification: ${errorReport.userMessage}`);
            return;
        }
        
        return super.showUserNotification(errorReport);
    }
    
    private isTestEnvironment(): boolean {
        return process.env.NODE_ENV === 'test' ||
               typeof jest !== 'undefined' ||
               typeof mocha !== 'undefined';
    }
}
```

## Testing Strategy

### Unit Test Fixes

#### SecurityManager Test Fixes
```typescript
// Fix sanitization test expectations
test('Should sanitize user input', () => {
    const testCases = [
        {
            input: '<script>alert("xss")</script>',
            expected: 'alert("xss")' // Remove tags, keep content
        },
        {
            input: 'javascript:void(0)',
            expected: 'void(0)' // Remove protocol
        }
    ];
    
    for (const testCase of testCases) {
        const result = securityManager.sanitizeInput(testCase.input);
        assert.strictEqual(result, testCase.expected);
    }
});
```

#### ErrorHandler Test Fixes
```typescript
// Add proper async handling and timeout management
test('Should categorize file not found errors', async () => {
    const error = new Error('ENOENT: no such file or directory');
    const context: ErrorContext = {
        operation: 'readFile',
        filePath: 'missing.md',
        timestamp: new Date(),
        testEnvironment: true
    };

    // Use timeout wrapper
    const report = await TestTimeoutManager.wrapWithTimeout(
        errorHandler.handleError(error, context),
        'error-handling'
    );

    assert.strictEqual(report.severity, 'medium');
    assert.ok(report.userMessage.includes('File not found'));
});
```

### Integration Test Fixes

#### CommandRouter Test Fixes
```typescript
test('Should identify commands correctly', () => {
    const commands = ['/new document', '/templates list'];
    const nonCommands = ['regular text', '// this is a comment', '/', '/   '];

    for (const command of commands) {
        assert.strictEqual(commandRouter.isCommand(command), true);
    }

    for (const nonCommand of nonCommands) {
        assert.strictEqual(commandRouter.isCommand(nonCommand), false);
    }
});
```

#### ToolManager Test Fixes
```typescript
test('Should execute listTemplates tool', async () => {
    // Ensure template manager is properly initialized
    await templateManager.initialize();
    
    const result = await toolManager.executeTool('listTemplates', {}, mockContext);

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.ok(Array.isArray(result.data.templates));
});
```

### End-to-End Test Fixes

#### Workflow Test Coordination
```typescript
test('Complete PRD Creation Workflow', async () => {
    // Setup proper test environment
    VSCodeAPIMocks.setupMocks();
    
    // Initialize all components in correct order
    await templateManager.initialize();
    await agentManager.loadConfigurations();
    
    // Execute workflow steps with proper error handling
    const steps = [
        () => toolManager.executeTool('listTemplates', {}, mockContext),
        () => toolManager.executeTool('validateTemplate', { templateId: 'prd' }, mockContext),
        () => agentManager.setCurrentAgent('prd-creator')
    ];
    
    for (const step of steps) {
        const result = await TestTimeoutManager.wrapWithTimeout(step(), 'workflow-step');
        assert.ok(result.success !== false);
    }
});
```

## Performance Considerations

### Test Execution Optimization

#### Parallel Test Execution
- Ensure tests are properly isolated to allow parallel execution
- Use proper setup/teardown to avoid test interference
- Implement resource cleanup to prevent memory leaks

#### Mock Optimization
- Create lightweight mocks that don't perform actual I/O operations
- Cache mock responses to improve test performance
- Use dependency injection to make mocking easier

### Memory Management
- Implement proper cleanup in test teardown
- Avoid creating large objects in test loops
- Use weak references where appropriate to prevent memory leaks

## Implementation Flow

### Phase 1: Core Fixes
1. Fix SecurityManager sanitization logic
2. Implement test environment detection in ErrorHandler
3. Fix CommandRouter command identification logic
4. Standardize ToolManager result formats

### Phase 2: Test Infrastructure
1. Implement comprehensive VS Code API mocking
2. Add timeout management for async operations
3. Create test-safe versions of UI-dependent components
4. Implement proper test isolation patterns

### Phase 3: Integration Fixes
1. Fix end-to-end workflow coordination
2. Implement proper component initialization order
3. Add comprehensive error handling in test scenarios
4. Ensure consistent async operation handling

### Phase 4: Validation
1. Run full test suite to verify all fixes
2. Perform regression testing on existing functionality
3. Validate performance improvements
4. Document test patterns for future development

This design ensures that all test failures are addressed while maintaining code quality and establishing patterns for reliable testing in the future.