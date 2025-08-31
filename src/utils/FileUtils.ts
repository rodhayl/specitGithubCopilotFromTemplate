import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../logging/Logger';
import { StringUtils } from './StringUtils';
import { ErrorHandler, ErrorCategory, withErrorHandling } from './ErrorHandler';
import { PerformanceMonitor, withPerformanceMonitoring } from './PerformanceMonitor';

export interface FileCreationOptions {
    overwrite?: boolean;
    createDirectories?: boolean;
    encoding?: string;
}

export interface FileCreationResult {
    success: boolean;
    filePath?: string;
    fileSize?: number;
    created?: boolean;
    overwritten?: boolean;
    error?: string;
}

export interface PathValidationResult {
    valid: boolean;
    errors: string[];
    normalizedPath?: string;
}

export interface FileMetadata {
    path: string;
    size: number;
    created: Date;
    modified: Date;
    exists: boolean;
}

/**
 * Utility functions for safe file operations and path handling
 */
export class FileUtils {
    private static logger: Logger | undefined;
    
    private static getLogger(): Logger {
        if (!FileUtils.logger) {
            try {
                FileUtils.logger = Logger.getInstance();
            } catch (error) {
                // Logger not initialized yet, use console as fallback
                console.warn('Logger not initialized in FileUtils, using console fallback');
                return null as any; // Will be handled by caller
            }
        }
        return FileUtils.logger;
    }

    /**
     * Create a file with content safely
     */
    static async createFile(
        filePath: string,
        content: string,
        options: FileCreationOptions = {}
    ): Promise<FileCreationResult> {
        try {
            const {
                overwrite = false,
                createDirectories = true,
                encoding = 'utf8'
            } = options;

            FileUtils.getLogger()?.info('file', 'Creating file', { filePath, contentLength: content.length, options });

            // Validate the path
            const pathValidation = this.validatePath(filePath);
            if (!pathValidation.valid) {
                return {
                    success: false,
                    error: `Invalid path: ${pathValidation.errors.join(', ')}`
                };
            }

            const normalizedPath = pathValidation.normalizedPath!;
            const uri = vscode.Uri.file(normalizedPath);

            // Check if file exists
            let fileExists = false;
            let wasOverwritten = false;
            try {
                await vscode.workspace.fs.stat(uri);
                fileExists = true;
            } catch {
                // File doesn't exist, which is fine
            }

            if (fileExists && !overwrite) {
                return {
                    success: false,
                    error: `File already exists: ${normalizedPath}. Use overwrite option to replace it.`
                };
            }

            if (fileExists && overwrite) {
                wasOverwritten = true;
                FileUtils.getLogger()?.info('file', 'Overwriting existing file', { filePath: normalizedPath });
            }

            // Create directories if needed
            if (createDirectories) {
                const dirPath = path.dirname(normalizedPath);
                await this.ensureDirectoryExists(dirPath);
            }

            // Write the file
            const buffer = Buffer.from(content, encoding as BufferEncoding);
            await vscode.workspace.fs.writeFile(uri, buffer);

            // Get file stats
            const stats = await vscode.workspace.fs.stat(uri);

            FileUtils.getLogger()?.info('file', 'File created successfully', {
                filePath: normalizedPath,
                fileSize: stats.size,
                overwritten: wasOverwritten
            });

            return {
                success: true,
                filePath: normalizedPath,
                fileSize: stats.size,
                created: !fileExists,
                overwritten: wasOverwritten
            };

        } catch (error) {
            const errorHandler = ErrorHandler.getInstance();
            const errorInfo = errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), { 
                operation: 'createFile', 
                filePath: filePath 
            });
            
