// Comprehensive VSCode API mocks for testing

export interface MockTextDocument {
  getText: jest.Mock;
  positionAt: jest.Mock;
  lineAt: jest.Mock;
  uri: any;
  fileName: string;
  languageId: string;
}

export interface MockWorkspaceEdit {
  createFile: jest.Mock;
  replace: jest.Mock;
  insert: jest.Mock;
  delete: jest.Mock;
}

export interface MockWorkspace {
  openTextDocument: jest.Mock;
  applyEdit: jest.Mock;
  fs: {
    createDirectory: jest.Mock;
    writeFile: jest.Mock;
    readFile: jest.Mock;
  };
  workspaceFolders: any[];
  getConfiguration: jest.Mock;
}

export interface MockUri {
  file: jest.Mock;
  parse: jest.Mock;
  joinPath: jest.Mock;
  fsPath: string;
}

export interface MockRange {
  new (start: any, end: any): any;
  start: any;
  end: any;
}

export interface MockPosition {
  new (line: number, character: number): any;
  line: number;
  character: number;
}

// Create mock implementations
const mockTextDocument: MockTextDocument = {
  getText: jest.fn(),
  positionAt: jest.fn(),
  lineAt: jest.fn(),
  uri: { fsPath: '/test/path' },
  fileName: 'test.md',
  languageId: 'markdown'
};

const mockWorkspaceEdit: MockWorkspaceEdit = {
  createFile: jest.fn(),
  replace: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn()
};

const mockWorkspace: MockWorkspace = {
  openTextDocument: jest.fn(),
  applyEdit: jest.fn(),
  fs: {
    createDirectory: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn()
  },
  workspaceFolders: [],
  getConfiguration: jest.fn()
};

const mockUri: MockUri = {
  file: jest.fn(),
  parse: jest.fn(),
  joinPath: jest.fn(),
  fsPath: '/test/path'
};

const MockRange = jest.fn().mockImplementation((start: any, end: any) => ({
  start,
  end
}));

const MockPosition = jest.fn().mockImplementation((line: number, character: number) => ({
  line,
  character
}));

const MockWorkspaceEdit = jest.fn().mockImplementation(() => mockWorkspaceEdit);

// Export individual components
export const workspace = mockWorkspace;
export const Uri = mockUri;
export const Range = MockRange;
export const Position = MockPosition;
export const WorkspaceEdit = MockWorkspaceEdit;
export const TextDocument = mockTextDocument;

// Additional VSCode API mocks
export const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn()
  }))
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn()
};

export const extensions = {
  getExtension: jest.fn()
};

export const env = {
  isTelemetryEnabled: true,
  sessionId: 'test-session-id',
  machineId: 'test-machine-id',
  language: 'en',
  clipboard: {
    readText: jest.fn(),
    writeText: jest.fn()
  }
};

export const ExtensionMode = {
  Production: 1,
  Development: 2,
  Test: 3
};

// Event emitters
export const EventEmitter = jest.fn().mockImplementation(() => ({
  event: jest.fn(),
  fire: jest.fn(),
  dispose: jest.fn()
}));

// Disposable
export const Disposable = jest.fn().mockImplementation(() => ({
  dispose: jest.fn()
}));

// Mock ExtensionContext
export class ExtensionContext {
  public readonly subscriptions: any[] = [];
  public readonly workspaceState: any = {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn().mockReturnValue([])
  };
  public readonly globalState: any = {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn().mockReturnValue([]),
    setKeysForSync: jest.fn()
  };
  public readonly secrets: any = {
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
    onDidChange: jest.fn()
  };
  public readonly extensionUri: any = { scheme: 'file', path: '/test/extension', fsPath: '/test/extension' };
  public readonly extensionPath: string = '/test/extension';
  public readonly environmentVariableCollection: any = {
    replace: jest.fn(),
    append: jest.fn(),
    prepend: jest.fn(),
    get: jest.fn(),
    forEach: jest.fn(),
    clear: jest.fn(),
    delete: jest.fn(),
    persistent: true,
    description: 'Test environment variables'
  };
  public readonly storageUri: any = { scheme: 'file', path: '/test/storage', fsPath: '/test/storage' };
  public readonly storagePath: string = '/test/storage';
  public readonly globalStorageUri: any = { scheme: 'file', path: '/test/global-storage', fsPath: '/test/global-storage' };
  public readonly globalStoragePath: string = '/test/global-storage';
  public readonly logUri: any = { scheme: 'file', path: '/test/logs', fsPath: '/test/logs' };
  public readonly logPath: string = '/test/logs';
  public readonly extensionMode: any = 1; // ExtensionMode.Development
  public readonly extension: any = {
    id: 'test.extension',
    extensionUri: { scheme: 'file', path: '/test/extension', fsPath: '/test/extension' },
    extensionPath: '/test/extension',
    isActive: true,
    packageJSON: {},
    extensionKind: 1,
    exports: undefined,
    activate: jest.fn()
  };
  public readonly languageModelAccessInformation: any = {
    onDidChange: jest.fn(),
    canSendRequest: jest.fn().mockReturnValue(true)
  };
  
  // Add required methods
  public asAbsolutePath(relativePath: string): string {
    return `/test/extension/${relativePath}`;
  }
}