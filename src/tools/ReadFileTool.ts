// Read file tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult, FileMetadata } from './types';

export class ReadFileTool extends BaseTool {
    constructor() {
        super(
            'readFile',
            'Read the contents of a file with error handling and workspace validation',
            [
                {
                    name: 'path',
                    type: 'string',
                    description: 'Path to the file to read (relative to workspace root)',
                    required: true
                }
            ]
        );
    }

    async execute(params: any, context: ToolContext): Promise<ToolResult> {
        this.log(`Reading file: ${params.path}`);

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

            // Check if file exists and get metadata
            let metadata: FileMetadata;
            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                metadata = {
                    path: params.path,
                    size: stat.size,
                    mtime: new Date(stat.mtime),
                    exists: true,
                    isDirectory: stat.type === vscode.FileType.Directory
                };

                if (metadata.isDirectory) {
                    return this.createErrorResult(`Path '${params.path}' is a directory, not a file`);
                }
            } catch (error) {
                return this.createErrorResult(`File '${params.path}' does not exist or cannot be accessed`);
            }

            // Read file contents
            const fileData = await vscode.workspace.fs.readFile(fileUri);
            const content = Buffer.from(fileData).toString('utf8');

            this.log(`Successfully read file: ${params.path} (${metadata.size} bytes)`);

            return this.createSuccessResult(
                {
                    content,
                    metadata
                },
                {
                    operation: 'read',
                    path: params.path,
                    size: metadata.size
                }
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error reading file: ${errorMessage}`, 'error');
            return this.createErrorResult(`Failed to read file '${params.path}': ${errorMessage}`);
        }
    }
}