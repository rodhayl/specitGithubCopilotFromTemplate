// Core conversation framework types and interfaces
import * as vscode from 'vscode';

export interface ConversationContext {
    documentType: string;
    documentPath: string;
    existingContent?: string;
    workflowPhase: string;
    previousConversations?: ConversationSummary[];
    workspaceRoot: string;
    extensionContext: vscode.ExtensionContext;
}

export interface ConversationSession {
    sessionId: string;
    agentName: string;
    currentQuestionSet: Question[];
    state: ConversationState;
    createdAt: Date;
    lastActivity: Date;
}

export interface ConversationResponse {
    agentMessage: string;
    followupQuestions?: Question[];
    documentUpdates?: DocumentUpdate[];
    workflowSuggestions?: WorkflowSuggestion[];
    progressUpdate?: ProgressStatus;
    sessionId: string;
}

export interface ConversationSummary {
    sessionId: string;
    agentName: string;
    phase: string;
    questionsAsked: number;
    questionsAnswered: number;
    documentsUpdated: string[];
    completionScore: number;
    duration: number;
    createdAt: Date;
    completedAt: Date;
}

export interface ConversationTurn {
    id: string;
    sessionId: string;
    timestamp: Date;
    type: 'question' | 'response' | 'system';
    content: string;
    metadata?: Record<string, any>;
}

export interface Question {
    id: string;
    text: string;
    type: 'open-ended' | 'multiple-choice' | 'structured' | 'yes-no';
    examples?: string[];
    required: boolean;
    followupTriggers?: string[];
    category: string;
    priority: number;
    validationRules?: ValidationRule[];
}

export interface ConversationState {
    sessionId: string;
    agentName: string;
    phase: string;
    currentQuestionIndex: number;
    answeredQuestions: Map<string, string>;
    extractedData: Map<string, any>;
    pendingValidations: ValidationItem[];
    completionScore: number;
    isActive: boolean;
    lastUpdated: Date;
}

export interface DocumentUpdate {
    section: string;
    content: string;
    updateType: 'replace' | 'append' | 'prepend' | 'insert';
    position?: number;
    timestamp: Date;
    confidence: number;
}

export interface WorkflowSuggestion {
    nextPhase: string;
    recommendedAgent: string;
    reason: string;
    prerequisites: string[];
    estimatedDuration: string;
    confidence: number;
}

export interface ProgressStatus {
    currentPhase: string;
    completionPercentage: number;
    completedSections: string[];
    pendingSections: string[];
    nextSteps: string[];
    estimatedTimeRemaining: string;
}

export interface ResponseAnalysis {
    completeness: number; // 0-1 scale
    clarity: number; // 0-1 scale
    extractedEntities: Entity[];
    suggestedFollowups: string[];
    needsClarification: boolean;
    confidence: number;
}

export interface Entity {
    type: string;
    value: string;
    confidence: number;
    startIndex: number;
    endIndex: number;
}

export interface StructuredData {
    type: string;
    data: Record<string, any>;
    confidence: number;
    source: string;
}

export interface ValidationRule {
    type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
    value?: any;
    message: string;
    validator?: (input: string) => boolean;
}

export interface ValidationItem {
    questionId: string;
    rule: ValidationRule;
    status: 'pending' | 'passed' | 'failed';
    message?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    score: number;
}

export interface UpdateResult {
    success: boolean;
    updatedSections: string[];
    errors: string[];
    warnings: string[];
    changesSummary: string;
}

export interface DocumentChange {
    section: string;
    oldContent: string;
    newContent: string;
    changeType: 'addition' | 'modification' | 'deletion';
    timestamp: Date;
    source: string;
}

export interface PhaseCompletionStatus {
    phase: string;
    completionPercentage: number;
    requiredSections: string[];
    completedSections: string[];
    missingSections: string[];
    qualityScore: number;
    readyForTransition: boolean;
}

export interface TransitionValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
    prerequisites: string[];
    recommendations: string[];
}

export interface TransitionResult {
    success: boolean;
    fromPhase: string;
    toPhase: string;
    newAgent: string;
    message: string;
    nextSteps: string[];
}

export interface QuestionSet {
    primary: Question[]; // Must-ask questions
    secondary: Question[]; // Context-dependent questions
    validation: Question[]; // Clarification questions
}

export interface FollowupStrategy {
    trigger: string; // Regex or keyword pattern
    questions: Question[];
    contentExtraction: ExtractionRule[];
    priority: number;
}

