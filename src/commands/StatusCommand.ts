/**
 * StatusCommand — /status workflow dashboard
 *
 * Shows completed phases, document paths, and recommends the next step.
 * Inspired by BMAD Method's phase-progress reporting.
 */

import { CommandDefinition, ParsedCommand, CommandContext, CommandResult } from './types';
import { WorkflowStateManager } from '../state/WorkflowStateManager';

export function createStatusCommandDefinition(
    workflowStateManager: WorkflowStateManager
): CommandDefinition {
    return {
        name: 'status',
        description: 'Show workflow progress — phases completed, documents created, and recommended next step',
        usage: '/status',
        examples: ['/status'],
        handler: async (_parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
            const summary = await workflowStateManager.getSummary();
            context.stream.markdown(summary);
            return { success: true, message: 'Status displayed' };
        }
    };
}
