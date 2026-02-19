import * as vscode from 'vscode';
import * as path from 'path';
import { CommandContext } from '../commands/types';
import { FileUtils } from '../utils/FileUtils';

export type DocType = 'prd' | 'requirements' | 'design' | 'spec' | 'brainstorm';

export interface DocSession {
    id: string;
    docType: DocType;
    agentName: string;
    documentPath: string;
    turnCount: number;
    createdAt: Date;
    lastActivity: Date;
}

export interface DocSessionResult {
    response: string;
    sessionId: string;
    documentPath: string;
    shouldContinue: boolean;
}

export interface ExistingDocSessionOptions {
    templateId?: string;
    agentName?: string;
    initialUserInput?: string;
}

const DOC_TYPE_META: Record<DocType, {
    agentName: string;
    agentTitle: string;
    folder: string;
    docLabel: string;
    systemPrompt: string;
}> = {
    prd: {
        agentName: 'prd-creator',
        agentTitle: 'PRD Creator',
        folder: 'docs/prd',
        docLabel: 'Product Requirements Document (PRD)',
        systemPrompt:
            `You are a senior product manager specialising in Product Requirements Documents (PRDs). ` +
            `Your role is to help the user develop a comprehensive PRD through focused conversation. ` +
            `Ask about goals, target users, key features, success metrics, and constraints. ` +
            `Each response should: (1) incorporate the user's latest input into the document, ` +
            `(2) ask exactly ONE focused follow-up question to uncover more detail.`
    },
    requirements: {
        agentName: 'requirements-gatherer',
        agentTitle: 'Requirements Gatherer',
        folder: 'docs/requirements',
        docLabel: 'Requirements Document',
        systemPrompt:
            `You are a senior business analyst specialising in requirements engineering. ` +
            `Your role is to help the user produce a thorough Requirements Document. ` +
            `Cover functional requirements, non-functional requirements, acceptance criteria, ` +
            `constraints, and dependencies. Each response should: (1) incorporate the user's ` +
            `latest input, (2) ask exactly ONE focused follow-up question.`
    },
    design: {
        agentName: 'solution-architect',
        agentTitle: 'Solution Architect',
        folder: 'docs/design',
        docLabel: 'Design Document',
        systemPrompt:
            `You are a senior solution architect. ` +
            `Your role is to help the user create a comprehensive Design Document covering ` +
            `system architecture, component design, data flows, API contracts, technology ` +
            `choices, and scalability considerations. Each response should: (1) incorporate ` +
            `the user's latest input, (2) ask exactly ONE focused follow-up question.`
    },
    spec: {
        agentName: 'specification-writer',
        agentTitle: 'Specification Writer',
        folder: 'docs/spec',
        docLabel: 'Technical Specification',
        systemPrompt:
            `You are a senior technical writer specialising in implementation specifications. ` +
            `Your role is to help the user create a detailed Technical Specification Document ` +
            `covering implementation tasks, interfaces, data models, error handling, and ` +
            `testing strategy. Each response should: (1) incorporate the user's latest input, ` +
            `(2) ask exactly ONE focused follow-up question.`
    },
    brainstorm: {
        agentName: 'brainstormer',
        agentTitle: 'Brainstormer',
        folder: 'docs/ideas',
        docLabel: 'Idea Document',
        systemPrompt:
            `You are a creative brainstorming facilitator. ` +
            `Your role is to help the user explore and expand their ideas into a well-structured ` +
            `Idea Document covering concept overview, motivations, potential approaches, ` +
            `opportunities, risks, and next steps. Each response should: (1) incorporate the ` +
            `user's latest input, (2) ask exactly ONE focused follow-up question to deepen ` +
            `the exploration.`
    }
};

const DONE_PATTERNS = [
    /^\s*(\/done|done|finish|finished|complete|that['']s\s+it|looks\s+good|that\s+works)\s*[!.]?\s*$/i
];

function userWantsDone(input: string): boolean {
    return DONE_PATTERNS.some(p => p.test(input));
}

export class DocSessionManager {
    private static instance: DocSessionManager | undefined;
    private sessions = new Map<string, DocSession>();

    private constructor() {}

    static getInstance(): DocSessionManager {
        if (!DocSessionManager.instance) {
            DocSessionManager.instance = new DocSessionManager();
        }
        return DocSessionManager.instance;
    }

