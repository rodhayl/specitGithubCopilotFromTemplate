// Open in editor tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult } from './types';

export class OpenInEditorTool extends BaseTool {
    constructor() {
        super(
            'openInEditor',
            'Open a file in the VS Code editor',
            [
                {
                    name: 'path',
                    type: 'string',
                    description: 'Path to the file to open (relative to workspace root)',
                    required: true
                },
                {
                    name: 'preview',
                    type: 'boolean',
                    description: 'Open in preview mode (tab will be replaced by next file)',
                    required: false,
                    default: false
                },
                {
                    name: 'viewColumn',
                    type: 'number',
                    description: 'Editor column to open in (1=left, 2=right, etc.)',
                    required: false,
                    default: 1
                }
            ]
        );
    }

    async execute(params: any, context: ToolContext): Promise<ToolResult> {
        this.log(`Opening file in editor: ${params.path}`);

        // Validate parameters
        const validation = this.validateParameters(params);
        if (!validation.valid) {
            return this.createErrorResult(`Parameter validation failed: ${validation.errors.join(', ')}`);
        }

        // Validate workspace path
        const pathValidation = this.validateWorkspacePath(params.path, context.workspaceRoot);
        if (!pathValidation.valid) {
            return this.createErrorResult(pathValidation.error!);
        }

        try {
            const absolutePath = path.resolve(context.workspaceRoot, params.path);
            const fileUri = vscode.Uri.file(absolutePath);

            // Check if file exists
            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                if (stat.type === vscode.FileType.Directory) {
                    return this.createErrorResult(`Path '${params.path}' is a directory, cannot open in editor`);
                }
            } catch (error) {
                return this.createErrorResult(`File '${params.path}' does not exist or cannot be accessed`);
            }

            // Determine view column
            let viewColumn: vscode.ViewColumn;
            switch (params.viewColumn) {
                case 1:
                    viewColumn = vscode.ViewColumn.One;
                    break;
                case 2:
                    viewColumn = vscode.ViewColumn.Two;
                    break;
                case 3:
                    viewColumn = vscode.ViewColumn.Three;
                    break;
                default:
                    viewColumn = vscode.ViewColumn.Active;
            }

            // Open the file
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document, {
                viewColumn,
                preview: params.preview,
                preserveFocus: false
            });

            this.log(`Successfully opened file: ${params.path} in column ${params.viewColumn}`);

            return this.createSuccessResult(
                {
                    path: params.path,
                    opened: true,
                    viewColumn: params.viewColumn,
                    preview: params.preview,
                    lineCount: document.lineCount
                },
                {
                    operation: 'openInEditor',
                    path: params.path,
                    viewColumn: params.viewColumn,
                    preview: params.preview
                }
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error opening file: ${errorMessage}`, 'error');
            return this.createErrorResult(`Failed to open file '${params.path}': ${errorMessage}`);
        }
    }
}