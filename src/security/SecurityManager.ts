// Security Manager for comprehensive security measures
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../logging/Logger';

export interface SecurityValidationResult {
    valid: boolean;
    error?: string;
    warnings?: string[];
}

export interface FileConflictInfo {
    exists: boolean;
    lastModified?: Date;
    size?: number;
    hasChanges?: boolean;
}

export interface WorkspaceDetectionResult {
    hasWorkspace: boolean;
    workspaceFolders: readonly vscode.WorkspaceFolder[];
    primaryWorkspace?: vscode.WorkspaceFolder;
    isMultiRoot: boolean;
    permissions?: {
        canRead: boolean;
        canWrite: boolean;
    };
}

export class SecurityManager {
    private readonly workspaceRoot: string;
    private readonly maxFileSize = 10 * 1024 * 1024; // 10MB limit
    private readonly allowedExtensions = ['.md', '.txt', '.json', '.yaml', '.yml'];
    private readonly blockedPaths = ['node_modules', '.git', '.vscode', 'dist', 'build', 'out'];
    private logger: Logger;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = path.normalize(workspaceRoot);
        this.logger = Logger.getInstance();
    }

    /**
     * Validate that a file path is within workspace boundaries and safe
     */
    validateWorkspacePath(filePath: string): SecurityValidationResult {
        try {
            // Normalize the path to prevent directory traversal
            const normalizedPath = path.normalize(filePath);
            
            // Check for directory traversal attempts
            if (normalizedPath.includes('..')) {
                return {
                    valid: false,
                    error: 'Path contains directory traversal sequences (..)'
                };
            }

            // Resolve to absolute path
            const absolutePath = path.resolve(this.workspaceRoot, normalizedPath);
            const normalizedAbsolute = path.normalize(absolutePath);
            const normalizedWorkspace = path.normalize(this.workspaceRoot);

            // Ensure path is within workspace
            if (!normalizedAbsolute.startsWith(normalizedWorkspace + path.sep) && 
                normalizedAbsolute !== normalizedWorkspace) {
                return {
                    valid: false,
                    error: `Path '${filePath}' is outside the workspace boundary`
                };
            }

            // Check for blocked directories
            const relativePath = path.relative(this.workspaceRoot, normalizedAbsolute);
            const pathParts = relativePath.split(path.sep);
            
            for (const blockedPath of this.blockedPaths) {
                if (pathParts.includes(blockedPath)) {
                    return {
                        valid: false,
                        error: `Access to '${blockedPath}' directory is not allowed`
                    };
                }
            }

            // Check file extension
            const ext = path.extname(normalizedPath).toLowerCase();
            if (ext && !this.allowedExtensions.includes(ext)) {
                return {
                    valid: false,
                    error: `File extension '${ext}' is not allowed. Allowed extensions: ${this.allowedExtensions.join(', ')}`
                };
            }

            return { valid: true };

        } catch (error) {
            return {
                valid: false,
                error: `Path validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Check for file conflicts and get file information
     */
    async checkFileConflict(filePath: string): Promise<FileConflictInfo> {
        try {
            const absolutePath = path.resolve(this.workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(absolutePath);

            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                return {
                    exists: true,
                    lastModified: new Date(stat.mtime),
                    size: stat.size,
                    hasChanges: false // Will be determined by caller if needed
                };
            } catch {
                return { exists: false };
            }
        } catch (error) {
            return { exists: false };
        }
    }

    /**
     * Validate file size before operations
     */
    async validateFileSize(filePath: string): Promise<SecurityValidationResult> {
        try {
            const absolutePath = path.resolve(this.workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(absolutePath);

            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                if (stat.size > this.maxFileSize) {
                    return {
                        valid: false,
                        error: `File size (${Math.round(stat.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.maxFileSize / 1024 / 1024)}MB)`
                    };
                }
            } catch {
                // File doesn't exist, size validation not needed
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: `File size validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Sanitize user input to prevent injection attacks
     */
    sanitizeInput(input: string): string {
        if (typeof input !== 'string') {
            return '';
        }

        // Remove potentially dangerous characters and sequences
        return input
            // Remove complete HTML/XML tags while preserving inner content
            .replace(/<[^>]*>/g, '')
            // Remove protocol handlers
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '')
            .replace(/vbscript:/gi, '')
            // Remove event handlers with their values (including quoted content)
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
            .trim();
    }

    /**
     * Create a secure backup of a file before modification
     */
    async createSecureBackup(filePath: string): Promise<string | null> {
        try {
            const absolutePath = path.resolve(this.workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(absolutePath);
            
            // Check if file exists
            try {
                await vscode.workspace.fs.stat(fileUri);
            } catch {
                return null; // File doesn't exist, no backup needed
            }

            // Create backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${absolutePath}.backup.${timestamp}`;
            const backupUri = vscode.Uri.file(backupPath);

            // Copy file to backup location
            await vscode.workspace.fs.copy(fileUri, backupUri);

            return path.relative(this.workspaceRoot, backupPath);
        } catch (error) {
            this.logger.extension.warn(`Failed to create backup for ${filePath}`, error as Error);
            return null;
        }
    }

    /**
     * Detect workspace state with enhanced information
     */
    async detectWorkspaceState(): Promise<WorkspaceDetectionResult> {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const hasWorkspace = workspaceFolders.length > 0;
        const isMultiRoot = workspaceFolders.length > 1;
        const primaryWorkspace = workspaceFolders[0];

        let permissions: { canRead: boolean; canWrite: boolean } | undefined;

        if (hasWorkspace && primaryWorkspace) {
            try {
                // Test read permissions
                const testReadPath = path.join(primaryWorkspace.uri.fsPath, 'package.json');
                let canRead = true;
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(testReadPath));
                } catch {
                    // Try reading the directory itself
                    try {
                        await vscode.workspace.fs.readDirectory(primaryWorkspace.uri);
                    } catch {
                        canRead = false;
                    }
                }

                // Test write permissions
                let canWrite = true;
                try {
                    const testPath = path.join(primaryWorkspace.uri.fsPath, '.docu-test-' + Date.now());
                    const testUri = vscode.Uri.file(testPath);
                    await vscode.workspace.fs.writeFile(testUri, Buffer.from('test'));
                    await vscode.workspace.fs.delete(testUri);
                } catch {
                    canWrite = false;
                }

                permissions = { canRead, canWrite };
            } catch (error) {
                permissions = { canRead: false, canWrite: false };
            }
        }

        return {
            hasWorkspace,
            workspaceFolders,
            primaryWorkspace,
            isMultiRoot,
            permissions
        };
    }

    /**
     * Validate workspace state and permissions
     */
    async validateWorkspaceState(): Promise<SecurityValidationResult> {
        const warnings: string[] = [];

        try {
            // Check if workspace is available
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return {
                    valid: false,
                    error: 'No workspace folder is open'
                };
            }

            // Check workspace permissions
            const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
            try {
                // Try to create a temporary file to test write permissions
                const testPath = path.join(this.workspaceRoot, '.docu-test-' + Date.now());
                const testUri = vscode.Uri.file(testPath);
                
                await vscode.workspace.fs.writeFile(testUri, Buffer.from('test'));
                await vscode.workspace.fs.delete(testUri);
            } catch (error) {
                return {
                    valid: false,
                    error: 'Insufficient permissions to write to workspace'
                };
            }

            // Check for Git repository (warning only)
            const gitPath = path.join(this.workspaceRoot, '.git');
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(gitPath));
                warnings.push('Git repository detected - consider using version control for document changes');
            } catch {
                // No git repository, which is fine
            }

            return { 
                valid: true, 
                warnings: warnings.length > 0 ? warnings : undefined 
            };

        } catch (error) {
            return {
                valid: false,
                error: `Workspace validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get security recommendations for the current workspace
     */
    getSecurityRecommendations(): string[] {
        const recommendations: string[] = [];

        recommendations.push('Always review generated content before saving to files');
        recommendations.push('Use version control (Git) to track document changes');
        recommendations.push('Regularly backup important documentation');
        recommendations.push('Limit file operations to trusted directories');
        recommendations.push('Review file permissions in your workspace');

        return recommendations;
    }
}