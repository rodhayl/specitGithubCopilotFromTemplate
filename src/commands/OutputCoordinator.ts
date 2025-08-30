import * as vscode from 'vscode';
import { Logger } from '../logging/Logger';
import { MessageFormatter, MessageContent, MessageAction } from '../utils/MessageFormatter';
import { CommandResult } from './types';

export interface OutputContent {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    details?: string[];
    nextSteps?: string[]; // For backward compatibility
    metadata?: Record<string, any>;
    actions?: MessageAction[];
}

export interface CommandTip {
    type: 'example' | 'suggestion' | 'warning' | 'info';
    title: string;
    content: string;
    examples?: string[];
    category?: string; // For backward compatibility
    message?: string; // For backward compatibility
    priority?: number; // For backward compatibility
}

export interface OutputSection {
    source: string;
    content: OutputContent;
    tips: CommandTip[];
    timestamp: Date;
}

// Consolidated feedback interfaces from FeedbackCoordinator
export interface FeedbackContent {
    type: 'guidance' | 'suggestion' | 'warning' | 'tip' | 'conversation';
    message?: string;
    content?: string; // For backward compatibility with tests
    priority: number;
    source?: string;
    context?: any;
}

// Internal state management interfaces
interface CommandOutputState {
    primaryOutput?: OutputContent;
    secondaryFeedback: Map<string, FeedbackContent>;
    tips: Map<string, CommandTip[]>;
    rendered: boolean;
    duplicatesSuppressed: string[];
}

interface FeedbackCoordinationOptions {
    suppressTipsWhenConversationActive: boolean;
    maxTipsPerCommand: number;
    prioritizeConversationFeedback: boolean;
}

interface CoordinatedOutput {
    sections: OutputSection[];
    duplicatesRemoved: string[];
}

/**
 * Consolidated OutputCoordinator - handles all command output and feedback coordination
 * Now uses unified MessageFormatter for consistent formatting
 */
export class OutputCoordinator {
    private static instance: OutputCoordinator;
    private logger: Logger;
    private messageFormatter: MessageFormatter;
    private outputSections: Map<string, OutputSection> = new Map();
    private renderQueue: OutputSection[] = [];
    
    // Feedback coordination (from FeedbackCoordinator)
    private feedbackItems: FeedbackContent[] = [];
    private processedSources: Set<string> = new Set();
    
    // State management
    private state: CommandOutputState;
    private options: FeedbackCoordinationOptions;
    private renderingLock: boolean = false;

    private constructor() {
        this.logger = Logger.getInstance();
        this.messageFormatter = MessageFormatter.getInstance();
        this.state = this.createInitialState();
        this.options = {
            suppressTipsWhenConversationActive: true,
            maxTipsPerCommand: 3,
            prioritizeConversationFeedback: true
        };
    }

    static getInstance(): OutputCoordinator {
        if (!OutputCoordinator.instance) {
            OutputCoordinator.instance = new OutputCoordinator();
        }
        return OutputCoordinator.instance;
    }

    /**
     * Register primary command output
     */
    registerPrimaryOutput(source: string, content: OutputContent): void {
        this.logger.info('output', 'Registering primary output', { source, type: content.type });
        
        if (this.state.primaryOutput) {
            this.logger.warn('output', 'Primary output already registered, replacing', { 
                previousSource: 'unknown',
                newSource: source 
            });
        }
        
        this.state.primaryOutput = content;
        
        // Also add to legacy system for backward compatibility
        const section: OutputSection = {
            source,
            content,
            tips: [],
            timestamp: new Date()
        };
        this.outputSections.set(source, section);
        this.addToRenderQueue(section);
    }

    /**
     * Add secondary feedback content
     */
    addSecondaryFeedback(source: string, content: FeedbackContent): void {
        this.logger.info('output', 'Adding secondary feedback', { source, type: content.type, priority: content.priority });
        
        // Check for duplicate content
        const existingContent = Array.from(this.state.secondaryFeedback.values())
            .find(existing => this.isDuplicateContent(existing.message || existing.content || '', content.message || content.content || ''));
        
        if (existingContent) {
            this.state.duplicatesSuppressed.push(`${source}: ${content.type}`);
            this.logger.info('output', 'Suppressed duplicate feedback', { source, type: content.type });
            return;
        }
        
        this.state.secondaryFeedback.set(source, content);
    }

