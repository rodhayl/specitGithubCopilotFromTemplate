import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { ToolResult } from './types';

interface InsertSectionParams {
    path: string;
    header: string;
    mode: 'replace' | 'append' | 'prepend';
    content: string;
}

interface SectionInfo {
    startLine: number;
    endLine: number;
    level: number;
    title: string;
}

export class InsertSectionTool extends BaseTool {
    name = 'insertSection';
    description = 'Update specific sections in Markdown documents';

    async execute(params: InsertSectionParams): Promise<ToolResult> {
        try {
            const { path, header, mode, content } = params;
            
            // Validate workspace path
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, path);
            
            // Read existing file
            let existingContent = '';
            try {
                const fileData = await vscode.workspace.fs.readFile(fullPath);
                existingContent = Buffer.from(fileData).toString('utf8');
            } catch (error) {
                throw new Error(`File not found: ${path}. Use /new command to create it first.`);
            }

            const lines = existingContent.split('\n');
            const sections = this.parseMarkdownSections(lines);
            const targetSection = this.findSection(sections, header);

            let newContent: string;
            let diff: string;

            if (targetSection) {
                // Section exists, update it
                newContent = this.updateExistingSection(lines, targetSection, content, mode);
                diff = this.generateDiff(existingContent, newContent);
            } else {
                // Section doesn't exist, create it
                newContent = this.createNewSection(existingContent, header, content);
                diff = `+ Added new section: ${header}`;
            }

            // Write updated content
            await vscode.workspace.fs.writeFile(fullPath, Buffer.from(newContent, 'utf8'));

            return {
                success: true,
                message: `Updated section "${header}" in ${path}`,
                data: {
                    path,
                    changed: newContent !== existingContent,
                    diff,
                    mode: targetSection ? mode : 'create'
                }
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to update section: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private parseMarkdownSections(lines: string[]): SectionInfo[] {
        const sections: SectionInfo[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
            
            if (headerMatch) {
                const level = headerMatch[1].length;
                const title = headerMatch[2].trim();
                
                sections.push({
                    startLine: i,
                    endLine: this.findSectionEnd(lines, i, level),
                    level,
                    title
                });
            }
        }
        
        return sections;
    }

    private findSectionEnd(lines: string[], startLine: number, level: number): number {
        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const headerMatch = line.match(/^(#{1,6})\s+/);
            
            if (headerMatch && headerMatch[1].length <= level) {
                return i - 1;
            }
        }
        
        return lines.length - 1;
    }

    private findSection(sections: SectionInfo[], targetHeader: string): SectionInfo | undefined {
        const normalizedTarget = targetHeader.toLowerCase().replace(/^#+\s*/, '');
        
        return sections.find(section => 
            section.title.toLowerCase() === normalizedTarget ||
            section.title.toLowerCase().includes(normalizedTarget) ||
            normalizedTarget.includes(section.title.toLowerCase())
        );
    }

    private updateExistingSection(
        lines: string[], 
        section: SectionInfo, 
        content: string, 
        mode: 'replace' | 'append' | 'prepend'
    ): string {
        const newLines = [...lines];
        const contentLines = content.split('\n');
        
        switch (mode) {
            case 'replace':
                // Replace content between header and next section
                newLines.splice(section.startLine + 1, section.endLine - section.startLine, ...contentLines);
                break;
                
            case 'append':
                // Add content at the end of the section
                newLines.splice(section.endLine + 1, 0, ...contentLines);
                break;
                
            case 'prepend':
                // Add content right after the header
                newLines.splice(section.startLine + 1, 0, ...contentLines);
                break;
        }
        
        return newLines.join('\n');
    }

    private createNewSection(existingContent: string, header: string, content: string): string {
        const headerLine = header.startsWith('#') ? header : `## ${header}`;
        const newSection = `\n\n${headerLine}\n\n${content}`;
        
        return existingContent + newSection;
    }

    private generateDiff(oldContent: string, newContent: string): string {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        const changes: string[] = [];
        const maxLines = Math.max(oldLines.length, newLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';
            
            if (oldLine !== newLine) {
                if (oldLine && !newLine) {
                    changes.push(`- ${oldLine}`);
                } else if (!oldLine && newLine) {
                    changes.push(`+ ${newLine}`);
                } else {
                    changes.push(`- ${oldLine}`);
                    changes.push(`+ ${newLine}`);
                }
            }
        }
        
        return changes.slice(0, 10).join('\n') + (changes.length > 10 ? '\n... (truncated)' : '');
    }
}