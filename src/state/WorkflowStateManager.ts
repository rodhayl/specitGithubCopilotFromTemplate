/**
 * WorkflowStateManager — persists workflow progress to `.docu/workflow-state.json`
 *
 * Inspired by BMAD Method's `_bmad-output/` and Spec-Kit's `.specify/` conventions.
 * State survives VS Code restarts and is stored alongside the project documents.
 */

import * as vscode from 'vscode';
import { WorkflowState, WorkflowPhase } from '../agents/types';
import { Logger } from '../logging/Logger';

const STATE_FILE = '.docu/workflow-state.json';

const DEFAULT_STATE: WorkflowState = {
    projectId: '',
    currentPhase: 'prd',
    activeAgent: 'prd-creator',
    documents: {},
    context: {},
    history: []
};

export class WorkflowStateManager {
    private static instance: WorkflowStateManager;
    private logger: Logger;
    private cachedState: WorkflowState | null = null;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    static getInstance(): WorkflowStateManager {
        if (!WorkflowStateManager.instance) {
            WorkflowStateManager.instance = new WorkflowStateManager();
        }
        return WorkflowStateManager.instance;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /** Load state from disk (returns in-memory default if workspace unavailable) */
    async load(): Promise<WorkflowState> {
        if (this.cachedState) { return this.cachedState; }

        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            this.cachedState = { ...DEFAULT_STATE };
            return this.cachedState;
        }

        try {
            const uri = vscode.Uri.joinPath(workspaceRoot, STATE_FILE);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const parsed = JSON.parse(Buffer.from(bytes).toString('utf8')) as WorkflowState;
            this.cachedState = { ...DEFAULT_STATE, ...parsed };
            this.logger.info('state', 'Workflow state loaded from disk', { phase: this.cachedState.currentPhase });
        } catch {
            // File doesn't exist yet — start fresh
            this.cachedState = { ...DEFAULT_STATE, projectId: this.generateProjectId() };
            this.logger.info('state', 'Starting new workflow state');
        }

        return this.cachedState;
    }

    /** Persist current state to `.docu/workflow-state.json` */
    async save(state?: Partial<WorkflowState>): Promise<void> {
        const current = await this.load();
        if (state) {
            this.cachedState = { ...current, ...state };
        }

        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) { return; }

        try {
            const uri = vscode.Uri.joinPath(workspaceRoot, STATE_FILE);
            const json = JSON.stringify(this.cachedState, null, 2);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
            this.logger.info('state', 'Workflow state saved to disk');
        } catch (error) {
            this.logger.error('state', 'Failed to save workflow state', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /** Update workflow phase and optional agent */
    async setPhase(phase: WorkflowPhase, activeAgent?: string): Promise<void> {
        const state = await this.load();
        state.currentPhase = phase;
        if (activeAgent) { state.activeAgent = activeAgent; }
        this.addHistoryEvent(state, 'phase-change', { phase, activeAgent });
        await this.save(state);
    }

    /** Record a document path for a phase */
    async setDocument(phase: keyof WorkflowState['documents'], filePath: string): Promise<void> {
        const state = await this.load();
        state.documents[phase] = filePath;
        this.addHistoryEvent(state, 'document-created', { phase, filePath });
        await this.save(state);
    }

    /** Get the names of phases that have an associated document on disk */
    async getCompletedPhases(): Promise<string[]> {
        const state = await this.load();
        const workspaceRoot = this.getWorkspaceRoot();
        const phases: string[] = [];

        for (const [phase, filePath] of Object.entries(state.documents)) {
            if (!filePath) { continue; }
            if (!workspaceRoot) { phases.push(phase); continue; }
            try {
                await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspaceRoot, filePath));
                phases.push(phase);
            } catch {
                // file no longer exists
            }
        }
        return phases;
    }

    /** Return a human-readable summary for the /status command */
    async getSummary(): Promise<string> {
        const state = await this.load();
        const completed = await this.getCompletedPhases();
        const phaseOrder: WorkflowPhase[] = ['prd', 'requirements', 'design', 'implementation'];
        const phaseLabel: Record<string, string> = {
            prd: 'PRD',
            requirements: 'Requirements',
            design: 'Design',
            implementation: 'Implementation Plan'
        };

        const lines: string[] = [
            `## Workflow Status`,
            ``,
            `**Current phase:** ${phaseLabel[state.currentPhase] ?? state.currentPhase}`,
            `**Active agent:** ${state.activeAgent}`,
            ``,
            `### Documents`
        ];

        for (const phase of phaseOrder) {
            const filePath = state.documents[phase as keyof WorkflowState['documents']];
            const done = completed.includes(phase);
            const icon = done ? '✅' : '⬜';
            const label = phaseLabel[phase];
            lines.push(filePath ? `${icon} **${label}** — \`${filePath}\`` : `${icon} **${label}** — not started`);
        }

        const nextPhase = phaseOrder.find(p => !completed.includes(p));
        if (nextPhase) {
            lines.push('', `### Next Step`, `Run \`/${nextPhase}\` to start the **${phaseLabel[nextPhase]}** phase.`);
        } else {
            lines.push('', '🎉 All phases complete! Run `/review --file <doc>` to do a final quality check.');
        }

        return lines.join('\n');
    }

    /** Invalidate the in-memory cache (e.g. after direct file edits) */
    invalidateCache(): void {
        this.cachedState = null;
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private getWorkspaceRoot(): vscode.Uri | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri;
    }

    private generateProjectId(): string {
        const folder = vscode.workspace.workspaceFolders?.[0]?.name ?? 'unknown';
        return `${folder}-${Date.now()}`;
    }

    private addHistoryEvent(state: WorkflowState, event: string, data: Record<string, any>): void {
        state.history = state.history || [];
        state.history.push({ timestamp: new Date(), event, data });
        // Keep last 100 events only
        if (state.history.length > 100) {
            state.history = state.history.slice(-100);
        }
    }
}