    /**
     * Adds tips to an existing output section
     */
    addTips(source: string, tips: CommandTip[]): void {
        this.logger.info('output', 'Adding tips', { source, count: tips.length });
        
        if (tips.length === 0) {
            return;
        }
        
        // Check for duplicate tips
        const filteredTips = tips.filter(tip => {
            const existingTips = Array.from(this.state.tips.values()).flat();
            return !existingTips.some(existing => this.isDuplicateTip(existing, tip));
        });
        
        if (filteredTips.length < tips.length) {
            const suppressedCount = tips.length - filteredTips.length;
            this.state.duplicatesSuppressed.push(`${source}: ${suppressedCount} duplicate tips`);
            this.logger.info('output', 'Suppressed duplicate tips', { source, suppressedCount });
        }
        
        if (filteredTips.length > 0) {
            this.state.tips.set(source, filteredTips);
        }
        
        // Also update legacy system
        const section = this.outputSections.get(source);
        if (section) {
            section.tips.push(...filteredTips);
            section.tips.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            this.logger.debug('output', `Added ${filteredTips.length} tips to ${source}`);
        } else {
            this.logger.warn('output', `Cannot add tips to unknown source: ${source}`);
        }
    }

    /**
     * Adds feedback from a source (from FeedbackCoordinator)
     */
    addFeedback(content: FeedbackContent): void {
        const source = content.source || 'unknown';
        
        // Prevent duplicate feedback from the same source
        if (this.processedSources.has(source)) {
            this.logger.debug('output', `Ignoring duplicate feedback from ${source}`);
            return;
        }
        
        this.feedbackItems.push(content);
        this.processedSources.add(source);
        
        // Sort by priority
        this.feedbackItems.sort((a, b) => b.priority - a.priority);
        this.logger.debug('output', `Added feedback from ${source}: ${content.type}`);
    }

    /**
     * Gets all pending feedback items (from FeedbackCoordinator)
     */
    getPendingFeedback(): FeedbackContent[] {
        return [...this.feedbackItems];
    }

    /**
     * Clears processed feedback (from FeedbackCoordinator)
     */
    clearFeedback(): void {
        this.feedbackItems = [];
        this.processedSources.clear();
        this.logger.debug('output', 'Cleared all feedback items');
    }

    /**
     * Render all coordinated output to the stream
     */
    async render(stream: vscode.ChatResponseStream): Promise<void> {
        if (this.state.rendered) {
            this.logger.warn('output', 'Output already rendered, skipping');
            return;
        }

        // Prevent race conditions with rendering lock
        if (this.renderingLock) {
            this.logger.warn('output', 'Rendering already in progress, skipping');
            return;
        }

        this.renderingLock = true;

        try {
            const coordinatedOutput = this.coordinateOutput();
            
            // Render sections in priority order
            for (const section of coordinatedOutput.sections) {
                const messageContent = this.convertSectionToMessage(section);
                const formatted = this.messageFormatter.formatMessage(messageContent);
                await this.messageFormatter.renderToStream(stream, formatted);
            }
            
            // Log suppressed duplicates for debugging
            if (coordinatedOutput.duplicatesRemoved.length > 0) {
                this.logger.info('output', 'Duplicates suppressed during rendering', {
                    count: coordinatedOutput.duplicatesRemoved.length,
                    items: coordinatedOutput.duplicatesRemoved
                });
            }
            
            this.state.rendered = true;
            this.logger.info('output', 'Output rendered successfully', {
                sectionsCount: coordinatedOutput.sections.length,
                duplicatesRemoved: coordinatedOutput.duplicatesRemoved.length
            });
            
        } catch (error) {
            this.logger.error('output', 'Failed to render coordinated output', error instanceof Error ? error : new Error(String(error)));
            
            // Fallback: render primary output only
            if (this.state.primaryOutput) {
                const messageContent: MessageContent = {
                    type: this.state.primaryOutput.type,
                    title: this.state.primaryOutput.title,
                    message: this.state.primaryOutput.message,
                    details: this.state.primaryOutput.details,
                    metadata: this.state.primaryOutput.metadata,
                    actions: this.state.primaryOutput.actions
                };
                const formatted = this.messageFormatter.formatMessage(messageContent);
                await this.messageFormatter.renderToStream(stream, formatted);
            }
        } finally {
            // Always release the rendering lock
            this.renderingLock = false;
        }
    }

