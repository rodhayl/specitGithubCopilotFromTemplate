// Jest setup file for global test configuration
import 'jest';

// Global test timeout
jest.setTimeout(10000);

// Global VSCode mocking
jest.mock('vscode', () => {
  const mockWorkspace = {
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

  const mockUri = {
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

  const MockWorkspaceEdit = jest.fn().mockImplementation(() => ({
    createFile: jest.fn(),
    replace: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn()
  }));

  return {
    workspace: mockWorkspace,
    Uri: mockUri,
    Range: MockRange,
    Position: MockPosition,
    WorkspaceEdit: MockWorkspaceEdit,
    window: {
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        show: jest.fn(),
        clear: jest.fn()
      }))
    },
    commands: {
      registerCommand: jest.fn(),
      executeCommand: jest.fn()
    },
    extensions: {
      getExtension: jest.fn()
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn()
    })),
    Disposable: jest.fn().mockImplementation(() => ({
      dispose: jest.fn()
    })),
    
    // ExtensionMode enum
    ExtensionMode: {
      Production: 1,
      Development: 2,
      Test: 3
    },
    
    // Environment API
    env: {
      isTelemetryEnabled: true,
      machineId: 'test-machine-id',
      sessionId: 'test-session-id',
      language: 'en',
      shell: '/bin/bash'
    }
  };
}, { virtual: true });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidExtensionResponse(): R;
    }
  }
}

// Custom Jest matchers for extension testing
expect.extend({
  toBeValidExtensionResponse(received: any) {
    const pass = received && 
                 typeof received === 'object' && 
                 'content' in received;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid extension response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid extension response with content property`,
        pass: false,
      };
    }
  },
});