export interface ExtractionRule {
    pattern: string;
    targetField: string;
    dataType: string;
    required: boolean;
    validator?: (value: any) => boolean;
}

export interface AgentQuestionTemplate {
    agentName: string;
    phase: string;
    initialQuestions: QuestionSet;
    followupStrategies: FollowupStrategy[];
    completionCriteria: CompletionCriteria;
}

export interface CompletionCriteria {
    minimumQuestions: number;
    requiredCategories: string[];
    qualityThreshold: number;
    completionRules: CompletionRule[];
}

export interface CompletionRule {
    type: 'question-count' | 'category-coverage' | 'quality-score' | 'custom';
    threshold: number;
    validator?: (state: ConversationState) => boolean;
}

// Core interfaces for the conversation system
export interface ConversationManager {
    startConversation(agentName: string, context: ConversationContext): Promise<ConversationSession>;
    continueConversation(sessionId: string, userResponse: string): Promise<ConversationResponse>;
    endConversation(sessionId: string): Promise<ConversationSummary>;
    getConversationHistory(sessionId: string): ConversationTurn[];
    getActiveSession(agentName: string): ConversationSession | null;
    pauseConversation(sessionId: string): Promise<void>;
    resumeConversation(sessionId: string): Promise<ConversationSession>;
}

export interface QuestionEngine {
    generateInitialQuestions(agentType: string, context: ConversationContext): Question[];
    generateFollowupQuestions(agentType: string, userResponse: string, conversationHistory: ConversationTurn[]): Question[];
    validateQuestionRelevance(questions: Question[], context: ConversationContext): Question[];
    getQuestionTemplate(agentType: string, phase: string): AgentQuestionTemplate | null;
    updateQuestionTemplate(template: AgentQuestionTemplate): void;
}

export interface ResponseProcessor {
    analyzeResponse(response: string, question: Question): ResponseAnalysis;
    extractStructuredData(response: string, expectedFormat: string): StructuredData;
    validateCompleteness(response: string, requirements: ValidationRule[]): ValidationResult;
    suggestImprovements(response: string, context: ConversationContext): string[];
    processEntities(response: string): Entity[];
}

export interface ContentCapture {
    updateDocument(documentPath: string, updates: DocumentUpdate[]): Promise<UpdateResult>;
    generateDocumentSection(sectionType: string, conversationData: ConversationData): string;
    validateDocumentStructure(documentPath: string): ValidationResult;
    trackChanges(documentPath: string, changes: DocumentChange[]): void;
    getDocumentSections(documentPath: string): Promise<string[]>;
    extractExistingContent(documentPath: string, section: string): Promise<string>;
}

export interface WorkflowOrchestrator {
    evaluatePhaseCompletion(currentPhase: string, documentPath: string): Promise<PhaseCompletionStatus>;
    suggestNextPhase(currentPhase: string, completionStatus: PhaseCompletionStatus): WorkflowSuggestion;
    validatePhaseTransition(fromPhase: string, toPhase: string): TransitionValidation;
    executePhaseTransition(suggestion: WorkflowSuggestion): Promise<TransitionResult>;
    getWorkflowPhases(): string[];
    getPhaseRequirements(phase: string): string[];
}

export interface ProgressTracker {
    calculateProgress(sessionId: string): ProgressStatus;
    updateProgress(sessionId: string, updates: Partial<ProgressStatus>): void;
    getCompletionMetrics(sessionId: string): CompletionMetrics;
    identifyMissingSections(documentPath: string, phase: string): string[];
    estimateRemainingWork(sessionId: string): string;
}

export interface CompletionMetrics {
    questionsAnswered: number;
    totalQuestions: number;
    sectionsCompleted: number;
    totalSections: number;
    qualityScore: number;
    timeSpent: number;
    estimatedTimeRemaining: number;
}

export interface ConversationData {
    sessionId: string;
    agentName: string;
    responses: Map<string, string>;
    extractedData: Map<string, any>;
    metadata: Record<string, any>;
}

// Error types
export class ConversationError extends Error {
    constructor(
        message: string,
        public code: string,
        public sessionId?: string,
        public recoverable: boolean = true
    ) {
        super(message);
        this.name = 'ConversationError';
    }
}

export class ValidationError extends Error {
    constructor(
        message: string,
        public field: string,
        public value: any,
        public rule: ValidationRule
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class DocumentUpdateError extends Error {
    constructor(
        message: string,
        public documentPath: string,
        public section: string,
        public updateType: string
    ) {
        super(message);
        this.name = 'DocumentUpdateError';
    }
}