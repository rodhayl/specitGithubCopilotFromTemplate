import * as vscode from 'vscode';
import { CommandContext } from '../commands/types';
import { ConversationManager } from './ConversationManager';
import { AgentManager } from '../agents/AgentManager';
import { ConversationErrorRecovery } from './ConversationErrorRecovery';
import { ConversationError } from './types';
import { OfflineManager } from '../offline/OfflineManager';
import { Logger } from '../logging';
import { AutoChatStateManager, AutoChatContext } from './AutoChatStateManager';
import { DocumentUpdateEngine } from './DocumentUpdateEngine';
import { DocSessionManager, DocType } from './DocSessionManager';

/**
 * Result of conversation routing decision
 */
export interface ConversationRoutingResult {
    routedTo: 'conversation' | 'agent' | 'error';
    sessionId?: string;
    agentName?: string;
    response?: string;
    error?: string;
    shouldContinue?: boolean;
}

type RoutingIntentAction = 'start_new_doc' | 'resume_last_doc' | 'route_to_agent';

interface RoutingIntent {
    action: RoutingIntentAction;
    confidence: number;
    reason: string;
    requiresConfirmation: boolean;
    targetDocType?: DocType;
    targetAgent?: string;
}

interface PendingRoutingDecision {
    intent: RoutingIntent;
    originalInput: string;
    activeDocSessionIdToClose?: string;
    createdAt: Date;
    expiresAt: Date;
}

/**
 * Session metadata for tracking active conversations
 */
export interface SessionMetadata {
    agentName: string;
    documentPath?: string;
    templateId?: string;
    startedAt: Date;
    lastActivity: Date;
    questionCount: number;
    responseCount: number;
}

/**
 * Conversation session state management
 */
export interface ConversationSessionState {
    activeSessionId: string | null;
    sessionsByAgent: Map<string, string>;
    sessionMetadata: Map<string, SessionMetadata>;
}

/**
 * Routes user input to appropriate conversation or agent handler
 */
export class ConversationSessionRouter {
    private logger: Logger;
    private sessionState: ConversationSessionState;
    private extensionContext?: vscode.ExtensionContext;
    private errorRecovery?: ConversationErrorRecovery;
    private autoChatManager?: AutoChatStateManager;
    private documentUpdateEngine?: DocumentUpdateEngine;
    /** Active DocSessionManager session id (natural-language doc workflow) */
    private activeDocSessionId: string | null = null;
    /** Last document used by natural-language doc workflow for post-completion refinements. */
    private lastDocContext: {
        documentPath: string;
        agentName?: string;
        templateId?: string;
        lastActivity: Date;
    } | null = null;
    /** Pending confirmation gate for potentially disruptive routing switches. */
    private pendingRoutingDecision: PendingRoutingDecision | null = null;

    constructor(
        private conversationManager: ConversationManager,
        private agentManager: AgentManager,
        extensionContext?: vscode.ExtensionContext,
        offlineManager?: OfflineManager
    ) {
        this.logger = Logger.getInstance();
        this.extensionContext = extensionContext;
        this.sessionState = {
            activeSessionId: null,
            sessionsByAgent: new Map(),
            sessionMetadata: new Map()
        };
        
        // Initialize error recovery if offline manager is available
        if (offlineManager) {
            this.errorRecovery = new ConversationErrorRecovery(offlineManager, agentManager);
        }
        
        // Initialize auto-chat manager
        this.autoChatManager = new AutoChatStateManager(extensionContext);
        
        // Initialize document update engine
        this.documentUpdateEngine = new DocumentUpdateEngine();
        
        // Load persisted session state
        this.loadSessionState();
    }