    /**
     * Renders a single message immediately (for urgent notifications)
     */
    async renderImmediate(stream: vscode.ChatResponseStream, content: OutputContent): Promise<void> {
        const messageContent: MessageContent = {
            type: content.type,
            title: content.title,
            message: content.message,
            details: content.details,
            metadata: content.metadata,
            actions: content.actions
        };
        const formatted = this.messageFormatter.formatMessage(messageContent);
        await this.messageFormatter.renderToStream(stream, formatted);
    }

    /**
     * Renders progress updates
     */
    async renderProgress(stream: vscode.ChatResponseStream, title: string, message: string, progress?: number): Promise<void> {
        const formatted = this.messageFormatter.formatProgress({
            title,
            message,
            progress,
            indeterminate: progress === undefined
        });
        await this.messageFormatter.renderToStream(stream, formatted);
    }

    /**
     * Renders error with recovery suggestions
     */
    async renderError(stream: vscode.ChatResponseStream, error: Error, suggestions?: string[]): Promise<void> {
        const formatted = this.messageFormatter.formatError(error, suggestions);
        await this.messageFormatter.renderToStream(stream, formatted);
    }

    /**
     * Renders success message with next steps
     */
    async renderSuccess(stream: vscode.ChatResponseStream, title: string, message: string, nextSteps?: string[]): Promise<void> {
        const formatted = this.messageFormatter.formatSuccess(title, message, nextSteps);
        await this.messageFormatter.renderToStream(stream, formatted);
    }

    /**
     * Clear all state for next command
     */
    clear(): void {
        this.logger.info('output', 'Clearing output coordinator state');
        this.state = this.createInitialState();
        this.outputSections.clear();
        this.renderQueue = [];
        this.clearFeedback();
    }

    /**
     * Gets current output sections for debugging
     */
    getOutputSections(): Map<string, OutputSection> {
        return new Map(this.outputSections);
    }

