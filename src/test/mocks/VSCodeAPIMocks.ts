// Comprehensive VS Code API mocking infrastructure
import * as vscode from 'vscode';

export class VSCodeAPIMocks {
    private static originalAPIs: any = {};
    private static isMocked = false;

    /**
     * Setup comprehensive mocks for VS Code APIs
     */
    static setupMocks(): void {
        if (this.isMocked || process.env.NODE_ENV !== 'test') {
            return;
        }

        // Store original APIs for restoration
        this.originalAPIs = {
            openTextDocument: vscode.workspace.openTextDocument,
            showTextDocument: vscode.window.showTextDocument,
            showErrorMessage: vscode.window.showErrorMessage,
            showWarningMessage: vscode.window.showWarningMessage,
            showInformationMessage: vscode.window.showInformationMessage,
            showInputBox: vscode.window.showInputBox,
            showOpenDialog: vscode.window.showOpenDialog
        };

        // Mock workspace APIs
        (vscode.workspace as any).openTextDocument = this.mockOpenTextDocument;
        
        // Mock window APIs
        (vscode.window as any).showTextDocument = this.mockShowTextDocument;
        (vscode.window as any).showErrorMessage = this.mockShowMessage('error');
        (vscode.window as any).showWarningMessage = this.mockShowMessage('warning');
        (vscode.window as any).showInformationMessage = this.mockShowMessage('info');
        (vscode.window as any).showInputBox = this.mockShowInputBox;
        (vscode.window as any).showOpenDialog = this.mockShowOpenDialog;

        this.isMocked = true;
        console.log('[TEST] VS Code API mocks activated');
    }

    /**
     * Restore original VS Code APIs
     */
    static restoreMocks(): void {
        if (!this.isMocked) {
            return;
        }

        // Restore original APIs
        (vscode.workspace as any).openTextDocument = this.originalAPIs.openTextDocument;
        (vscode.window as any).showTextDocument = this.originalAPIs.showTextDocument;
        (vscode.window as any).showErrorMessage = this.originalAPIs.showErrorMessage;
        (vscode.window as any).showWarningMessage = this.originalAPIs.showWarningMessage;
        (vscode.window as any).showInformationMessage = this.originalAPIs.showInformationMessage;
        (vscode.window as any).showInputBox = this.originalAPIs.showInputBox;
        (vscode.window as any).showOpenDialog = this.originalAPIs.showOpenDialog;

        this.isMocked = false;
        console.log('[TEST] VS Code API mocks restored');
    }

    /**
     * Mock for vscode.workspace.openTextDocument
     */
    private static mockOpenTextDocument = async (options: any): Promise<vscode.TextDocument> => {
        const content = options.content || '';
        const uri = options.uri || vscode.Uri.parse('untitled:test');
        
        return {
            uri,
            fileName: uri.fsPath || 'test',
            isUntitled: true,
            languageId: options.language || 'markdown',
            version: 1,
            isDirty: false,
            isClosed: false,
            encoding: 'utf8',
            save: () => Promise.resolve(true),
            eol: vscode.EndOfLine.LF,
            lineCount: content.split('\n').length,
            lineAt: (lineOrPosition: number | vscode.Position) => {
                const lineNumber = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
                return {
                    lineNumber,
                    text: content.split('\n')[lineNumber] || '',
                    range: new vscode.Range(lineNumber, 0, lineNumber, content.split('\n')[lineNumber]?.length || 0),
                    rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber + 1, 0),
                    firstNonWhitespaceCharacterIndex: 0,
                    isEmptyOrWhitespace: false
                };
            },
            offsetAt: () => 0,
            positionAt: () => new vscode.Position(0, 0),
            getText: () => content,
            getWordRangeAtPosition: () => undefined,
            validateRange: (range: vscode.Range) => range,
            validatePosition: (position: vscode.Position) => position
        } as vscode.TextDocument;
    };

    /**
     * Mock for vscode.window.showTextDocument
     */
    private static mockShowTextDocument = async (document: vscode.TextDocument): Promise<vscode.TextEditor> => {
        return {
            document,
            selection: new vscode.Selection(0, 0, 0, 0),
            selections: [new vscode.Selection(0, 0, 0, 0)],
            visibleRanges: [new vscode.Range(0, 0, 0, 0)],
            options: {},
            viewColumn: vscode.ViewColumn.One,
            edit: () => Promise.resolve(true),
            insertSnippet: () => Promise.resolve(true),
            setDecorations: () => {},
            revealRange: () => {},
            show: () => {},
            hide: () => {}
        } as vscode.TextEditor;
    };

    /**
     * Mock for VS Code message dialogs
     */
    private static mockShowMessage = (type: 'error' | 'warning' | 'info') => {
        return async (message: string, ...items: string[]): Promise<string | undefined> => {
            console.log(`[TEST] ${type.toUpperCase()}: ${message}`);
            if (items.length > 0) {
                console.log(`[TEST] Options: ${items.join(', ')}`);
                return items[0]; // Return first option by default
            }
            return undefined;
        };
    };

    /**
     * Mock for vscode.window.showInputBox
     */
    private static mockShowInputBox = async (options?: vscode.InputBoxOptions): Promise<string | undefined> => {
        console.log(`[TEST] Input box: ${options?.prompt || 'Input requested'}`);
        return options?.value || 'test-input';
    };

    /**
     * Mock for vscode.window.showOpenDialog
     */
    private static mockShowOpenDialog = async (options?: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> => {
        console.log(`[TEST] Open dialog: ${options?.title || 'File selection requested'}`);
        return [vscode.Uri.file('/mock/selected/file.md')];
    };

    /**
     * Create mock extension context
     */
    static createMockExtensionContext(): vscode.ExtensionContext {
        return {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => {},
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
     * Create mock command context
     */
    static createMockCommandContext(workspaceRoot: string = '/mock/workspace'): any {
        return {
            request: {
                prompt: '',
                command: 'docu',
                references: [],
                location: 1, // vscode.ChatLocation.Panel
                participant: 'docu',
                toolReferences: [],
                toolInvocationToken: {} as any,
                model: {} as any
            } as unknown as vscode.ChatRequest,
            stream: {
                markdown: (text: string) => console.log(`[TEST] Stream: ${text}`),
                anchor: () => {},
                button: () => {},
                filetree: () => {},
                progress: () => {},
                reference: () => {},
                push: () => {}
            } as vscode.ChatResponseStream,
            token: {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken,
            workspaceRoot,
            extensionContext: this.createMockExtensionContext()
        };
    }

    /**
     * Create mock tool context
     */
    static createMockToolContext(workspaceRoot: string = '/mock/workspace'): any {
        return {
            workspaceRoot,
            extensionContext: this.createMockExtensionContext(),
            cancellationToken: {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken
        };
    }
}