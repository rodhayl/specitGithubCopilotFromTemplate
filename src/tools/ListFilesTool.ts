// List files tool implementation
import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { ToolContext, ToolResult, FileMetadata } from './types';

/**
 * ListFilesTool - Lists files in a directory
 *
 * Provides directory listing with glob pattern support, filtering,
 * and security validation. Returns file paths and metadata.
 */
export class ListFilesTool extends BaseTool {
    constructor() {
        super(
            'listFiles',
            'List files in a directory with glob pattern support',
            [
                {
                    name: 'dir',
                    type: 'string',
                    description: 'Directory to list (relative to workspace root, defaults to root)',
                    required: false,
                    default: '.'
                },
                {
                    name: 'glob',
                    type: 'string',
                    description: 'Glob pattern to filter files (e.g., "*.md", "**/*.ts")',
                    required: false
                },
                {
                    name: 'includeDirectories',
                    type: 'boolean',
                    description: 'Include directories in the results',
                    required: false,
                    default: false
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

    async execute(params: any, context: ToolContext): Promise<ToolResult> {
        const dir = params.dir || '.';
        this.log(`Listing files in: ${dir}${params.glob ? ` with pattern: ${params.glob}` : ''}`);

        // Validate parameters
        const validation = this.validateParameters(params);
        if (!validation.valid) {
            return this.createErrorResult(`Parameter validation failed: ${validation.errors.join(', ')}`);
        }

        // Validate workspace path
        const pathValidation = this.validateWorkspacePath(dir, context.workspaceRoot);
        if (!pathValidation.valid) {
            return this.createErrorResult(pathValidation.error!);
        }

        try {
            let files: vscode.Uri[] = [];

            if (params.glob) {
                // Use glob pattern search
                const pattern = new vscode.RelativePattern(
                    vscode.Uri.file(path.resolve(context.workspaceRoot, dir)),
                    params.glob
                );
                files = await vscode.workspace.findFiles(pattern, null, 1000);
            } else {
                // List directory contents
                const absolutePath = path.resolve(context.workspaceRoot, dir);
                const dirUri = vscode.Uri.file(absolutePath);

                try {
                    const entries = await vscode.workspace.fs.readDirectory(dirUri);
                    files = entries.map(([name, type]) => {
                        const filePath = path.join(absolutePath, name);
                        return vscode.Uri.file(filePath);
                    }).filter(async (uri) => {
                        if (!params.includeDirectories) {
                            try {
                                const stat = await vscode.workspace.fs.stat(uri);
                                return stat.type !== vscode.FileType.Directory;
                            } catch {
                                return false;
                            }
                        }
                        return true;
                    });
                } catch (error) {
                    return this.createErrorResult(`Directory '${dir}' does not exist or cannot be accessed`);
                }
            }

            // Get metadata for each file
            const fileMetadata: FileMetadata[] = [];
            for (const fileUri of files) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    const relativePath = path.relative(context.workspaceRoot, fileUri.fsPath);
                    
                    // Skip directories if not requested
                    if (!params.includeDirectories && stat.type === vscode.FileType.Directory) {
                        continue;
                    }

                    fileMetadata.push({
                        path: relativePath,
                        size: stat.size,
                        mtime: new Date(stat.mtime),
                        exists: true,
                        isDirectory: stat.type === vscode.FileType.Directory
                    });
                } catch (error) {
                    // Skip files that can't be accessed
                    this.log(`Warning: Could not access file ${fileUri.fsPath}`, 'warn');
                }
            }

            // Sort by path
            fileMetadata.sort((a, b) => a.path.localeCompare(b.path));

            this.log(`Found ${fileMetadata.length} files`);

            return this.createSuccessResult(
                fileMetadata,
                {
                    operation: 'list',
                    directory: dir,
                    pattern: params.glob,
                    count: fileMetadata.length,
                    includeDirectories: params.includeDirectories
                }
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.log(`Error listing files: ${errorMessage}`, 'error');
            return this.createErrorResult(`Failed to list files in '${dir}': ${errorMessage}`);
        }
    }
}