// Mock vscode module for all tests
jest.mock('vscode', () => ({
	workspace: {
		getConfiguration: jest.fn(() => ({
			get: jest.fn(),
			update: jest.fn(),
			has: jest.fn()
		})),
		onDidChangeConfiguration: jest.fn(),
		workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
		openTextDocument: jest.fn(),
		applyEdit: jest.fn(),
		fs: {
			readFile: jest.fn(),
			writeFile: jest.fn(),
			stat: jest.fn(),
			createDirectory: jest.fn()
		}
	},
	window: {
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		showQuickPick: jest.fn(),
		showInputBox: jest.fn(),
		createOutputChannel: jest.fn()
	},
	Uri: {
		file: jest.fn((path) => ({ fsPath: path, scheme: 'file' })),
		joinPath: jest.fn((base, ...paths) => ({ fsPath: `${base.fsPath}/${paths.join('/')}`, scheme: 'file' })),
		parse: jest.fn((uri) => ({ fsPath: uri, scheme: 'file' }))
	},
	ExtensionContext: jest.fn(),
	ExtensionMode: {
		Test: 3,
		Development: 2,
		Production: 1
	},
	EventEmitter: jest.fn(() => ({
		event: jest.fn(),
		fire: jest.fn(),
		dispose: jest.fn()
	})),
	extensions: {
		getExtension: jest.fn()
	},
	authentication: {
		getSession: jest.fn()
	},
	lm: {
		selectChatModels: jest.fn()
	},
	commands: {
		registerCommand: jest.fn(),
		executeCommand: jest.fn()
	},
	languages: {
		createDiagnosticCollection: jest.fn()
	},
	StatusBarAlignment: {
		Left: 1,
		Right: 2
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3
	},
	WorkspaceEdit: jest.fn(() => ({
		createFile: jest.fn(),
		replace: jest.fn(),
		insert: jest.fn(),
		delete: jest.fn()
	})),
	Range: jest.fn((startLine, startChar, endLine, endChar) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar }
	})),
	Position: jest.fn((line, character) => ({ line, character })),
	env: {
		isTelemetryEnabled: true,
		machineId: 'test-machine-id-12345'
	}
}), { virtual: true });

// Mock Logger for tests to avoid initialization issues
jest.mock('../logging/Logger', () => ({
	Logger: {
		initialize: jest.fn(),
		getInstance: jest.fn(() => ({
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			extension: {
				info: jest.fn(),
				error: jest.fn(),
				warn: jest.fn(),
				debug: jest.fn()
			}
		}))
	}
}));