    /**
     * Route user input to conversation or agent
     */
    async routeUserInput(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            this.logger.info('conversation-router', 'Routing user input', {
                inputLength: input.length,
                hasActiveSession: this.hasActiveSession(),
                activeSessionId: this.sessionState.activeSessionId,
                autoChatActive: this.autoChatManager?.isAutoChatActive()
            });

            const pendingDecisionResult = await this.handlePendingRoutingDecision(input, context);
            if (pendingDecisionResult) {
                return pendingDecisionResult;
            }

            // Continue an active natural-language doc session first.
            if (this.activeDocSessionId && DocSessionManager.getInstance().hasSession(this.activeDocSessionId)) {
                const maybeSwitchFromActiveDoc = await this.tryHandleSwitchIntentDuringActiveDocSession(input, context);
                if (maybeSwitchFromActiveDoc) {
                    return maybeSwitchFromActiveDoc;
                }
                return await this.routeToDocSession(this.activeDocSessionId, input, context);
            } else if (this.activeDocSessionId) {
                // Session was cleared (e.g. user typed 'done').
                this.activeDocSessionId = null;
            }

            // Check if auto-chat is active.
            const autoChatContext = this.autoChatManager?.getAutoChatContext();
            if (this.shouldStartDocSessionFromAutoChat(input, context, autoChatContext)) {
                this.logger.info('conversation-router', 'Switching auto-chat to doc session for kickoff input', {
                    agentName: autoChatContext?.agentName,
                    hasActiveConversationSession: this.hasActiveSession()
                });
                this.autoChatManager?.disableAutoChat();
                this.clearActiveSession();
                return await this.startDocSession(input, context);
            }
            if (autoChatContext) {
                return await this.routeUserInputWithAutoChat(input, context, autoChatContext);
            }

            // Check if there's an active conversation session.
            if (this.hasActiveSession()) {
                const sessionId = this.sessionState.activeSessionId!;

                // Verify the session is still active in the conversation manager.
                if (this.conversationManager.getSession(sessionId)) {
                    return await this.routeToConversation(sessionId, input, context);
                } else {
                    // Session no longer exists, clean up and fall back to agent.
                    this.logger.warn('conversation-router', 'Active session no longer exists, cleaning up', {
                        sessionId
                    });
                    this.clearActiveSession();
                }
            }

            if (input.trim().length > 0) {
                const intentRoutedResult = await this.routeInputByIntentPolicy(input, context);
                if (intentRoutedResult) {
                    return intentRoutedResult;
                }
            }

            // Fallback: route to currently-set agent (legacy path).
            return await this.routeToAgent(input, context);

        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route user input', error instanceof Error ? error : new Error(String(error)));
            return {
                routedTo: 'error',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Route user input with auto-chat awareness
     */
    async routeUserInputWithAutoChat(
        input: string,
        context: CommandContext,
        autoChatContext: AutoChatContext
    ): Promise<ConversationRoutingResult> {
        try {
            this.logger.info('conversation-router', 'Routing with auto-chat', {
                agentName: autoChatContext.agentName,
                documentPath: autoChatContext.documentPath
            });

            // Update auto-chat activity
            this.autoChatManager?.updateActivity();

            // Auto-chat from `/agent set` has no bound document. In that mode we should
            // route directly to the active agent instead of legacy question-engine flow.
            if (!autoChatContext.documentPath) {
                const agentResult = await this.routeToAgent(input, context);
                if (agentResult.routedTo === 'agent') {
                    return {
                        ...agentResult,
                        shouldContinue: true
                    };
                }
                return agentResult;
            }

            // Document-bound auto-chat should use DocSessionManager so the user gets
            // full LLM refinement behavior instead of legacy question-engine prompts.
            const docMgr = DocSessionManager.getInstance();
            if (this.activeDocSessionId && docMgr.hasSession(this.activeDocSessionId)) {
                return await this.routeToDocSession(this.activeDocSessionId, input, context);
            }

            const docResult = await docMgr.startSessionFromExistingDocument(
                autoChatContext.documentPath,
                context,
                {
                    templateId: autoChatContext.templateId,
                    agentName: autoChatContext.agentName,
                    initialUserInput: input
                }
            );

            if (!docResult.sessionId) {
                // No model selected (or no session established) - keep auto-chat disabled
                // so users are not trapped in a non-functional loop.
                this.autoChatManager?.disableAutoChat();
                return {
                    routedTo: 'conversation',
                    response: docResult.response,
                    shouldContinue: false
                };
            }

            this.activeDocSessionId = docResult.sessionId;
            if (docResult.documentPath) {
                this.rememberLastDocContext(docResult.documentPath, autoChatContext.agentName);
            }
            return {
                routedTo: 'conversation',
                sessionId: docResult.sessionId,
                response: docResult.response,
                shouldContinue: docResult.shouldContinue
            };

        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route with auto-chat', error instanceof Error ? error : new Error(String(error)));
            
            // Disable auto-chat on error and fall back
            this.autoChatManager?.disableAutoChat();
            
            return {
                routedTo: 'error',
                error: `Auto-chat error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Check if there's an active conversation session
     */
    hasActiveSession(): boolean {
        return this.sessionState.activeSessionId !== null;
    }

    /**
     * Get the active conversation session
     */
    getActiveSession(): any | null {
        if (!this.sessionState.activeSessionId) {
            return null;
        }
        return this.conversationManager.getSession(this.sessionState.activeSessionId);
    }

    /**
     * Set the active conversation session
     */
    setActiveSession(sessionId: string, metadata?: Partial<SessionMetadata>): void {
        this.logger.info('conversation-router', 'Setting active session', { sessionId });
        
        this.sessionState.activeSessionId = sessionId;
        
        // Update session metadata if provided
        if (metadata) {
            const existingMetadata = this.sessionState.sessionMetadata.get(sessionId);
            const updatedMetadata: SessionMetadata = {
                agentName: metadata.agentName || existingMetadata?.agentName || 'unknown',
                documentPath: metadata.documentPath || existingMetadata?.documentPath,
                templateId: metadata.templateId || existingMetadata?.templateId,
                startedAt: existingMetadata?.startedAt || new Date(),
                lastActivity: metadata.lastActivity || new Date(),
                questionCount: metadata.questionCount ?? existingMetadata?.questionCount ?? 0,
                responseCount: metadata.responseCount ?? existingMetadata?.responseCount ?? 0
            };
            
            this.sessionState.sessionMetadata.set(sessionId, updatedMetadata);
            
            // Track session by agent
            if (updatedMetadata.agentName) {
                this.sessionState.sessionsByAgent.set(updatedMetadata.agentName, sessionId);
            }
        }
        
        // Persist the state change
        this.saveSessionState();
    }

    /**
     * Clear the active conversation session
     */
    clearActiveSession(): void {
        if (this.sessionState.activeSessionId) {
            this.logger.info('conversation-router', 'Clearing active session', {
                sessionId: this.sessionState.activeSessionId
            });
            
            const metadata = this.sessionState.sessionMetadata.get(this.sessionState.activeSessionId);
            if (metadata?.agentName) {
                this.sessionState.sessionsByAgent.delete(metadata.agentName);
            }
            
            this.sessionState.sessionMetadata.delete(this.sessionState.activeSessionId);
            this.sessionState.activeSessionId = null;
            
            // Persist the state change
            this.saveSessionState();
        }
    }

    /**
     * Get session metadata
     */
    getSessionMetadata(sessionId: string): SessionMetadata | null {
        return this.sessionState.sessionMetadata.get(sessionId) || null;
    }

    /**
     * Update session activity
     */
    updateSessionActivity(sessionId: string): void {
        const metadata = this.sessionState.sessionMetadata.get(sessionId);
        if (metadata) {
            metadata.lastActivity = new Date();
            metadata.responseCount++;
            this.sessionState.sessionMetadata.set(sessionId, metadata);
        }
    }

    /**
     * Get session by agent name
     */
    getSessionByAgent(agentName: string): string | null {
        return this.sessionState.sessionsByAgent.get(agentName) || null;
    }

    /**
     * Decide when natural-language kickoff should start a DocSession even if auto-chat
     * is active from `/agent set`.
     */
    private shouldStartDocSessionFromAutoChat(
        input: string,
        context: CommandContext,
        autoChatContext: AutoChatContext | null | undefined
    ): boolean {
        if (!autoChatContext || !context.model) {
            return false;
        }

        // If auto-chat is tied to a concrete document, keep that workflow.
        if (autoChatContext.documentPath) {
            return false;
        }

        return this.looksLikeProjectKickoffInput(input);
    }

    /**
     * Heuristic for free-form "start a project/document" requests.
     */
    private looksLikeProjectKickoffInput(input: string): boolean {
        const normalized = input.trim().toLowerCase();
        if (normalized.length < 24) {
            return false;
        }

        // Prefer agent chat for short/direct Q&A style prompts.
        if (/^(what|why|how|when|where|can you|could you|would you|please)\b/.test(normalized)) {
            return false;
        }

        const kickoffPatterns = [
            /\bthis will be (a|an)\b/,
            /\bi want to (build|create|develop|design)\b/,
            /\bwe (need|are building|are creating|are developing)\b/,
            /\b(project|product|application|app|platform|system|mvp)\b/,
            /\b(prd|requirements?|design doc|design document|spec|specification)\b/
        ];

        return kickoffPatterns.some(pattern => pattern.test(normalized));
    }

    /**
     * Heuristic for "keep working on the existing document" prompts after a
     * doc session has completed.
     */
    private looksLikeDocumentRevisionInput(input: string): boolean {
        const normalized = input.trim().toLowerCase();
        if (!normalized || normalized.length < 8) {
            return false;
        }

        if (this.looksLikeProjectKickoffInput(input)) {
            return false;
        }

        if (/^\s*(\/done|done|finish|finished|complete|that['']s\s+it|looks\s+good|that\s+works)\s*[!.]?\s*$/i.test(normalized)) {
            return false;
        }

        const hasRevisionVerb = /\b(fix|improve|update|revise|refine|iterate|polish|adjust|correct|rewrite|edit|expand|clarify|address)\b/.test(normalized);
        if (!hasRevisionVerb) {
            return false;
        }

        const hasDocumentReference = /\b(document|doc|file|prd|requirements?|design|spec(ification)?|idea\s+doc)\b/.test(normalized);
        const hasReviewContinuationCue = /\b(issues?\s+found|review\s+findings|quality\s+review|from\s+the\s+review|based\s+on\s+the\s+review|same\s+document|that\s+document)\b/.test(normalized);

        return hasDocumentReference || hasReviewContinuationCue;
    }

    private async routeInputByIntentPolicy(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult | null> {
        if (!context.model) {
            return null;
        }

        const resumedDocResult = await this.tryResumeLastDocumentSession(input, context);
        if (resumedDocResult) {
            return resumedDocResult;
        }

        if (this.shouldAnalyzeRoutingIntent(input)) {
            const intent = await this.analyzeRoutingIntentWithModel(input, context);
            return await this.applyRoutingIntent(intent, input, context);
        }

        if (this.looksLikeProjectKickoffInput(input)) {
            return await this.startDocSession(input, context);
        }

        // Model selected does not necessarily mean "start a document".
        // Keep natural Q&A prompts routed to the active agent.
        return await this.routeToAgent(input, context);
    }

    private shouldAnalyzeRoutingIntent(input: string): boolean {
        if (this.looksLikeRoutingSwitchCandidate(input)) {
            return true;
        }

        if (this.looksLikeProjectKickoffInput(input) || this.looksLikeDocumentRevisionInput(input)) {
            return false;
        }

        const normalized = input.trim().toLowerCase();
        if (normalized.length < 12) {
            return false;
        }

        if (this.lastDocContext) {
            return /\b(new|another|different|instead|switch|change)\b/.test(normalized);
        }

        return false;
    }

    private looksLikeRoutingSwitchCandidate(input: string): boolean {
        const normalized = input.trim().toLowerCase();
        const switchVerb = /\b(switch|change|move|use|instead|start over|new|another|different|separate)\b/.test(normalized);
        const routeTarget = /\b(agent|document|doc|file|prd|requirements?|design|spec(ification)?|brainstorm|idea)\b/.test(normalized);
        return switchVerb && routeTarget;
    }

    private isExplicitNewDocumentRequest(input: string): boolean {
        const normalized = input.trim().toLowerCase();
        return (
            /\b(start|create|make|generate|open|begin)\s+(a\s+)?(new|another|separate|different)\s+(doc|document|file|prd|requirements?|design|spec(ification)?|idea)\b/.test(normalized) ||
            /\b(new|another)\s+(prd|requirements?|design|spec(ification)?|idea)\b/.test(normalized) ||
            /\bswitch\s+to\s+(a\s+)?(new\s+)?(prd|requirements?|design|spec(ification)?|idea)\b/.test(normalized)
        );
    }

    private async analyzeRoutingIntentWithModel(
        input: string,
        context: CommandContext
    ): Promise<RoutingIntent> {
        if (!context.model) {
            return this.fallbackRoutingIntent(input);
        }

        const currentAgentName = this.agentManager.getCurrentAgent()?.name || 'none';
        const lastDocumentPath = this.lastDocContext?.documentPath || 'none';
        const lastDocumentType = this.lastDocContext?.templateId || 'unknown';

        const prompt = vscode.LanguageModelChatMessage.User(
            `You are a router for a documentation assistant.\n` +
            `Choose exactly one action for this user message.\n\n` +
            `Actions:\n` +
            `- start_new_doc: create a brand new document session\n` +
            `- resume_last_doc: continue editing the last document\n` +
            `- route_to_agent: regular chat with current agent\n\n` +
            `Current agent: ${currentAgentName}\n` +
            `Last document path: ${lastDocumentPath}\n` +
            `Last document type: ${lastDocumentType}\n\n` +
            `User message: "${input}"\n\n` +
            `Respond with JSON only:\n` +
            `{"action":"route_to_agent","confidence":0.0,"reason":"...","requiresConfirmation":false,"targetDocType":"prd","targetAgent":"prd-creator"}\n` +
            `Rules:\n` +
            `- confidence must be between 0 and 1\n` +
            `- targetDocType must be one of: prd, requirements, design, spec, brainstorm (or null)\n` +
            `- requiresConfirmation should be true if switching doc/agent could be disruptive`
        );

        try {
            const response = await context.model.sendRequest([prompt], {}, context.token);
            let raw = '';
            for await (const chunk of response.text) {
                raw += chunk;
            }

            const jsonCandidate = this.extractJsonObject(raw);
            if (!jsonCandidate) {
                return this.fallbackRoutingIntent(input);
            }

            const parsed = JSON.parse(jsonCandidate);
            const action = this.normalizeRoutingIntentAction(parsed.action);
            const confidence = this.clampConfidence(parsed.confidence);
            const targetDocType = this.normalizeDocType(parsed.targetDocType);
            const targetAgent = typeof parsed.targetAgent === 'string' ? parsed.targetAgent.trim() || undefined : undefined;
            const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
                ? parsed.reason.trim().slice(0, 180)
                : 'Model-routed decision.';

            const requiresConfirmation = typeof parsed.requiresConfirmation === 'boolean'
                ? parsed.requiresConfirmation
                : action === 'start_new_doc' && Boolean(this.lastDocContext);

            return {
                action,
                confidence,
                reason,
                requiresConfirmation,
                targetDocType,
                targetAgent
            };
        } catch (error) {
            this.logger.warn('conversation-router', 'Routing intent analysis failed; using heuristic fallback', error instanceof Error ? error : new Error(String(error)));
            return this.fallbackRoutingIntent(input);
        }
    }

    private fallbackRoutingIntent(input: string): RoutingIntent {
        if (this.lastDocContext && this.looksLikeDocumentRevisionInput(input)) {
            return {
                action: 'resume_last_doc',
                confidence: 0.8,
                reason: 'Heuristic: revision terms plus existing document context.',
                requiresConfirmation: false
            };
        }

        if (this.looksLikeRoutingSwitchCandidate(input) || this.isExplicitNewDocumentRequest(input)) {
            return {
                action: 'start_new_doc',
                confidence: 0.65,
                reason: 'Heuristic: switch/new document wording detected.',
                requiresConfirmation: Boolean(this.lastDocContext)
            };
        }

        return {
            action: 'route_to_agent',
            confidence: 0.55,
            reason: 'Heuristic: default to current agent chat.',
            requiresConfirmation: false
        };
    }

    private normalizeRoutingIntentAction(action: unknown): RoutingIntentAction {
        if (action === 'start_new_doc' || action === 'resume_last_doc' || action === 'route_to_agent') {
            return action;
        }
        return 'route_to_agent';
    }

    private normalizeDocType(value: unknown): DocType | undefined {
        if (value === 'prd' || value === 'requirements' || value === 'design' || value === 'spec' || value === 'brainstorm') {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'specification') {
                return 'spec';
            }
            if (normalized === 'ideas' || normalized === 'idea') {
                return 'brainstorm';
            }
        }
        return undefined;
    }

    private clampConfidence(value: unknown): number {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numeric)) {
            return 0.5;
        }
        return Math.max(0, Math.min(1, numeric));
    }

    private extractJsonObject(raw: string): string | null {
        const stripped = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const firstBrace = stripped.indexOf('{');
        const lastBrace = stripped.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            return null;
        }
        return stripped.slice(firstBrace, lastBrace + 1);
    }

    private async applyRoutingIntent(
        intent: RoutingIntent,
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        if (intent.action === 'resume_last_doc') {
            const resumed = await this.resumeLastDocumentSession(input, context);
            if (resumed) {
                return resumed;
            }

            return {
                routedTo: 'agent',
                agentName: this.agentManager.getCurrentAgent()?.name,
                response: 'No previous document is available to resume. Tell me what new document you want to create.',
                shouldContinue: false
            };
        }

        if (intent.action === 'start_new_doc') {
            if (this.mustConfirmRoutingIntent(intent, input)) {
                this.queuePendingRoutingDecision(intent, input);
                return this.createRoutingConfirmationResponse(intent);
            }

            return await this.executeRoutingIntent(intent, input, context);
        }

        return await this.routeToAgent(input, context);
    }

    private mustConfirmRoutingIntent(intent: RoutingIntent, input: string): boolean {
        if (intent.action !== 'start_new_doc') {
            return false;
        }

        if (!this.lastDocContext) {
            return false;
        }

        if (this.isExplicitNewDocumentRequest(input) && intent.confidence >= 0.7 && !intent.requiresConfirmation) {
            return false;
        }

        return intent.requiresConfirmation || intent.confidence < 0.9;
    }

    private queuePendingRoutingDecision(
        intent: RoutingIntent,
        input: string,
        activeDocSessionIdToClose?: string
    ): void {
        const now = Date.now();
        this.pendingRoutingDecision = {
            intent,
            originalInput: input,
            activeDocSessionIdToClose,
            createdAt: new Date(now),
            expiresAt: new Date(now + 10 * 60 * 1000)
        };
    }

    private createRoutingConfirmationResponse(intent: RoutingIntent): ConversationRoutingResult {
        const docTypeHint = intent.targetDocType ? ` (${intent.targetDocType})` : '';
        const existingDocPath = this.lastDocContext?.documentPath
            ? this.lastDocContext.documentPath.replace(/\\/g, '/')
            : null;

        const response = [
            `I inferred that you may want to start a new document${docTypeHint}.`,
            intent.reason ? `Reason: ${intent.reason}` : '',
            existingDocPath ? `Current working document: \`${existingDocPath}\`` : '',
            '',
            'Reply `yes` to switch/create a new document, or `no` to keep the current context.'
        ].filter(Boolean).join('\n');

        return {
            routedTo: 'agent',
            agentName: this.agentManager.getCurrentAgent()?.name,
            response,
            shouldContinue: false
        };
    }

    private async handlePendingRoutingDecision(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult | null> {
        if (!this.pendingRoutingDecision) {
            return null;
        }

        if (Date.now() > this.pendingRoutingDecision.expiresAt.getTime()) {
            this.pendingRoutingDecision = null;
            return null;
        }

        const confirmation = this.parseConfirmationResponse(input);
        if (confirmation === 'yes') {
            const pending = this.pendingRoutingDecision;
            this.pendingRoutingDecision = null;

            if (pending.activeDocSessionIdToClose) {
                DocSessionManager.getInstance().closeSession(pending.activeDocSessionIdToClose);
                if (this.activeDocSessionId === pending.activeDocSessionIdToClose) {
                    this.activeDocSessionId = null;
                }
            }

            return await this.executeRoutingIntent(pending.intent, pending.originalInput, context);
        }

        if (confirmation === 'no') {
            this.pendingRoutingDecision = null;
            return {
                routedTo: 'agent',
                agentName: this.agentManager.getCurrentAgent()?.name,
                response: 'Keeping the current context. Tell me what you want to do next.',
                shouldContinue: false
            };
        }

        return {
            routedTo: 'agent',
            agentName: this.agentManager.getCurrentAgent()?.name,
            response: 'Please reply `yes` or `no` so I can confirm the switch.',
            shouldContinue: false
        };
    }

    private parseConfirmationResponse(input: string): 'yes' | 'no' | 'unknown' {
        const normalized = input.trim().toLowerCase();
        if (/^(y|yes|yeah|yep|confirm|ok|okay|continue|do it|proceed)[!.]?$/.test(normalized)) {
            return 'yes';
        }
        if (/^(n|no|nope|cancel|stop|stay|keep current|keep)[!.]?$/.test(normalized)) {
            return 'no';
        }
        return 'unknown';
    }

    private async executeRoutingIntent(
        intent: RoutingIntent,
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        this.logger.info('conversation-router', 'Executing routing intent', {
            action: intent.action,
            confidence: intent.confidence,
            reason: intent.reason,
            targetDocType: intent.targetDocType,
            targetAgent: intent.targetAgent
        });

        if (intent.action === 'resume_last_doc') {
            const resumed = await this.resumeLastDocumentSession(input, context);
            if (resumed) {
                return resumed;
            }

            return {
                routedTo: 'error',
                error: 'Unable to resume the previous document session.'
            };
        }

        if (intent.action === 'start_new_doc') {
            return await this.startDocSession(input, context, {
                forcedDocType: intent.targetDocType
            });
        }

        return await this.routeToAgent(input, context);
    }

    private async tryHandleSwitchIntentDuringActiveDocSession(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult | null> {
        if (!context.model || !this.looksLikeRoutingSwitchCandidate(input)) {
            return null;
        }

        const intent = await this.analyzeRoutingIntentWithModel(input, context);
        if (intent.action !== 'start_new_doc') {
            return null;
        }

        if (this.mustConfirmRoutingIntent(intent, input)) {
            this.queuePendingRoutingDecision(intent, input, this.activeDocSessionId || undefined);
            return this.createRoutingConfirmationResponse(intent);
        }

        const sessionToClose = this.activeDocSessionId;
        if (sessionToClose) {
            DocSessionManager.getInstance().closeSession(sessionToClose);
            this.activeDocSessionId = null;
        }

        return await this.executeRoutingIntent(intent, input, context);
    }

    /**
     * Route input to active conversation
     */
    private async routeToConversation(
        sessionId: string,
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            this.logger.info('conversation-router', 'Routing to conversation', { sessionId });
            
            // Update session activity
            this.updateSessionActivity(sessionId);
            
            // Continue the conversation
            const response = await this.conversationManager.continueConversation(sessionId, input);
            
            // Check if conversation is complete
            const session = this.conversationManager.getSession(sessionId);
            const isComplete = !session?.state.isActive || response.conversationComplete;
            
            if (isComplete) {
                this.logger.info('conversation-router', 'Conversation completed, clearing session', { sessionId });
                this.clearActiveSession();
            }
            
            return {
                routedTo: 'conversation',
                sessionId,
                response: response.agentMessage,
                shouldContinue: !isComplete
            };
            
        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route to conversation', error instanceof Error ? error : new Error(String(error)));
            
            // Try to recover from the error
            if (this.errorRecovery && error instanceof ConversationError) {
                try {
                    await this.errorRecovery.recoverFromFailure(error, context);
                } catch (recoveryError) {
                    this.logger.error('conversation-router', 'Error recovery failed', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)));
                }
            }
            
            // Clear the problematic session
            this.clearActiveSession();
            
            return {
                routedTo: 'error',
                error: `Conversation error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Start a brand-new natural-language doc session via DocSessionManager.
     */
    private async startDocSession(
        input: string,
        context: CommandContext,
        options?: {
            forcedDocType?: DocType;
        }
    ): Promise<ConversationRoutingResult> {
        try {
            const docMgr = DocSessionManager.getInstance();
            const result = await docMgr.startNewSession(input, context, {
                forcedDocType: options?.forcedDocType
            });
            const createdSession = result.sessionId ? docMgr.getSession(result.sessionId) : undefined;

            if (result.sessionId) {
                this.activeDocSessionId = result.sessionId;
            }
            if (result.documentPath) {
                this.rememberLastDocContext(result.documentPath, createdSession?.agentName);
            }

            return {
                routedTo: 'agent',
                agentName: createdSession?.agentName,
                sessionId: result.sessionId,
                response: result.response,
                shouldContinue: result.shouldContinue
            };
        } catch (error) {
            this.logger.error('conversation-router', 'Failed to start doc session', error instanceof Error ? error : new Error(String(error)));
            return { routedTo: 'error', error: String(error) };
        }
    }

    /**
     * Continue an active natural-language doc session via DocSessionManager.
     */
    private async routeToDocSession(
        sessionId: string,
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            const docMgr = DocSessionManager.getInstance();
            const existingSession = docMgr.getSession(sessionId);
            const result = await docMgr.continueSession(sessionId, input, context);
            const activeSession = docMgr.getSession(sessionId);
            const agentName = activeSession?.agentName || existingSession?.agentName;

            if (result.documentPath) {
                this.rememberLastDocContext(result.documentPath, agentName);
            }

            if (!result.shouldContinue) {
                this.activeDocSessionId = null;
            }

            return {
                routedTo: 'conversation',
                agentName,
                sessionId: result.sessionId,
                response: result.response,
                shouldContinue: result.shouldContinue
            };
        } catch (error) {
            this.logger.error('conversation-router', 'Failed to continue doc session', error instanceof Error ? error : new Error(String(error)));
            this.activeDocSessionId = null;
            return { routedTo: 'error', error: String(error) };
        }
    }

    /**
     * Route input to current agent
     */
    private async routeToAgent(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult> {
        try {
            const currentAgent = this.agentManager.getCurrentAgent();
            
            if (!currentAgent) {
                return {
                    routedTo: 'error',
                    error: 'No active agent available'
                };
            }
            
            this.logger.info('conversation-router', 'Routing to agent', { agentName: currentAgent.name });
            
            // Build agent context
            const agentContext = this.agentManager.buildAgentContext(context.request);
            
            // Create agent request
            const agentRequest: import('../agents/types').ChatRequest = {
                command: context.request.command,
                prompt: input,
                parameters: {},
                originalRequest: context.request
            };
            
            // Handle request with agent
            const agentResponse = await currentAgent.handleRequest(agentRequest, agentContext);
            
            return {
                routedTo: 'agent',
                agentName: currentAgent.name,
                response: agentResponse.content || '',
                shouldContinue: false
            };
            
        } catch (error) {
            this.logger.error('conversation-router', 'Failed to route to agent', error instanceof Error ? error : new Error(String(error)));
            
            return {
                routedTo: 'error',
                error: `Agent error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async tryResumeLastDocumentSession(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult | null> {
        if (!this.lastDocContext || !this.looksLikeDocumentRevisionInput(input)) {
            return null;
        }

        return await this.resumeLastDocumentSession(input, context);
    }

    private async resumeLastDocumentSession(
        input: string,
        context: CommandContext
    ): Promise<ConversationRoutingResult | null> {
        if (!this.lastDocContext) {
            return null;
        }

        try {
            const docMgr = DocSessionManager.getInstance();
            const result = await docMgr.startSessionFromExistingDocument(
                this.lastDocContext.documentPath,
                context,
                {
                    templateId: this.lastDocContext.templateId,
                    agentName: this.lastDocContext.agentName,
                    initialUserInput: input
                }
            );

            const session = result.sessionId ? docMgr.getSession(result.sessionId) : undefined;
            if (result.sessionId) {
                this.activeDocSessionId = result.sessionId;
            }
            if (result.documentPath) {
                this.rememberLastDocContext(result.documentPath, session?.agentName || this.lastDocContext.agentName);
            }

            return {
                routedTo: 'conversation',
                sessionId: result.sessionId,
                agentName: session?.agentName || this.lastDocContext.agentName,
                response: result.response,
                shouldContinue: result.shouldContinue
            };
        } catch (error) {
            this.logger.warn('conversation-router', 'Failed to resume last document session, falling back to normal routing', error instanceof Error ? error : new Error(String(error)));
            return null;
        }
    }

    private rememberLastDocContext(documentPath: string, agentName?: string): void {
        this.lastDocContext = {
            documentPath,
            agentName,
            templateId: this.inferTemplateId(documentPath, agentName),
            lastActivity: new Date()
        };
    }

    private inferTemplateId(documentPath: string, agentName?: string): string | undefined {
        const normalizedPath = documentPath.replace(/\\/g, '/').toLowerCase();
        if (normalizedPath.includes('/docs/prd/')) {
            return 'prd';
        }
        if (normalizedPath.includes('/docs/requirements/')) {
            return 'requirements';
        }
        if (normalizedPath.includes('/docs/design/')) {
            return 'design';
        }
        if (normalizedPath.includes('/docs/spec/')) {
            return 'spec';
        }
        if (normalizedPath.includes('/docs/ideas/')) {
            return 'brainstorm';
        }

        switch ((agentName || '').toLowerCase()) {
            case 'prd-creator':
                return 'prd';
            case 'requirements-gatherer':
                return 'requirements';
            case 'solution-architect':
                return 'design';
            case 'specification-writer':
                return 'spec';
            case 'brainstormer':
                return 'brainstorm';
            default:
                return undefined;
        }
    }

    /**
     * Clean up inactive sessions
     */
    cleanupInactiveSessions(): void {
        const now = new Date();
        const maxInactiveTime = 30 * 60 * 1000; // 30 minutes
        
        for (const [sessionId, metadata] of this.sessionState.sessionMetadata.entries()) {
            const inactiveTime = now.getTime() - metadata.lastActivity.getTime();
            
            if (inactiveTime > maxInactiveTime) {
                this.logger.info('conversation-router', 'Cleaning up inactive session', {
                    sessionId,
                    inactiveTime: Math.round(inactiveTime / 1000)
                });
                
                // Remove from our tracking
                this.sessionState.sessionMetadata.delete(sessionId);
                if (metadata.agentName) {
                    this.sessionState.sessionsByAgent.delete(metadata.agentName);
                }
                
                // Clear active session if it's this one
                if (this.sessionState.activeSessionId === sessionId) {
                    this.sessionState.activeSessionId = null;
                }
            }
        }
    }

    /**
     * Get session state for debugging
     */
    getSessionState(): ConversationSessionState {
        return {
            activeSessionId: this.sessionState.activeSessionId,
            sessionsByAgent: new Map(this.sessionState.sessionsByAgent),
            sessionMetadata: new Map(this.sessionState.sessionMetadata)
        };
    }

    /**
     * Get auto-chat manager instance
     */
    getAutoChatManager(): AutoChatStateManager | undefined {
        return this.autoChatManager;
    }

    /**
     * Get document update engine instance
     */
    getDocumentUpdateEngine(): DocumentUpdateEngine | undefined {
        return this.documentUpdateEngine;
    }

    /**
     * Load session state from persistence
     */
    private async loadSessionState(): Promise<void> {
        if (!this.extensionContext) {
            return;
        }

        try {
            const persistedState = this.extensionContext.globalState.get<any>('conversationSessionState');
            
            if (persistedState) {
                this.sessionState.activeSessionId = persistedState.activeSessionId || null;
                
                // Restore maps from serialized data
                if (persistedState.sessionsByAgent) {
                    this.sessionState.sessionsByAgent = new Map(Object.entries(persistedState.sessionsByAgent));
                }
                
                if (persistedState.sessionMetadata) {
                    const metadataEntries: [string, SessionMetadata][] = Object.entries(persistedState.sessionMetadata).map(([key, value]: [string, any]) => [
                        key,
                        {
                            ...value,
                            startedAt: new Date(value.startedAt),
                            lastActivity: new Date(value.lastActivity)
                        }
                    ]);
                    this.sessionState.sessionMetadata = new Map(metadataEntries);
                }
                
                this.logger.info('conversation-router', 'Session state loaded from persistence', {
                    activeSessionId: this.sessionState.activeSessionId,
                    sessionCount: this.sessionState.sessionMetadata.size
                });
            }
        } catch (error) {
            this.logger.warn('conversation-router', 'Failed to load session state', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Save session state to persistence
     */
    private async saveSessionState(): Promise<void> {
        if (!this.extensionContext) {
            return;
        }

        try {
            // Convert maps to serializable objects
            const serializableState = {
                activeSessionId: this.sessionState.activeSessionId,
                sessionsByAgent: Object.fromEntries(this.sessionState.sessionsByAgent),
                sessionMetadata: Object.fromEntries(
                    Array.from(this.sessionState.sessionMetadata.entries()).map(([key, value]) => [
                        key,
                        {
                            ...value,
                            startedAt: value.startedAt.toISOString(),
                            lastActivity: value.lastActivity.toISOString()
                        }
                    ])
                )
            };
            
            await this.extensionContext.globalState.update('conversationSessionState', serializableState);
            
            this.logger.debug('conversation-router', 'Session state saved to persistence');
        } catch (error) {
            this.logger.warn('conversation-router', 'Failed to save session state', error instanceof Error ? error : new Error(String(error)));
        }
    }

}

