// Test utilities and helpers
import * as vscode from 'vscode';

/**
 * Create a mock VS Code extension context for testing
 */
export function createMockExtensionContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        workspaceState: {
            get: (key: string) => undefined,
            update: (key: string, value: any) => Promise.resolve(),
            keys: () => []
        },
        globalState: {
            get: (key: string) => undefined,
            update: (key: string, value: any) => Promise.resolve(),
            setKeysForSync: (keys: string[]) => {},
            keys: () => []
        },
        extensionUri: vscode.Uri.file('/mock/extension/path'),
        extensionPath: '/mock/extension/path',
        asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
        storageUri: vscode.Uri.file('/mock/storage'),
        storagePath: '/mock/storage',
        globalStorageUri: vscode.Uri.file('/mock/global/storage'),
        globalStoragePath: '/mock/global/storage',
        logUri: vscode.Uri.file('/mock/log'),
        logPath: '/mock/log',
        extensionMode: vscode.ExtensionMode.Test,
        environmentVariableCollection: {} as any,
        secrets: {} as any,
        extension: {} as any,
        languageModelAccessInformation: {
            onDidChange: new vscode.EventEmitter().event,
            canSendRequest: () => undefined
        } as any
    };
}

/**
 * Create a mock cancellation token for testing
 */
export function createMockCancellationToken(cancelled: boolean = false): vscode.CancellationToken {
    return {
        isCancellationRequested: cancelled,
        onCancellationRequested: () => ({ dispose: () => {} })
    };
}

/**
 * Create a mock chat response stream for testing
 */
export function createMockChatResponseStream(): vscode.ChatResponseStream {
    const outputs: string[] = [];
    
    return {
        markdown: (text: string) => {
            outputs.push(`MARKDOWN: ${text}`);
        },
        anchor: (value: vscode.Uri | vscode.Location, title?: string) => {
            outputs.push(`ANCHOR: ${title || value.toString()}`);
        },
        button: (command: vscode.Command) => {
            outputs.push(`BUTTON: ${command.title}`);
        },
        filetree: (value: vscode.ChatResponseFileTree[], baseUri: vscode.Uri) => {
            outputs.push(`FILETREE: ${value.length} items`);
        },
        progress: (value: string) => {
            outputs.push(`PROGRESS: ${value}`);
        },
        reference: (value: vscode.Uri | vscode.Location, iconPath?: vscode.ThemeIcon | vscode.Uri) => {
            outputs.push(`REFERENCE: ${value.toString()}`);
        },
        push: (part: vscode.ChatResponsePart) => {
            outputs.push(`PART: ${JSON.stringify(part)}`);
        },
        // Add getter for test verification
        getOutputs: () => outputs
    } as any;
}

/**
 * Create a mock chat request for testing
 */
export function createMockChatRequest(prompt: string): vscode.ChatRequest {
    return {
        prompt,
        command: 'docu',
        references: [],
        location: 1, // vscode.ChatLocation.Panel
        participant: 'docu',
        toolReferences: [],
        toolInvocationToken: null as any,
        model: null as any
    } as unknown as vscode.ChatRequest;
}

/**
 * Wait for a specified amount of time (for async testing)
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that a string contains all specified substrings
 */
export function assertContainsAll(text: string, substrings: string[], message?: string): void {
    for (const substring of substrings) {
        if (!text.includes(substring)) {
            throw new Error(`${message || 'Text'} should contain "${substring}". Actual text: ${text}`);
        }
    }
}

/**
 * Assert that an array contains all specified items
 */
export function assertArrayContainsAll<T>(array: T[], items: T[], message?: string): void {
    for (const item of items) {
        if (!array.includes(item)) {
            throw new Error(`${message || 'Array'} should contain ${JSON.stringify(item)}. Actual array: ${JSON.stringify(array)}`);
        }
    }
}

/**
 * Create a temporary workspace folder for testing
 */
export function createMockWorkspaceFolder(name: string = 'test-workspace'): vscode.WorkspaceFolder {
    return {
        uri: vscode.Uri.file(`/mock/workspace/${name}`),
        name,
        index: 0
    };
}

/**
 * Mock VS Code workspace for testing
 */
export function mockWorkspace(folders: vscode.WorkspaceFolder[] = [createMockWorkspaceFolder()]): void {
    (vscode.workspace as any).workspaceFolders = folders;
    (vscode.workspace as any).name = folders[0]?.name || 'test-workspace';
    (vscode.workspace as any).workspaceFile = folders[0] ? vscode.Uri.file(`${folders[0].uri.fsPath}/.vscode/workspace.json`) : undefined;
}