    /**
     * Get current state (for testing)
     */
    getState(): CommandOutputState {
        return { ...this.state };
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Coordinate all output into prioritized sections
     */
    private coordinateOutput(): CoordinatedOutput {
        const sections: OutputSection[] = [];
        const duplicatesRemoved: string[] = [...this.state.duplicatesSuppressed];

        // Add primary output (highest priority)
        if (this.state.primaryOutput) {
            sections.push({
                source: 'primary',
                content: this.state.primaryOutput,
                tips: [],
                timestamp: new Date()
            });
        }

        // Add secondary feedback (medium priority)
        const sortedFeedback = Array.from(this.state.secondaryFeedback.entries())
            .sort(([, a], [, b]) => a.priority - b.priority);
        
        for (const [source, feedback] of sortedFeedback) {
            const feedbackContent: OutputContent = {
                type: this.mapFeedbackTypeToOutputType(feedback.type),
                title: this.capitalizeFirst(feedback.type),
                message: feedback.message || feedback.content || ''
            };
            
            sections.push({
                source,
                content: feedbackContent,
                tips: [],
                timestamp: new Date()
            });
        }

        // Add tips (lowest priority, only if no conversation feedback)
        const hasConversationFeedback = Array.from(this.state.secondaryFeedback.values())
            .some(feedback => feedback.type === 'guidance');
        
        if (!hasConversationFeedback && this.state.tips.size > 0) {
            const allTips = Array.from(this.state.tips.values()).flat();
            if (allTips.length > 0) {
                const tipsContent: OutputContent = {
                    type: 'info',
                    title: 'Tips',
                    message: 'Here are some helpful tips:',
                    details: allTips.slice(0, this.options.maxTipsPerCommand).map(tip => tip.content || tip.message || '')
                };
                
                sections.push({
                    source: 'tips',
                    content: tipsContent,
                    tips: allTips,
                    timestamp: new Date()
                });
            }
        }

        return { sections, duplicatesRemoved };
    }

    private convertSectionToMessage(section: OutputSection): MessageContent {
        const { content, tips } = section;
        
        // Combine tips with details
        const allDetails = [...(content.details || [])];
        if (tips.length > 0) {
            allDetails.push('**💡 Tips:**');
            allDetails.push(...tips.slice(0, 3).map(tip => `- ${tip.content || tip.message || ''}`));
        }
        
        return {
            type: content.type,
            title: content.title,
            message: content.message,
            details: allDetails.length > 0 ? allDetails : undefined,
            metadata: content.metadata,
            actions: content.actions
        };
    }

    private mapFeedbackTypeToOutputType(feedbackType: string): 'success' | 'error' | 'info' | 'warning' {
        switch (feedbackType) {
            case 'warning': return 'warning';
            case 'suggestion': return 'info';
            case 'guidance': return 'info';
            case 'tip': return 'info';
            default: return 'info';
        }
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    private addToRenderQueue(section: OutputSection): void {
        // Remove existing section from same source
        this.renderQueue = this.renderQueue.filter(s => s.source !== section.source);
        
        // Add new section
        this.renderQueue.push(section);
        
        // Sort by timestamp
        this.renderQueue.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    /**
     * Check if content is duplicate
     */
    private isDuplicateContent(existing: string, newContent: string): boolean {
        // Simple similarity check - could be enhanced with more sophisticated algorithms
        const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
        const existingNorm = normalize(existing);
        const newNorm = normalize(newContent);
        
        // Check for exact match or significant overlap
        if (existingNorm === newNorm) {
            return true;
        }
        
        // Check for substantial overlap (>80% similarity)
        const similarity = this.calculateSimilarity(existingNorm, newNorm);
        return similarity > 0.8;
    }

    /**
     * Check if tips are duplicate
     */
    private isDuplicateTip(existing: CommandTip, newTip: CommandTip): boolean {
        const existingContent = existing.content || existing.message || '';
        const newContent = newTip.content || newTip.message || '';
        const existingTitle = existing.title || existing.category || '';
        const newTitle = newTip.title || newTip.category || '';
        
        return existingTitle === newTitle && 
               this.isDuplicateContent(existingContent, newContent);
    }

    /**
     * Calculate similarity between two strings
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) {
            return 1.0;
        }
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) {
            matrix[0][i] = i;
        }
        
        for (let j = 0; j <= str2.length; j++) {
            matrix[j][0] = j;
        }
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Create initial state
     */
    private createInitialState(): CommandOutputState {
        return {
            primaryOutput: undefined,
            secondaryFeedback: new Map(),
            tips: new Map(),
            rendered: false,
            duplicatesSuppressed: []
        };
    }

    // ===== CONSOLIDATED FEEDBACK COORDINATION METHODS =====

    /**
     * Update coordination options
     */
    setOptions(options: Partial<FeedbackCoordinationOptions>): void {
        this.options = { ...this.options, ...options };
        this.logger.info('feedback', 'Updated coordination options', this.options);
    }

    /**
     * Determine if conversation feedback should be shown
     */
    shouldShowConversationFeedback(commandResult: CommandResult): boolean {
        // Show conversation feedback if:
        // 1. Command has conversation config
        // 2. Command should continue conversation
        // 3. Command succeeded (for success feedback) or failed (for error feedback)
        
        const hasConversationConfig = !!commandResult.conversationConfig;
        const shouldContinue = commandResult.shouldContinueConversation;
        
        this.logger.info('feedback', 'Evaluating conversation feedback display', {
            hasConversationConfig,
            shouldContinue,
            success: commandResult.success
        });

        return Boolean(hasConversationConfig || shouldContinue);
    }

    /**
     * Determine if tips should be shown
     */
    shouldShowTips(commandName: string, flags: Record<string, any>): boolean {
        // Don't show tips if:
        // 1. User explicitly disabled conversation (--no-conversation)
        // 2. User explicitly enabled conversation (--with-conversation) - they'll get conversation feedback instead
        
        const explicitlyDisabled = flags['no-conversation'] || flags['nc'];
        const explicitlyEnabled = flags['with-conversation'] || flags['wc'];
        
        // Show tips for commands that could benefit from conversation, unless explicitly disabled
        const conversationBeneficialCommands = ['new', 'update', 'review'];
        const isBeneficial = conversationBeneficialCommands.includes(commandName);
        
        const shouldShow = isBeneficial && !explicitlyDisabled && !explicitlyEnabled;
        
        this.logger.info('feedback', 'Evaluating tips display', {
            commandName,
            explicitlyDisabled,
            explicitlyEnabled,
            isBeneficial,
            shouldShow
        });

        return shouldShow;
    }
}