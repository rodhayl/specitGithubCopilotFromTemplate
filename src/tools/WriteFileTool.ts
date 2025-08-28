// Write file tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { ToolContext, FileOperationResult } from './types';

export class WriteFileTool extends BaseTool {
    constructor() {
        super(
            'writeFile',
            'Write content to a file with directory creation and overwrite protection',
            [
                {
                    name: 'path',
                    type: 'string',
                    description: 'Path to the file to write (relative to workspace root)',
                    required: true
                },
                {
                    name: 'content',
                    type: 'string',
                    description: 'Content to write to the file',
                    required: true
                },
                {
                    name: 'createIfMissing',
                    type: 'boolean',
                    description: 'Create the file if it doesn\'t exist',
                    required: false,
                    default: true
                },
                {
                    name: 'overwrite',
                    type: 'boolean',
                    description: 'Overwrite the file if it exists',
                    required: false,
                    default: true
                }
            ]
        );
    }

    protected getRequirements() {
        return {
            requiresWorkspace: true,
            requiresFileSystem: true,
            workspaceOptional: false
        };
    }

    async execute(params: any, context: ToolContext): Promise<FileOperationResult> {
        this.log(`Writing file: ${params.path}`);

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

        // Validate file size if file exists
        const sizeValidation = await this.securityManager.validateFileSize(params.path);
        if (!sizeValidation.valid) {
            return this.createErrorResult(sizeValidation.error!);
        }

        // Sanitize content
        const sanitizedContent = this.securityManager.sanitizeInput(params.content);

        try {
            const absolutePath = path.resolve(context.workspaceRoot, params.path);
            const fileUri = vscode.Uri.file(absolutePath);
            const dirUri = vscode.Uri.file(path.dirname(absolutePath));

            // Check if file already exists
            let fileExists = false;
            let isDirectory = false;
            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                fileExists = true;
                isDirectory = stat.type === vscode.FileType.Directory;
            } catch {
                // File doesn't exist, which is fine
            }

            // Handle directory conflict
            if (isDirectory) {
                return this.createErrorResult(`Path '${params.path}' is a directory, cannot write file`);
            }

            // Handle existing file
            if (fileExists && !params.overwrite) {
                return this.createErrorResult(`File '${params.path}' already exists and overwrite is disabled`);
            }

            // Handle missing file
            if (!fileExists && !params.createIfMissing) {
                return this.createErrorResult(`File '${params.path}' does not exist and createIfMissing is disabled`);
            }

            // Create directory if it doesn't exist
            try {
                await vscode.workspace.fs.createDirectory(dirUri);
            } catch (error) {
                // Directory might already exist, which is fine
                this.log(`Directory creation info: ${error instanceof Error ? error.message : 'Unknown'}`, 'info');
            }

            // Create secure backup if overwriting existing file
            let backupPath: string | null = null;
            if (fileExists && params.overwrite) {
                backupPath = await this.securityManager.createSecureBackup(params.path);
                if (backupPath) {
                    this.log(`Created secure backup: ${backupPath}`);
                } else {
                    this.log('Warning: Could not create backup', 'warn');
                }
            }

            // Write the file with sanitized content
            const contentBuffer = Buffer.from(sanitizedContent, 'utf8');
            await vscode.workspace.fs.writeFile(fileUri, contentBuffer);

            const bytesWritten = contentBuffer.length;
            this.log(`Successfully wrote file: ${params.path} (${bytesWritten} bytes)`);

            return {
                success: true,
                data: {
                    content: sanitizedContent,
                    path: params.path,
                    bytes: bytesWritten
                },
                path: params.path,
                bytes: bytesWritten,
                created: !fileExists,
                modified: fileExists,
                metadata: {
                    operation: 'write',
                    path: params.path,
                    size: bytesWritten,
                    created: !fileExists,
                    overwritten: fileExists,
                    backupPath: backupPath,
                    contentSanitized: sanitizedContent !== params.content
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error writing file: ${errorMessage}`, 'error');
            return this.createErrorResult(`Failed to write file '${params.path}': ${errorMessage}`);
        }
    }
}