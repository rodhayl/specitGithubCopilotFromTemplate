// ContentCapture implementation for automatic document updates
import * as vscode from 'vscode';
import * as path from 'path';
import {
    ContentCapture as IContentCapture,
    UpdateResult,
    DocumentUpdate,
    DocumentChange,
    ValidationResult,
    ConversationData,
    DocumentUpdateError
} from './types';

export class ContentCapture implements IContentCapture {
    private changeHistory: Map<string, DocumentChange[]> = new Map();
    private sectionTemplates: Map<string, string> = new Map();

    constructor() {
        this.initializeSectionTemplates();
    }

    async updateDocument(documentPath: string, updates: DocumentUpdate[]): Promise<UpdateResult> {
        try {
            const uri = vscode.Uri.file(documentPath);
            let document: vscode.TextDocument;

            try {
                document = await vscode.workspace.openTextDocument(uri);
            } catch (error) {
                // Document doesn't exist, create it
                await this.createDocument(documentPath);
                document = await vscode.workspace.openTextDocument(uri);
            }

            const updatedSections: string[] = [];
            const errors: string[] = [];
            const warnings: string[] = [];
            const changes: DocumentChange[] = [];

            let content = document.getText();

            for (const update of updates) {
                try {
                    const result = await this.applyUpdate(content, update);
                    content = result.newContent;
                    updatedSections.push(update.section);
                    
                    changes.push({
                        section: update.section,
                        oldContent: result.oldContent,
                        newContent: update.content,
                        changeType: this.getChangeType(result.oldContent, update.content),
                        timestamp: new Date(),
                        source: 'conversation'
                    });
                } catch (error) {
                    errors.push(`Failed to update section ${update.section}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Write the updated content back to the file
            if (errors.length === 0) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                );
                edit.replace(uri, fullRange, content);
                
                const success = await vscode.workspace.applyEdit(edit);
                if (!success) {
                    errors.push('Failed to apply document edits');
                }
            }

            // Track changes
            this.trackChanges(documentPath, changes);

            const changesSummary = this.generateChangesSummary(changes);

            return {
                success: errors.length === 0,
                updatedSections,
                errors,
                warnings,
                changesSummary
            };

        } catch (error) {
            throw new DocumentUpdateError(
                `Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                documentPath,
                'unknown',
                'update'
            );
        }
    }

    generateDocumentSection(sectionType: string, conversationData: ConversationData): string {
        const template = this.sectionTemplates.get(sectionType);
        if (!template) {
            return this.generateGenericSection(sectionType, conversationData);
        }

        return this.populateTemplate(template, conversationData);
    }

    validateDocumentStructure(documentPath: string): ValidationResult {
        try {
            // This would implement document structure validation
            // For now, return a basic validation
            return {
                valid: true,
                errors: [],
                warnings: [],
                score: 1.0
            };
        } catch (error) {
            return {
                valid: false,
                errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings: [],
                score: 0.0
            };
        }
    }

    trackChanges(documentPath: string, changes: DocumentChange[]): void {
        const existingChanges = this.changeHistory.get(documentPath) || [];
        existingChanges.push(...changes);
        this.changeHistory.set(documentPath, existingChanges);

        // Keep only the last 100 changes per document
        if (existingChanges.length > 100) {
            this.changeHistory.set(documentPath, existingChanges.slice(-100));
        }
    }

    async getDocumentSections(documentPath: string): Promise<string[]> {
        try {
            const uri = vscode.Uri.file(documentPath);
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();

            return this.extractSections(content);
        } catch (error) {
            return [];
        }
    }

    async extractExistingContent(documentPath: string, section: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(documentPath);
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();

            return this.extractSectionContent(content, section);
        } catch (error) {
            return '';
        }
    }

    private async createDocument(documentPath: string): Promise<void> {
        const uri = vscode.Uri.file(documentPath);
        const dirname = path.dirname(documentPath);
        
        // Ensure directory exists
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname));
        } catch (error) {
            // Directory might already exist
        }

        // Create empty document
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri, { ignoreIfExists: true });
        await vscode.workspace.applyEdit(edit);
    }

    private async applyUpdate(content: string, update: DocumentUpdate): Promise<{ newContent: string; oldContent: string }> {
        const sectionStart = this.findSectionStart(content, update.section);
        const sectionEnd = this.findSectionEnd(content, sectionStart);

        let oldContent = '';
        let newContent = content;

        switch (update.updateType) {
            case 'replace':
                if (sectionStart !== -1) {
                    oldContent = content.substring(sectionStart, sectionEnd);
                    newContent = content.substring(0, sectionStart) + 
                               this.formatSectionContent(update.section, update.content) + 
                               content.substring(sectionEnd);
                } else {
                    // Section doesn't exist, append it
                    newContent = content + '\n\n' + this.formatSectionContent(update.section, update.content);
                }
                break;

            case 'append':
                if (sectionStart !== -1) {
                    oldContent = content.substring(sectionStart, sectionEnd);
                    const insertPoint = sectionEnd;
                    newContent = content.substring(0, insertPoint) + 
                               '\n' + update.content + 
                               content.substring(insertPoint);
                } else {
                    // Section doesn't exist, create it
                    newContent = content + '\n\n' + this.formatSectionContent(update.section, update.content);
                }
                break;

            case 'prepend':
                if (sectionStart !== -1) {
                    const headerEnd = this.findSectionHeaderEnd(content, sectionStart);
                    oldContent = content.substring(sectionStart, sectionEnd);
                    newContent = content.substring(0, headerEnd) + 
                               '\n' + update.content + 
                               content.substring(headerEnd);
                } else {
                    // Section doesn't exist, create it
                    newContent = content + '\n\n' + this.formatSectionContent(update.section, update.content);
                }
                break;

            case 'insert':
                if (update.position !== undefined) {
                    oldContent = '';
                    newContent = content.substring(0, update.position) + 
                               update.content + 
                               content.substring(update.position);
                } else {
                    throw new Error('Insert operation requires position');
                }
                break;

            default:
                throw new Error(`Unknown update type: ${update.updateType}`);
        }

        return { newContent, oldContent };
    }

    private findSectionStart(content: string, sectionName: string): number {
        // Look for markdown headers
        const patterns = [
            new RegExp(`^#{1,6}\\s+${this.escapeRegex(sectionName)}\\s*$`, 'mi'),
            new RegExp(`^#{1,6}\\s+.*${this.escapeRegex(sectionName)}.*$`, 'mi')
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match.index !== undefined) {
                return match.index;
            }
        }

        return -1;
    }

    private findSectionEnd(content: string, sectionStart: number): number {
        if (sectionStart === -1) {
            return content.length;
        }

        const lines = content.substring(sectionStart).split('\n');
        const headerLine = lines[0];
        const headerLevel = this.getHeaderLevel(headerLine);

        // Find the next header of the same or higher level
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (this.isHeader(line)) {
                const level = this.getHeaderLevel(line);
                if (level <= headerLevel) {
                    // Calculate position in original content
                    const endPosition = sectionStart + lines.slice(0, i).join('\n').length;
                    return endPosition;
                }
            }
        }

        return content.length;
    }

    private findSectionHeaderEnd(content: string, sectionStart: number): number {
        const lines = content.substring(sectionStart).split('\n');
        return sectionStart + lines[0].length + 1; // +1 for newline
    }

    private formatSectionContent(sectionName: string, content: string): string {
        // Determine appropriate header level (default to ##)
        const headerLevel = this.determineHeaderLevel(sectionName);
        const header = '#'.repeat(headerLevel) + ' ' + sectionName;
        
        return `${header}\n\n${content}`;
    }

    private extractSections(content: string): string[] {
        const sections: string[] = [];
        const headerPattern = /^(#{1,6})\s+(.+)$/gm;
        let match;

        while ((match = headerPattern.exec(content)) !== null) {
            sections.push(match[2].trim());
        }

        return sections;
    }

    private extractSectionContent(content: string, sectionName: string): string {
        const sectionStart = this.findSectionStart(content, sectionName);
        if (sectionStart === -1) {
            return '';
        }

        const sectionEnd = this.findSectionEnd(content, sectionStart);
        const sectionContent = content.substring(sectionStart, sectionEnd);
        
        // Remove the header line
        const lines = sectionContent.split('\n');
        return lines.slice(1).join('\n').trim();
    }

    private isHeader(line: string): boolean {
        return /^#{1,6}\s+/.test(line);
    }

    private getHeaderLevel(line: string): number {
        const match = line.match(/^(#{1,6})/);
        return match ? match[1].length : 0;
    }

    private determineHeaderLevel(sectionName: string): number {
        // Map common section names to appropriate header levels
        const levelMap: Record<string, number> = {
            'Executive Summary': 2,
            'Introduction': 2,
            'Overview': 2,
            'Requirements': 2,
            'Design': 2,
            'Architecture': 2,
            'Implementation': 2,
            'Testing': 2,
            'Conclusion': 2,
            'User Stories': 3,
            'Acceptance Criteria': 3,
            'Technical Requirements': 3,
            'Business Requirements': 3,
            'Functional Requirements': 3,
            'Non-Functional Requirements': 3
        };

        return levelMap[sectionName] || 2;
    }

    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private getChangeType(oldContent: string, newContent: string): 'addition' | 'modification' | 'deletion' {
        if (oldContent === '') {
            return 'addition';
        } else if (newContent === '') {
            return 'deletion';
        } else {
            return 'modification';
        }
    }

    private generateChangesSummary(changes: DocumentChange[]): string {
        if (changes.length === 0) {
            return 'No changes made';
        }

        const additions = changes.filter(c => c.changeType === 'addition').length;
        const modifications = changes.filter(c => c.changeType === 'modification').length;
        const deletions = changes.filter(c => c.changeType === 'deletion').length;

        const parts: string[] = [];
        if (additions > 0) {
            parts.push(`${additions} section${additions > 1 ? 's' : ''} added`);
        }
        if (modifications > 0) {
            parts.push(`${modifications} section${modifications > 1 ? 's' : ''} modified`);
        }
        if (deletions > 0) {
            parts.push(`${deletions} section${deletions > 1 ? 's' : ''} deleted`);
        }

        return parts.join(', ');
    }

    private initializeSectionTemplates(): void {
        // PRD Templates
        this.sectionTemplates.set('Executive Summary', `
*Brief overview of the product, its purpose, and key value proposition.*

{{summary}}
`);

        this.sectionTemplates.set('Product Objectives', `
### Primary Goals
{{primary_goals}}

### Success Metrics
{{success_metrics}}
`);

        this.sectionTemplates.set('User Personas', `
### Primary User
- **Who:** {{primary_user_who}}
- **Needs:** {{primary_user_needs}}
- **Goals:** {{primary_user_goals}}
- **Context:** {{primary_user_context}}

{{additional_personas}}
`);

        this.sectionTemplates.set('Functional Requirements', `
### Core Features
{{core_features}}

### Nice-to-Have Features
{{nice_to_have_features}}
`);

        // Requirements Templates
        this.sectionTemplates.set('Requirements', `
{{requirements_list}}
`);

        this.sectionTemplates.set('Non-Functional Requirements', `
### Performance Requirements
{{performance_requirements}}

### Security Requirements
{{security_requirements}}

### Usability Requirements
{{usability_requirements}}
`);

        // Design Templates
        this.sectionTemplates.set('Architecture', `
{{architecture_description}}

### Components
{{components_list}}

### Data Flow
{{data_flow_description}}
`);
    }

    private generateGenericSection(sectionType: string, conversationData: ConversationData): string {
        // Generate a basic section based on conversation data
        const responses = Array.from(conversationData.responses.values());
        const relevantResponses = responses.filter(response => 
            response.toLowerCase().includes(sectionType.toLowerCase()) ||
            this.isRelevantToSection(response, sectionType)
        );

        if (relevantResponses.length === 0) {
            return `*Content for ${sectionType} will be added based on conversation responses.*`;
        }

        return relevantResponses.join('\n\n');
    }

    private populateTemplate(template: string, conversationData: ConversationData): string {
        let populatedTemplate = template;

        // Replace placeholders with conversation data
        const extractedData = conversationData.extractedData;
        
        for (const [key, value] of extractedData) {
            const placeholder = `{{${key}}}`;
            if (populatedTemplate.includes(placeholder)) {
                populatedTemplate = populatedTemplate.replace(placeholder, String(value));
            }
        }

        // Replace remaining placeholders with relevant responses
        const responses = Array.from(conversationData.responses.values());
        const placeholderPattern = /\{\{([^}]+)\}\}/g;
        
        populatedTemplate = populatedTemplate.replace(placeholderPattern, (match, key) => {
            // Try to find relevant response for this placeholder
            const relevantResponse = responses.find(response => 
                response.toLowerCase().includes(key.toLowerCase().replace(/_/g, ' '))
            );
            
            return relevantResponse || `*${key.replace(/_/g, ' ')} to be defined*`;
        });

        return populatedTemplate.trim();
    }

    private isRelevantToSection(response: string, sectionType: string): boolean {
        const sectionKeywords: Record<string, string[]> = {
            'Executive Summary': ['summary', 'overview', 'purpose', 'goal'],
            'Product Objectives': ['objective', 'goal', 'target', 'aim'],
            'User Personas': ['user', 'customer', 'persona', 'audience'],
            'Functional Requirements': ['requirement', 'feature', 'function', 'capability'],
            'Requirements': ['requirement', 'must', 'shall', 'should'],
            'Architecture': ['architecture', 'design', 'structure', 'component'],
            'Performance Requirements': ['performance', 'speed', 'latency', 'throughput'],
            'Security Requirements': ['security', 'authentication', 'authorization', 'encryption']
        };

        const keywords = sectionKeywords[sectionType] || [];
        const lowerResponse = response.toLowerCase();
        
        return keywords.some(keyword => lowerResponse.includes(keyword));
    }
}