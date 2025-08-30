import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../logging';
import { FileUtils } from '../utils/FileUtils';

/**
 * Result of document update operation
 */
export interface DocumentUpdateResult {
    success: boolean;
    sectionsUpdated: string[];
    error?: string;
    progressPercentage: number;
}

/**
 * Map of section updates to apply
 */
export interface SectionUpdateMap {
    [sectionName: string]: {
        content: string;
        mode: 'replace' | 'append' | 'prepend';
        priority: number;
    };
}

/**
 * Document update progress tracking
 */
export interface DocumentUpdateProgress {
    documentPath: string;
    templateId: string;
    totalSections: number;
    completedSections: number;
    progressPercentage: number;
    lastUpdated: Date;
    updateHistory: DocumentUpdate[];
}

/**
 * Individual document update record
 */
export interface DocumentUpdate {
    timestamp: Date;
    sectionName: string;
    contentAdded: string;
    updateType: 'initial' | 'append' | 'replace';
    conversationTurn: number;
}

/**
 * Template structure for mapping content
 */
export interface TemplateStructure {
    sections: {
        [sectionName: string]: {
            header: string;
            placeholder?: string;
            required: boolean;
            order: number;
        };
    };
    placeholders: {
        [placeholder: string]: {
            section: string;
            description: string;
        };
    };
}

/**
 * Conversation context for content mapping
 */
export interface ConversationContext {
    agentName: string;
    templateId: string;
    currentTurn: number;
    previousResponses: string[];
    documentPath: string;
}

/**
 * Conversation response structure
 */
export interface ConversationResponse {
    agentMessage: string;
    extractedContent?: {
        [key: string]: string;
    };
    suggestedSections?: string[];
    conversationComplete?: boolean;
}

/**
 * Handles updating document files based on conversation content
 */
export class DocumentUpdateEngine {
    private logger: Logger;
    private progressMap: Map<string, DocumentUpdateProgress> = new Map();
    private readonly sectionMappings: Map<string, TemplateStructure> = new Map();

    constructor() {
        this.logger = Logger.getInstance();
        this.initializeTemplateMappings();
    }

    /**
     * Update document based on conversation response
     */
    async updateDocumentFromConversation(
        documentPath: string,
        conversationResponse: ConversationResponse,
        templateStructure: TemplateStructure,
        conversationContext: ConversationContext
    ): Promise<DocumentUpdateResult> {
        try {
            // Check if document updates are enabled
            const config = vscode.workspace.getConfiguration('docu.autoChat');
            if (!config.get('enableDocumentUpdates', true)) {
                this.logger.info('document-update', 'Document updates disabled in configuration');
                return {
                    success: true,
                    sectionsUpdated: [],
                    progressPercentage: 0
                };
            }

            this.logger.info('document-update', 'Starting document update from conversation', {
                documentPath,
                agentName: conversationContext.agentName,
                turn: conversationContext.currentTurn
            });

            // Extract content from conversation response
            const extractedContent = this.extractContentFromResponse(
                conversationResponse.agentMessage,
                conversationContext
            );

            // Map content to document sections, using pre-extracted content if available
            const sectionUpdates = conversationResponse.extractedContent 
                ? this.mapExtractedContentToSections(conversationResponse.extractedContent, templateStructure, conversationContext)
                : this.mapContentToSections(extractedContent, templateStructure, conversationContext);

            // Apply updates to document
            await this.applySectionUpdates(documentPath, sectionUpdates);

            // Update progress tracking
            const progress = this.updateProgress(documentPath, sectionUpdates, conversationContext);

            this.logger.info('document-update', 'Document update completed', {
                documentPath,
                sectionsUpdated: Object.keys(sectionUpdates),
                progressPercentage: progress.progressPercentage
            });

            return {
                success: true,
                sectionsUpdated: Object.keys(sectionUpdates),
                progressPercentage: progress.progressPercentage
            };

        } catch (error) {
            this.logger.error('document-update', 'Failed to update document from conversation', error instanceof Error ? error : new Error(String(error)));
            
            return {
                success: false,
                sectionsUpdated: [],
                error: error instanceof Error ? error.message : String(error),
                progressPercentage: this.getUpdateProgress(documentPath).progressPercentage
            };
        }
    }

    /**
     * Map pre-extracted content to document sections
     */
    private mapExtractedContentToSections(
        extractedContent: { [key: string]: string },
        templateStructure: TemplateStructure,
        conversationContext: ConversationContext
    ): SectionUpdateMap {
        const updates: SectionUpdateMap = {};

        // Get agent-specific mapping rules
        const mappingRules = this.getAgentMappingRules(conversationContext.agentName);

        // Map extracted content to appropriate sections
        for (const [key, value] of Object.entries(extractedContent)) {
            const sectionName = this.findTargetSection(key, templateStructure, mappingRules);
            
            if (sectionName && value.trim()) {
                updates[sectionName] = {
                    content: this.formatContentForSection(value, sectionName, templateStructure),
                    mode: this.determineUpdateMode(sectionName, conversationContext),
                    priority: this.getSectionPriority(sectionName, templateStructure)
                };
            }
        }

        return updates;
    }