            return {
                success: false,
                error: errorInfo.userMessage
            };
        }
    }

    /**
     * Generate a safe file path from title and template
     */
    static generateSafeFilePath(
        title: string,
        templateId: string,
        customPath?: string,
        workspaceRoot?: string
    ): string {
        if (customPath) {
            const sanitizedTitle = FileUtils.sanitizeFilename(title);
            const normalized = this.normalizePath(customPath);
            // If customPath ends with a directory separator or is a directory,
            // append the sanitized title as filename
            const fullPath = path.join(normalized, `${sanitizedTitle}.md`);
            return fullPath;
        }

        const sanitizedTitle = FileUtils.sanitizeFilename(title);
        const baseDir = workspaceRoot || this.getWorkspaceRoot();
        
        // Generate path based on template type
        let relativePath: string;
        switch (templateId) {
            case 'prd':
                relativePath = path.join('docs', 'prd', `${sanitizedTitle}.md`);
                break;
            case 'requirements':
                relativePath = path.join('docs', 'requirements', `${sanitizedTitle}.md`);
                break;
            case 'design':
                relativePath = path.join('docs', 'design', `${sanitizedTitle}.md`);
                break;
            case 'specification':
                relativePath = path.join('docs', 'specs', `${sanitizedTitle}.md`);
                break;
            default:
                relativePath = path.join('docs', `${sanitizedTitle}.md`);
        }

        return path.join(baseDir, relativePath);
    }

    /**
     * Validate a file path for security and correctness
     */
    static validatePath(filePath: string): PathValidationResult {
        const errors: string[] = [];

        try {
            // Normalize the path
            const normalizedPath = FileUtils.normalizePath(filePath);

            // Check for absolute paths outside workspace
            if (path.isAbsolute(filePath)) {
                const workspaceRoot = this.getWorkspaceRoot();
                if (!normalizedPath.startsWith(workspaceRoot)) {
                    errors.push('Path must be within workspace');
                }
            }

            // Check for directory traversal
            if (filePath.includes('..')) {
                errors.push('Path cannot contain ".." segments');
            }

            // Check for invalid characters
            const invalidChars = /[<>:"|?*\x00-\x1f]/;
            if (invalidChars.test(path.basename(filePath))) {
                errors.push('Filename contains invalid characters');
            }

            // Check path length
            if (normalizedPath.length > 260) {
                errors.push('Path is too long (max 260 characters)');
            }

            // Check for reserved names on Windows
            const basename = path.basename(filePath, path.extname(filePath));
            const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
            if (reservedNames.includes(basename.toUpperCase())) {
                errors.push('Filename is a reserved system name');
            }

            return {
                valid: errors.length === 0,
                errors,
                normalizedPath: errors.length === 0 ? normalizedPath : undefined
            };

        } catch (error) {
            errors.push(`Path validation error: ${error instanceof Error ? error.message : String(error)}`);
            return { valid: false, errors };
        }
    }

    /**
     * Ensure a directory exists, creating it if necessary
     */
    static async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(dirPath);
            await vscode.workspace.fs.stat(uri);
            FileUtils.getLogger()?.debug('file', 'Directory already exists', { dirPath });
        } catch (error) {
            // Directory doesn't exist, create it
            const uri = vscode.Uri.file(dirPath);
            await vscode.workspace.fs.createDirectory(uri);
            FileUtils.getLogger()?.info('file', 'Created directory', { dirPath });
        }
    }

    /**
     * Get file metadata
     */
    static async getFileMetadata(filePath: string): Promise<FileMetadata> {
        try {
            const uri = vscode.Uri.file(filePath);
            const stats = await vscode.workspace.fs.stat(uri);
            
            return {
                path: filePath,
                size: stats.size,
                created: new Date(stats.ctime),
                modified: new Date(stats.mtime),
                exists: true
            };
        } catch (error) {
            return {
                path: filePath,
                size: 0,
                created: new Date(0),
                modified: new Date(0),
                exists: false
            };
        }
    }

    /**
     * Calculate file size in human-readable format
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) {return '0 B';}
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    /**
     * Check if a file exists
     */
    static async fileExists(filePath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Generate a unique filename if the original exists
     */
    static async generateUniqueFilename(filePath: string): Promise<string> {
        if (!(await this.fileExists(filePath))) {
            return filePath;
        }

        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);

        let counter = 1;
        let uniquePath: string;

        do {
            uniquePath = path.join(dir, `${basename}-${counter}${ext}`);
            counter++;
        } while (await this.fileExists(uniquePath));

        return uniquePath;
    }

    /**
     * Sanitize a filename for safe file system usage
     */
    static sanitizeFilename(filename: string): string {
        const sanitized = StringUtils.sanitizeForFilename(filename);
        return sanitized.substring(0, 100); // Limit length
    }

    /**
     * Normalize a file path
     */
    private static normalizePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return path.normalize(filePath);
        }

        const workspaceRoot = this.getWorkspaceRoot();
        return path.normalize(path.join(workspaceRoot, filePath));
    }

    /**
     * Ensure a path has .md extension
     */
    private static ensureMarkdownExtension(filePath: string): string {
        if (path.extname(filePath) === '') {
            return `${filePath}.md`;
        }
        return filePath;
    }

    /**
     * Read file content as string
     */
    static async readFile(filePath: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(content).toString('utf8');
        } catch (error) {
            FileUtils.getLogger()?.error('file', 'Failed to read file', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Write content to file
     */
    static async writeFile(filePath: string, content: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const buffer = Buffer.from(content, 'utf8');
            await vscode.workspace.fs.writeFile(uri, buffer);
            FileUtils.getLogger()?.info('file', 'File written successfully', { filePath, contentLength: content.length });
        } catch (error) {
            FileUtils.getLogger()?.error('file', 'Failed to write file', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Get the workspace root directory
     */
    private static getWorkspaceRoot(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder is open');
        }
        return workspaceFolder.uri.fsPath;
    }
}