    hasSession(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    getSession(sessionId: string): DocSession | undefined {
        return this.sessions.get(sessionId);
    }

    clearAll(): void {
        this.sessions.clear();
    }

    async startNewSession(
        input: string,
        context: CommandContext
    ): Promise<DocSessionResult> {
        const model = context.model;
        if (!model) {
            return this.noModelFallback();
        }

        const classification = await this.classifyIntent(input, model, context.token);
        const meta = DOC_TYPE_META[classification.docType];

        const draftContent = await this.generateInitialDraft(
            classification.title,
            input,
            classification.docType,
            meta,
            model,
            context.token
        );

        const documentPath = this.buildFilePath(
            context.workspaceRoot,
            meta.folder,
            classification.title
        );
        await this.writeDocumentFile(documentPath, draftContent);

        const firstQuestion = await this.generateFirstQuestion(
            classification.title,
            draftContent,
            classification.docType,
            meta,
            model,
            context.token
        );

        const sessionId = `docsess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const session: DocSession = {
            id: sessionId,
            docType: classification.docType,
            agentName: meta.agentName,
            documentPath,
            turnCount: 1,
            createdAt: new Date(),
            lastActivity: new Date()
        };
        this.sessions.set(sessionId, session);

        const relPath = path.relative(context.workspaceRoot, documentPath).replace(/\\/g, '/');
        const response =
            `## ${meta.agentTitle} - New ${meta.docLabel}\n\n` +
            `Created \`${relPath}\` with an initial draft.\n\n` +
            `---\n\n` +
            `${firstQuestion}\n\n` +
            `---\n` +
            `*Just reply to continue. Type \`done\` when you're happy with the document.*`;

        return { response, sessionId, documentPath, shouldContinue: true };
    }

    /**
     * Attach DocSession flow to an existing document path (e.g. /new auto-chat).
     * If initialUserInput is provided, the first refinement turn is executed immediately.
     */
    async startSessionFromExistingDocument(
        documentPath: string,
        context: CommandContext,
        options: ExistingDocSessionOptions = {}
    ): Promise<DocSessionResult> {
        const docType = this.resolveDocType(options.templateId, options.agentName, documentPath);
        const meta = DOC_TYPE_META[docType];
        const title = this.getTitleFromPath(documentPath);

        const existingContent = await this.readDocumentFile(documentPath);
        if (!existingContent.trim()) {
            await this.writeDocumentFile(documentPath, `# ${title}\n\n[Initial content pending refinement]\n`);
        }

        const sessionId = `docsess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const session: DocSession = {
            id: sessionId,
            docType,
            agentName: meta.agentName,
            documentPath,
            turnCount: 1,
            createdAt: new Date(),
            lastActivity: new Date()
        };
        this.sessions.set(sessionId, session);

        const initialUserInput = options.initialUserInput?.trim();
        if (initialUserInput) {
            return this.continueSession(sessionId, initialUserInput, context);
        }

        const model = context.model;
        const currentContent = await this.readDocumentFile(documentPath);
        const firstQuestion = model
            ? await this.generateFirstQuestion(title, currentContent, docType, meta, model, context.token)
            : 'What should we refine first in this document?';

        const relPath = path.relative(context.workspaceRoot, documentPath).replace(/\\/g, '/');
        const response =
            `## ${meta.agentTitle} - Continuing ${meta.docLabel}\n\n` +
            `Attached to existing file \`${relPath}\`.\n\n` +
            `${firstQuestion}\n\n` +
            `---\n*Type \`done\` when you're satisfied with the document.*`;

        return {
            response,
            sessionId,
            documentPath,
            shouldContinue: true
        };
    }

    async continueSession(
        sessionId: string,
        input: string,
        context: CommandContext
    ): Promise<DocSessionResult> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Doc session not found: ${sessionId}`);
        }

        const model = context.model;

        if (userWantsDone(input)) {
            this.sessions.delete(sessionId);
            const relPath = path.relative(context.workspaceRoot, session.documentPath).replace(/\\/g, '/');
            return {
                response:
                    `Session complete. Your ${DOC_TYPE_META[session.docType].docLabel} is saved at \`${relPath}\`.\n\n` +
                    `You can:\n` +
                    `- Open the file to review the final document\n` +
                    `- Start a new session by describing your next project\n` +
                    `- Use \`/review --file "${relPath}"\` for a quality review`,
                sessionId,
                documentPath: session.documentPath,
                shouldContinue: false
            };
        }

        if (!model) {
            session.turnCount++;
            session.lastActivity = new Date();
            const relPath = path.relative(context.workspaceRoot, session.documentPath).replace(/\\/g, '/');
            return {
                response:
                    `Got your feedback. The file is at \`${relPath}\`.\n` +
                    `*(No language model is currently selected - connect a model to enable automatic document updates.)*`,
                sessionId,
                documentPath: session.documentPath,
                shouldContinue: true
            };
        }

        const currentContent = await this.readDocumentFile(session.documentPath);
        const meta = DOC_TYPE_META[session.docType];

        const refinedResult = await this.refineDocument(
            currentContent,
            input,
            session,
            meta,
            model,
            context.token
        );

        if (refinedResult.updatedContent) {
            await this.writeDocumentFile(session.documentPath, refinedResult.updatedContent);
        }

        session.turnCount++;
        session.lastActivity = new Date();

        const relPath = path.relative(context.workspaceRoot, session.documentPath).replace(/\\/g, '/');
        const updateNote = refinedResult.updatedContent
            ? `*Document updated* (\`${relPath}\`, turn ${session.turnCount})\n\n`
            : '';

        const response =
            updateNote +
            `${refinedResult.nextQuestion}\n\n` +
            `---\n*Type \`done\` when you're satisfied with the document.*`;

        return { response, sessionId, documentPath: session.documentPath, shouldContinue: true };
    }

    private async classifyIntent(
        input: string,
        model: vscode.LanguageModelChat,
        token: vscode.CancellationToken
    ): Promise<{ docType: DocType; title: string }> {
        const prompt = vscode.LanguageModelChatMessage.User(
            `Classify the following user message into exactly one document type and extract a concise title.\n\n` +
            `Document types:\n` +
            `- prd: Product Requirements Document - new product/feature ideas, MVP definitions\n` +
            `- requirements: Requirements Document - functional/non-functional requirements, user stories\n` +
            `- design: Design Document - system architecture, component design, technology choices\n` +
            `- spec: Technical Specification - implementation tasks, interfaces, data models\n` +
            `- brainstorm: Idea / Brainstorming - exploratory ideas, concepts, not yet a formal doc type\n\n` +
            `User message: "${input}"\n\n` +
            `Respond with ONLY a JSON object like this (no markdown, no explanation):\n` +
            `{"docType": "prd", "title": "Concise Title Here"}`
        );

        try {
            const response = await model.sendRequest([prompt], {}, token);
            let raw = '';
            for await (const chunk of response.text) { raw += chunk; }

            const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(jsonStr);

            const docType = (['prd', 'requirements', 'design', 'spec', 'brainstorm'] as DocType[]).includes(parsed.docType)
                ? (parsed.docType as DocType)
                : 'prd';

            const title = (typeof parsed.title === 'string' && parsed.title.trim())
                ? parsed.title.trim()
                : 'New Document';

            return { docType, title };
        } catch {
            const words = input.trim().split(/\s+/).slice(0, 8).join(' ');
            return { docType: 'prd', title: words || 'New Document' };
        }
    }

    private async generateInitialDraft(
        title: string,
        userMessage: string,
        _docType: DocType,
        meta: typeof DOC_TYPE_META[DocType],
        model: vscode.LanguageModelChat,
        token: vscode.CancellationToken
    ): Promise<string> {
        const prompt = vscode.LanguageModelChatMessage.User(
            `${meta.systemPrompt}\n\n` +
            `The user wants to create a ${meta.docLabel} titled: "${title}".\n\n` +
            `Initial context from user:\n${userMessage}\n\n` +
            `Generate a comprehensive initial draft in Markdown. ` +
            `Use proper headings (##, ###). Include all relevant sections for a ${meta.docLabel}. ` +
            `Where you lack information, use "[TBD - see conversation]" as placeholder. ` +
            `Do NOT ask questions in the draft - just write the document.`
        );

        try {
            const response = await model.sendRequest([prompt], {}, token);
            let content = '';
            for await (const chunk of response.text) { content += chunk; }
            return content.trim() || `# ${title}\n\n*[Initial draft - content pending user input]*`;
        } catch {
            return `# ${title}\n\n*[Initial draft - language model unavailable]*`;
        }
    }

    private async generateFirstQuestion(
        title: string,
        draftContent: string,
        _docType: DocType,
        meta: typeof DOC_TYPE_META[DocType],
        model: vscode.LanguageModelChat,
        token: vscode.CancellationToken
    ): Promise<string> {
        const prompt = vscode.LanguageModelChatMessage.User(
            `${meta.systemPrompt}\n\n` +
            `You just created an initial draft of a ${meta.docLabel} titled "${title}".\n\n` +
            `Here is the draft:\n\`\`\`\n${draftContent.slice(0, 3000)}\n\`\`\`\n\n` +
            `Ask the single most important follow-up question to help refine this document. ` +
            `Be specific - refer to the content of the draft. ` +
            `Output ONLY the question (no preamble, no options list).`
        );

        try {
            const response = await model.sendRequest([prompt], {}, token);
            let question = '';
            for await (const chunk of response.text) { question += chunk; }
            return question.trim() || 'What are the most important aspects you would like to elaborate on?';
        } catch {
            return 'What are the key objectives and success criteria for this project?';
        }
    }

    private async refineDocument(
        currentContent: string,
        userFeedback: string,
        session: DocSession,
        meta: typeof DOC_TYPE_META[DocType],
        model: vscode.LanguageModelChat,
        token: vscode.CancellationToken
    ): Promise<{ updatedContent: string | null; nextQuestion: string }> {
        const MAX_DOC_CHARS = 6000;
        const truncatedContent = currentContent.length > MAX_DOC_CHARS
            ? currentContent.slice(0, MAX_DOC_CHARS) + '\n\n[... document truncated for context ...]'
            : currentContent;

        const prompt = vscode.LanguageModelChatMessage.User(
            `${meta.systemPrompt}\n\n` +
            `You are refining a ${meta.docLabel} (turn ${session.turnCount + 1}).\n\n` +
            `--- CURRENT DOCUMENT ---\n${truncatedContent}\n--- END DOCUMENT ---\n\n` +
            `User feedback / new information:\n"${userFeedback}"\n\n` +
            `Instructions:\n` +
            `1. Produce a fully updated version of the document incorporating this feedback.\n` +
            `2. After updating, ask ONE focused follow-up question to further improve it.\n\n` +
            `Respond using EXACTLY this format (include the delimiter lines as shown):\n` +
            `---DOCUMENT---\n` +
            `[full updated markdown document here]\n` +
            `---QUESTION---\n` +
            `[one focused follow-up question here]`
        );

        try {
            const response = await model.sendRequest([prompt], {}, token);
            let raw = '';
            for await (const chunk of response.text) { raw += chunk; }

            const docIndex = raw.indexOf('---DOCUMENT---');
            const qIndex = raw.indexOf('---QUESTION---');

            if (docIndex !== -1 && qIndex !== -1 && qIndex > docIndex) {
                const updatedContent = raw.slice(docIndex + '---DOCUMENT---'.length, qIndex).trim();
                const nextQuestion = raw.slice(qIndex + '---QUESTION---'.length).trim();
                return {
                    updatedContent: updatedContent || null,
                    nextQuestion: nextQuestion || 'What else would you like to refine?'
                };
            }

            return { updatedContent: null, nextQuestion: raw.trim() || 'What else would you like to add?' };
        } catch {
            return { updatedContent: null, nextQuestion: 'What aspect would you like to work on next?' };
        }
    }

    private resolveDocType(templateId?: string, agentName?: string, documentPath?: string): DocType {
        const template = (templateId || '').toLowerCase();
        if (template === 'prd') {
            return 'prd';
        }
        if (template === 'requirements') {
            return 'requirements';
        }
        if (template === 'design') {
            return 'design';
        }
        if (template === 'spec' || template === 'specification') {
            return 'spec';
        }
        if (template === 'brainstorm' || template === 'ideas') {
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
                break;
        }

        const normalizedPath = (documentPath || '').replace(/\\/g, '/').toLowerCase();
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

        return 'prd';
    }

    private getTitleFromPath(documentPath: string): string {
        const base = path.basename(documentPath, path.extname(documentPath));
        return base
            .split(/[-_]+/)
            .filter(Boolean)
            .map(token => token.charAt(0).toUpperCase() + token.slice(1))
            .join(' ') || 'Document';
    }

    private buildFilePath(workspaceRoot: string, folder: string, title: string): string {
        const safe = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'document';

        return path.join(workspaceRoot, folder, `${safe}.md`);
    }

    private async writeDocumentFile(filePath: string, content: string): Promise<void> {
        await FileUtils.ensureDirectoryExists(path.dirname(filePath));
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(content, 'utf8')
        );
    }

    private async readDocumentFile(filePath: string): Promise<string> {
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return Buffer.from(bytes).toString('utf8');
        } catch {
            return '';
        }
    }

    private noModelFallback(): DocSessionResult {
        return {
            response:
                `No language model is selected.\n\n` +
                `To use natural-language document creation, select a model in the chat toolbar above.\n\n` +
                `Alternatively, use slash commands:\n` +
                `- \`/new "Your Project Title"\` to create a document\n` +
                `- \`/prd "Title"\` for a Product Requirements Document\n` +
                `- \`/requirements\` to start requirements gathering`,
            sessionId: '',
            documentPath: '',
            shouldContinue: false
        };
    }
}
