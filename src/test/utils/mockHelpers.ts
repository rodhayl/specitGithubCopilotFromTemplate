// Utility functions for creating and managing mocks in tests
// VSCode is mocked globally in setup.ts

import * as vscode from 'vscode';

export class MockHelper {
  /**
   * Reset all VSCode mocks to their initial state
   */
  static resetAllMocks(): void {
    jest.clearAllMocks();
    
    // Reset workspace mocks
    (vscode.workspace.openTextDocument as jest.Mock).mockReset();
    (vscode.workspace.applyEdit as jest.Mock).mockReset();
    (vscode.workspace.fs.createDirectory as jest.Mock).mockReset();
    (vscode.workspace.fs.writeFile as jest.Mock).mockReset();
    (vscode.workspace.fs.readFile as jest.Mock).mockReset();
    
    // Reset Uri mocks
    (vscode.Uri.file as jest.Mock).mockReset();
    (vscode.Uri.parse as jest.Mock).mockReset();
    (vscode.Uri.joinPath as jest.Mock).mockReset();
    
    // Reset window mocks
    (vscode.window.showInformationMessage as jest.Mock).mockReset();
    (vscode.window.showWarningMessage as jest.Mock).mockReset();
    (vscode.window.showErrorMessage as jest.Mock).mockReset();
  }

  /**
   * Setup common mock return values for typical test scenarios
   */
  static setupCommonMocks(): void {
    // Setup default return values
    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
      getText: jest.fn().mockReturnValue(''),
      positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
      uri: { fsPath: '/test/path' }
    });
    
    (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);
    (vscode.Uri.file as jest.Mock).mockReturnValue({ fsPath: '/test/path' });
    (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);
  }

  /**
   * Create a mock text document with specified content
   */
  static createMockTextDocument(content: string, filePath: string = '/test/document.md') {
    return {
      getText: jest.fn().mockReturnValue(content),
      positionAt: jest.fn().mockImplementation((offset: number) => ({
        line: Math.floor(offset / 50), // Rough approximation
        character: offset % 50
      })),
      lineAt: jest.fn().mockImplementation((line: number) => ({
        text: content.split('\n')[line] || '',
        range: { start: { line, character: 0 }, end: { line, character: 100 } }
      })),
      uri: { fsPath: filePath },
      fileName: filePath.split('/').pop(),
      languageId: 'markdown'
    };
  }

  /**
   * Setup workspace mock to return specific document content
   */
  static mockDocumentContent(filePath: string, content: string): void {
    const mockDoc = MockHelper.createMockTextDocument(content, filePath);
    (vscode.workspace.openTextDocument as jest.Mock).mockImplementation((uri: any) => {
      if (uri.fsPath === filePath || uri === filePath) {
        return Promise.resolve(mockDoc);
      }
      return Promise.reject(new Error('File not found'));
    });
  }

  /**
   * Setup workspace edit mock to track changes
   */
  static setupWorkspaceEditTracking(): jest.Mock[] {
    const editMocks = {
      createFile: jest.fn(),
      replace: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn()
    };

    (vscode.WorkspaceEdit as jest.Mock).mockImplementation(() => editMocks);
    
    return Object.values(editMocks);
  }
}

export default MockHelper;