    /**
     * Map conversation content to document sections
     */
    mapContentToSections(
        content: string,
        templateStructure: TemplateStructure,
        conversationContext: ConversationContext
    ): SectionUpdateMap {
        const updates: SectionUpdateMap = {};

        // Get agent-specific mapping rules
        const mappingRules = this.getAgentMappingRules(conversationContext.agentName);

        // Extract structured information based on agent type and content
        const structuredContent = this.extractStructuredContent(content, conversationContext.agentName);

        // Map to appropriate sections
        for (const [key, value] of Object.entries(structuredContent)) {
            const sectionName = this.findTargetSection(key, templateStructure, mappingRules);
            
            if (sectionName && value.trim()) {
                updates[sectionName] = {
                    content: this.formatContentForSection(value, sectionName, templateStructure),
                    mode: this.determineUpdateMode(sectionName, conversationContext),
                    priority: this.getSectionPriority(sectionName, templateStructure)
                };
            }
        }

        return updates;
    }

    /**
     * Apply section updates to document
     */
    async applySectionUpdates(
        documentPath: string,
        updates: SectionUpdateMap
    ): Promise<void> {
        try {
            // Read current document content
            let documentContent = '';
            try {
                documentContent = await FileUtils.readFile(documentPath);
            } catch (error) {
                // File doesn't exist yet, start with empty content
                this.logger.info('document-update', 'Document file does not exist, creating new file', { documentPath });
            }

            // Sort updates by priority
            const sortedUpdates = Object.entries(updates).sort(([, a], [, b]) => a.priority - b.priority);

            // Apply each update
            for (const [sectionName, update] of sortedUpdates) {
                documentContent = await this.applySectionUpdate(
                    documentContent,
                    sectionName,
                    update.content,
                    update.mode
                );
            }

            // Write updated content back to file
            await FileUtils.writeFile(documentPath, documentContent);

            this.logger.info('document-update', 'Section updates applied successfully', {
                documentPath,
                sectionsUpdated: Object.keys(updates)
            });

        } catch (error) {
            this.logger.error('document-update', 'Failed to apply section updates', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Get document update progress
     */
    getUpdateProgress(documentPath: string): DocumentUpdateProgress {
        const existing = this.progressMap.get(documentPath);
        if (existing) {
            return existing;
        }

        // Initialize progress for new document
        const progress: DocumentUpdateProgress = {
            documentPath,
            templateId: 'basic', // Default, should be set properly
            totalSections: 8, // Default, should be calculated from template
            completedSections: 0,
            progressPercentage: 0,
            lastUpdated: new Date(),
            updateHistory: []
        };

        this.progressMap.set(documentPath, progress);
        return progress;
    }

    /**
     * Extract content from conversation response
     */
    private extractContentFromResponse(
        response: string,
        context: ConversationContext
    ): string {
        // Remove agent prompts and questions, keep user-relevant content
        let cleanContent = response;

        // Remove common agent phrases
        const agentPhrases = [
            /^(Great!?|Excellent!?|Perfect!?)\s*/i,
            /Let me help you with that\.?\s*/i,
            /Here's what I understand:?\s*/i,
            /Based on your response:?\s*/i
        ];

        for (const phrase of agentPhrases) {
            cleanContent = cleanContent.replace(phrase, '');
        }

        return cleanContent.trim();
    }

    /**
     * Extract structured content based on agent type
     */
    private extractStructuredContent(content: string, agentName: string): { [key: string]: string } {
        const structured: { [key: string]: string } = {};

        switch (agentName) {
            case 'prd-creator':
                structured.problemStatement = this.extractProblemStatement(content);
                structured.targetUsers = this.extractTargetUsers(content);
                structured.features = this.extractFeatures(content);
                structured.goals = this.extractGoals(content);
                break;

            case 'requirements-gatherer':
                structured.functionalRequirements = this.extractFunctionalRequirements(content);
                structured.nonFunctionalRequirements = this.extractNonFunctionalRequirements(content);
                structured.constraints = this.extractConstraints(content);
                break;

            case 'solution-architect':
                structured.architecture = this.extractArchitecture(content);
                structured.components = this.extractComponents(content);
                structured.dataFlow = this.extractDataFlow(content);
                break;

            default:
                // Generic content extraction
                structured.content = content;
                break;
        }

        return structured;
    }

    /**
     * Find target section for content
     */
    private findTargetSection(
        contentKey: string,
        templateStructure: TemplateStructure,
        mappingRules: { [key: string]: string }
    ): string | null {
        // Check explicit mapping rules first
        if (mappingRules[contentKey]) {
            return mappingRules[contentKey];
        }

        // Check template structure for matching sections
        for (const [sectionName, section] of Object.entries(templateStructure.sections)) {
            if (sectionName.toLowerCase().includes(contentKey.toLowerCase()) ||
                section.header.toLowerCase().includes(contentKey.toLowerCase())) {
                return sectionName;
            }
        }

        return null;
    }

    /**
     * Get agent-specific mapping rules
     */
    private getAgentMappingRules(agentName: string): { [key: string]: string } {
        const mappings: { [agentName: string]: { [key: string]: string } } = {
            'prd-creator': {
                'problemStatement': 'Problem Statement',
                'targetUsers': 'Target Users',
                'features': 'Key Features',
                'goals': 'Goals and Objectives'
            },
            'requirements-gatherer': {
                'functionalRequirements': 'Functional Requirements',
                'nonFunctionalRequirements': 'Non-Functional Requirements',
                'constraints': 'Constraints'
            },
            'solution-architect': {
                'architecture': 'System Architecture',
                'components': 'Components',
                'dataFlow': 'Data Flow'
            }
        };

        return mappings[agentName] || {};
    }

    /**
     * Format content for specific section
     */
    private formatContentForSection(
        content: string,
        sectionName: string,
        templateStructure: TemplateStructure
    ): string {
        // Add appropriate formatting based on section type
        if (sectionName.toLowerCase().includes('requirements')) {
            return this.formatAsRequirementsList(content);
        } else if (sectionName.toLowerCase().includes('features')) {
            return this.formatAsFeaturesList(content);
        } else {
            return content;
        }
    }

    /**
     * Format content as requirements list
     */
    private formatAsRequirementsList(content: string): string {
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => `- ${line.trim()}`).join('\n');
    }

    /**
     * Format content as features list
     */
    private formatAsFeaturesList(content: string): string {
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => `### ${line.trim()}\n\n[Feature description to be added]\n`).join('\n');
    }

    /**
     * Determine update mode for section
     */
    private determineUpdateMode(
        sectionName: string,
        context: ConversationContext
    ): 'replace' | 'append' | 'prepend' {
        // For first conversation turn, replace placeholders
        if (context.currentTurn <= 1) {
            return 'replace';
        }

        // For subsequent turns, append to existing content
        return 'append';
    }

    /**
     * Get section priority for ordering updates
     */
    private getSectionPriority(
        sectionName: string,
        templateStructure: TemplateStructure
    ): number {
        const section = templateStructure.sections[sectionName];
        return section?.order || 999;
    }

    /**
     * Apply single section update
     */
    private async applySectionUpdate(
        documentContent: string,
        sectionName: string,
        newContent: string,
        mode: 'replace' | 'append' | 'prepend'
    ): Promise<string> {
        const sectionRegex = new RegExp(`(^#{1,6}\\s+${sectionName}\\s*$)`, 'gm');
        const match = sectionRegex.exec(documentContent);

        if (match) {
            // Section exists, update it
            const sectionStart = match.index + match[0].length;
            const nextSectionRegex = /^#{1,6}\s+/gm;
            nextSectionRegex.lastIndex = sectionStart;
            const nextMatch = nextSectionRegex.exec(documentContent);
            
            const sectionEnd = nextMatch ? nextMatch.index : documentContent.length;
            const currentSectionContent = documentContent.substring(sectionStart, sectionEnd).trim();

            let updatedSectionContent: string;
            switch (mode) {
                case 'replace':
                    updatedSectionContent = `\n\n${newContent}\n\n`;
                    break;
                case 'append':
                    updatedSectionContent = currentSectionContent ? 
                        `\n\n${currentSectionContent}\n\n${newContent}\n\n` : 
                        `\n\n${newContent}\n\n`;
                    break;
                case 'prepend':
                    updatedSectionContent = currentSectionContent ? 
                        `\n\n${newContent}\n\n${currentSectionContent}\n\n` : 
                        `\n\n${newContent}\n\n`;
                    break;
            }

            return documentContent.substring(0, sectionStart) + 
                   updatedSectionContent + 
                   documentContent.substring(sectionEnd);
        } else {
            // Section doesn't exist, add it at the end
            const newSection = `\n\n## ${sectionName}\n\n${newContent}\n\n`;
            return documentContent + newSection;
        }
    }

    /**
     * Update progress tracking
     */
    private updateProgress(
        documentPath: string,
        updates: SectionUpdateMap,
        context: ConversationContext
    ): DocumentUpdateProgress {
        let progress = this.progressMap.get(documentPath);
        
        if (!progress) {
            progress = this.getUpdateProgress(documentPath);
        }

        // Add update records
        for (const [sectionName, update] of Object.entries(updates)) {
            const updateRecord: DocumentUpdate = {
                timestamp: new Date(),
                sectionName,
                contentAdded: update.content.substring(0, 100) + '...',
                updateType: update.mode === 'replace' ? 'replace' : 'append',
                conversationTurn: context.currentTurn
            };
            progress.updateHistory.push(updateRecord);
        }

        // Update completion tracking
        progress.completedSections = Math.min(
            progress.completedSections + Object.keys(updates).length,
            progress.totalSections
        );
        progress.progressPercentage = Math.round(
            (progress.completedSections / progress.totalSections) * 100
        );
        progress.lastUpdated = new Date();

        this.progressMap.set(documentPath, progress);
        return progress;
    }

    /**
     * Initialize template mappings
     */
    private initializeTemplateMappings(): void {
        // PRD template structure
        this.sectionMappings.set('prd', {
            sections: {
                'Problem Statement': { header: '## Problem Statement', required: true, order: 1 },
                'Target Users': { header: '## Target Users', required: true, order: 2 },
                'Goals and Objectives': { header: '## Goals and Objectives', required: true, order: 3 },
                'Key Features': { header: '## Key Features', required: true, order: 4 },
                'User Stories': { header: '## User Stories', required: false, order: 5 },
                'Technical Requirements': { header: '## Technical Requirements', required: false, order: 6 },
                'Success Metrics': { header: '## Success Metrics', required: false, order: 7 },
                'Timeline': { header: '## Timeline', required: false, order: 8 }
            },
            placeholders: {
                '{{PROBLEM_STATEMENT}}': { section: 'Problem Statement', description: 'Main problem being solved' },
                '{{TARGET_USERS}}': { section: 'Target Users', description: 'Primary user personas' },
                '{{KEY_FEATURES}}': { section: 'Key Features', description: 'Core product features' }
            }
        });

        // Basic template structure
        this.sectionMappings.set('basic', {
            sections: {
                'Overview': { header: '## Overview', required: true, order: 1 },
                'Requirements': { header: '## Requirements', required: false, order: 2 },
                'Implementation': { header: '## Implementation', required: false, order: 3 },
                'Testing': { header: '## Testing', required: false, order: 4 }
            },
            placeholders: {
                '{{OVERVIEW}}': { section: 'Overview', description: 'Document overview' },
                '{{REQUIREMENTS}}': { section: 'Requirements', description: 'Project requirements' }
            }
        });
    }

    // Content extraction methods for different types
    private extractProblemStatement(content: string): string {
        const problemKeywords = ['problem', 'issue', 'challenge', 'pain point', 'difficulty'];
        return this.extractContentByKeywords(content, problemKeywords);
    }

    private extractTargetUsers(content: string): string {
        const userKeywords = ['users', 'customers', 'audience', 'personas', 'target'];
        return this.extractContentByKeywords(content, userKeywords);
    }

    private extractFeatures(content: string): string {
        const featureKeywords = ['features', 'functionality', 'capabilities', 'tools'];
        return this.extractContentByKeywords(content, featureKeywords);
    }

    private extractGoals(content: string): string {
        const goalKeywords = ['goals', 'objectives', 'aims', 'targets', 'outcomes'];
        return this.extractContentByKeywords(content, goalKeywords);
    }

    private extractFunctionalRequirements(content: string): string {
        const functionalKeywords = ['functional', 'requirements', 'must', 'shall', 'should'];
        return this.extractContentByKeywords(content, functionalKeywords);
    }

    private extractNonFunctionalRequirements(content: string): string {
        const nonFunctionalKeywords = ['performance', 'security', 'scalability', 'usability'];
        return this.extractContentByKeywords(content, nonFunctionalKeywords);
    }

    private extractConstraints(content: string): string {
        const constraintKeywords = ['constraints', 'limitations', 'restrictions', 'boundaries'];
        return this.extractContentByKeywords(content, constraintKeywords);
    }

    private extractArchitecture(content: string): string {
        const architectureKeywords = ['architecture', 'design', 'structure', 'system'];
        return this.extractContentByKeywords(content, architectureKeywords);
    }

    private extractComponents(content: string): string {
        const componentKeywords = ['components', 'modules', 'services', 'parts'];
        return this.extractContentByKeywords(content, componentKeywords);
    }

    private extractDataFlow(content: string): string {
        const dataFlowKeywords = ['data flow', 'information flow', 'process', 'workflow'];
        return this.extractContentByKeywords(content, dataFlowKeywords);
    }

    /**
     * Extract content based on keywords
     */
    private extractContentByKeywords(content: string, keywords: string[]): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim());
        const relevantSentences = sentences.filter(sentence => 
            keywords.some(keyword => 
                sentence.toLowerCase().includes(keyword.toLowerCase())
            )
        );

        return relevantSentences.join('. ').trim();
    }
}