/**
 * Restore VS Code workspace after mocking
 */
export function restoreWorkspace(): void {
    // In a real test environment, this would restore the original workspace
    // For now, we just clear the mock
    (vscode.workspace as any).workspaceFolders = undefined;
    (vscode.workspace as any).name = undefined;
    (vscode.workspace as any).workspaceFile = undefined;
}

/**
 * Create a mock tool context for testing
 */
export function createMockToolContext(workspaceRoot: string = '/mock/workspace'): any {
    return {
        workspaceRoot,
        extensionContext: createMockExtensionContext(),
        cancellationToken: createMockCancellationToken()
    };
}

/**
 * Create a mock command context for testing
 */
export function createMockCommandContext(workspaceRoot: string = '/mock/workspace'): any {
    return {
        request: createMockChatRequest('test command'),
        stream: createMockChatResponseStream(),
        token: createMockCancellationToken(),
        workspaceRoot,
        extensionContext: createMockExtensionContext()
    };
}

/**
 * Create a mock text document for testing
 */
export function createMockTextDocument(content: string, filePath: string = '/test/document.md'): any {
    return {
        getText: () => content,
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        isUntitled: false,
        languageId: 'markdown',
        version: 1,
        isDirty: false,
        isClosed: false,
        save: () => Promise.resolve(true),
        eol: vscode.EndOfLine.LF,
        lineCount: content.split('\n').length
    };
}

/**
 * Test data generators
 */
export const TestData = {
    /**
     * Generate a sample template for testing
     */
    createSampleTemplate: (id: string = 'test-template') => ({
        id,
        name: `Test Template ${id}`,
        description: 'A template for testing purposes',
        content: `# {{title}}\n\nCreated: {{currentDate}}\nAuthor: {{author}}\n\n## Content\n\n{{content}}`,
        variables: [
            {
                name: 'title',
                description: 'Document title',
                required: true,
                type: 'string'
            },
            {
                name: 'content',
                description: 'Document content',
                required: false,
                type: 'string',
                defaultValue: 'Add your content here...'
            }
        ],
        frontMatter: {
            type: 'TestDocument'
        },
        agentRestrictions: []
    }),

    /**
     * Generate sample agent configuration
     */
    createSampleAgent: (name: string = 'test-agent') => ({
        name,
        description: `Test agent: ${name}`,
        phase: 'implementation' as const,
        systemPrompt: `You are a test agent named ${name}. Help with testing.`,
        allowedTools: ['readFile', 'writeFile', 'applyTemplate'],
        active: false
    }),

    /**
     * Generate sample error for testing
     */
    createSampleError: (message: string = 'Test error', type: string = 'Error') => {
        const error = new Error(message);
        error.name = type;
        return error;
    }
};

/**
 * Test assertions for common patterns
 */
export const TestAssertions = {
    /**
     * Assert that a result object has success property
     */
    assertResult: (result: any, shouldSucceed: boolean = true) => {
        if (typeof result !== 'object' || result === null) {
            throw new Error('Result should be an object');
        }
        
        if (typeof result.success !== 'boolean') {
            throw new Error('Result should have boolean success property');
        }
        
        if (result.success !== shouldSucceed) {
            throw new Error(`Result success should be ${shouldSucceed}, got ${result.success}. Error: ${result.error}`);
        }
        
        if (!shouldSucceed && !result.error) {
            throw new Error('Failed result should have error message');
        }
    },

    /**
     * Assert that an object has all required properties
     */
    assertHasProperties: (obj: any, properties: string[]) => {
        if (typeof obj !== 'object' || obj === null) {
            throw new Error('Object should be defined');
        }
        
        for (const prop of properties) {
            if (!(prop in obj)) {
                throw new Error(`Object should have property: ${prop}`);
            }
        }
    },

    /**
     * Assert that a template has valid structure
     */
    assertValidTemplate: (template: any) => {
        TestAssertions.assertHasProperties(template, ['id', 'name', 'description', 'content', 'variables']);
        
        if (!Array.isArray(template.variables)) {
            throw new Error('Template variables should be an array');
        }
        
        for (const variable of template.variables) {
            TestAssertions.assertHasProperties(variable, ['name', 'description', 'required', 'type']);
        }
    }
};