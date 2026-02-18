/**
 * HelpCommand — context-aware /help inspired by BMAD Method's /bmad-help
 *
 * Inspects the current workflow state and recommends the next step rather than
 * showing a static list of all commands.
 */

import { CommandDefinition, ParsedCommand, CommandContext, CommandResult } from './types';
import { WorkflowStateManager } from '../state/WorkflowStateManager';
import { AgentManager } from '../agents/AgentManager';

export function createHelpCommandDefinition(
    workflowStateManager: WorkflowStateManager,
    agentManager: AgentManager
): CommandDefinition {
    return {
        name: 'help',
        description: 'Show context-aware help — inspects your project and recommends what to do next',
        usage: '/help [command]',
        examples: ['/help', '/help status', '/help prd'],
        handler: async (parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
            const specifiedCommand = parsedCommand.arguments[0];

            if (specifiedCommand) {
                return getCommandSpecificHelp(specifiedCommand, context);
            }

            // Context-aware: inspect workflow state, recommend next step
            const state = await workflowStateManager.load();
            const completedPhases = await workflowStateManager.getCompletedPhases();
            const agents = agentManager.listAgents();

            const lines: string[] = [];

            lines.push('## 📖 Docu — Smart Help');
            lines.push('');

            // Phase-aware guidance
            const phaseOrder = ['prd', 'requirements', 'design', 'implementation'];
            const phaseLabel: Record<string, string> = {
                prd: 'PRD',
                requirements: 'Requirements',
                design: 'Design',
                implementation: 'Implementation Plan'
            };
            const phaseCommand: Record<string, string> = {
                prd: '/prd',
                requirements: '/requirements',
                design: '/design',
                implementation: '/spec'
            };
            const phaseAgent: Record<string, string> = {
                prd: 'prd-creator',
                requirements: 'requirements-gatherer',
                design: 'solution-architect',
                implementation: 'specification-writer'
            };

            const nextPhase = phaseOrder.find(p => !completedPhases.includes(p));

            if (completedPhases.length === 0) {
                lines.push('### 🚀 Getting Started');
                lines.push('');
                lines.push('You haven\'t started a project yet. Here\'s the recommended workflow:');
                lines.push('');
                lines.push('| Step | Command | Agent | Output |');
                lines.push('|------|---------|-------|--------|');
                lines.push('| 1 | `/prd` | prd-creator | prd.md |');
                lines.push('| 2 | `/requirements` | requirements-gatherer | requirements.md |');
                lines.push('| 3 | `/design` | solution-architect | design.md |');
                lines.push('| 4 | `/spec` | specification-writer | tasks.md |');
                lines.push('| 5 | `/review --file <doc>` | quality-reviewer | feedback |');
                lines.push('');
                lines.push('**Recommended:** Start with `/prd` to create your Product Requirements Document.');
            } else if (nextPhase) {
                lines.push(`### ✅ Progress: ${completedPhases.length}/4 phases complete`);
                lines.push('');
                lines.push(`**Completed:** ${completedPhases.map(p => phaseLabel[p]).join(', ')}`);
                lines.push('');
                lines.push(`### 👉 Recommended Next Step`);
                lines.push('');
                lines.push(`Run \`${phaseCommand[nextPhase]}\` to start the **${phaseLabel[nextPhase]}** phase with the **${phaseAgent[nextPhase]}** agent.`);
                lines.push('');
                lines.push('This will:');
                switch (nextPhase) {
                    case 'prd':
                        lines.push('- Help you define your product vision and requirements');
                        lines.push('- Create a structured PRD document (prd.md)');
                        break;
                    case 'requirements':
                        lines.push('- Elicit detailed functional and non-functional requirements');
                        lines.push('- Create a requirements document (requirements.md)');
                        break;
                    case 'design':
                        lines.push('- Design your system architecture based on requirements');
                        lines.push('- Create a technical design document (design.md)');
                        break;
                    case 'implementation':
                        lines.push('- Break down the design into actionable development tasks');
                        lines.push('- Create an implementation plan (tasks.md)');
                        break;
                }
            } else {
                lines.push('### 🎉 All phases complete!');
                lines.push('');
                lines.push('Your documentation suite is ready. You can:');
                lines.push('- Run `/review --file <doc>` with the quality-reviewer agent for a final check');
                lines.push('- Run `/status` to see a summary of all documents');
            }

            lines.push('');
            lines.push('---');
            lines.push('');
            lines.push('### 🔧 Available Commands');
            lines.push('');
            lines.push('| Command | Description |');
            lines.push('|---------|-------------|');
            lines.push('| `/prd` | Start PRD phase with prd-creator agent |');
            lines.push('| `/requirements` | Start requirements phase |');
            lines.push('| `/design` | Start design phase with solution-architect |');
            lines.push('| `/spec` | Create implementation plan with specification-writer |');
            lines.push('| `/review --file <path>` | Quality review a document |');
            lines.push('| `/status` | Show workflow progress dashboard |');
            lines.push('| `/context` | Show or set project context |');
            lines.push('| `/agent list` | List all available agents |');
            lines.push('| `/templates list` | List all document templates |');
            lines.push('| `/new "<title>"` | Create a new document |');
            lines.push('| `/help [command]` | This help |');

            context.stream.markdown(lines.join('\n'));
            return { success: true, message: 'Help displayed' };
        }
    };
}

function getCommandSpecificHelp(command: string, context: CommandContext): CommandResult {
    const helpMap: Record<string, string> = {
        prd: [
            '## /prd — Start PRD Phase',
            '',
            'Activates the **prd-creator** agent and guides you through creating a Product Requirements Document.',
            '',
            '**Usage:** `/prd [title]`',
            '',
            '**Examples:**',
            '- `/prd` — start a new PRD with guided questioning',
            '- `/prd "My App"` — create a PRD with the given title immediately',
            '',
            'The agent will ask about your product vision, target users, goals, and constraints.',
            'Output: `prd.md` in your workspace root.'
        ].join('\n'),

        requirements: [
            '## /requirements — Start Requirements Phase',
            '',
            'Activates the **requirements-gatherer** agent.',
            '',
            '**Usage:** `/requirements`',
            '',
            'Reads your PRD (prd.md) and elicits detailed functional and non-functional requirements.',
            'Output: `requirements.md`'
        ].join('\n'),

        design: [
            '## /design — Start Design Phase',
            '',
            'Activates the **solution-architect** agent.',
            '',
            '**Usage:** `/design`',
            '',
            'Reads your requirements (requirements.md) and creates a technical architecture document.',
            'Output: `design.md`'
        ].join('\n'),

        spec: [
            '## /spec — Start Specification Phase',
            '',
            'Activates the **specification-writer** agent.',
            '',
            '**Usage:** `/spec`',
            '',
            'Reads your design (design.md) and breaks it into actionable development tasks.',
            'Output: `tasks.md`'
        ].join('\n'),

        review: [
            '## /review — Quality Review',
            '',
            'Activates the **quality-reviewer** agent.',
            '',
            '**Usage:** `/review --file <path> [--level light|normal|strict] [--fix]`',
            '',
            '**Flags:**',
            '- `--file <path>` — document to review (required)',
            '- `--level strict` — deeper analysis (default: normal)',
            '- `--fix` — automatically apply fixable suggestions',
            '',
            '**Examples:**',
            '- `/review --file prd.md`',
            '- `/review --file requirements.md --level strict --fix`'
        ].join('\n'),

        status: [
            '## /status — Workflow Dashboard',
            '',
            'Shows a summary of all completed phases and documents.',
            '',
            '**Usage:** `/status`'
        ].join('\n'),

        context: [
            '## /context — Project Context',
            '',
            'Show or update the shared project context file (`.docu/context.md`).',
            'All agents automatically load this file to stay aligned.',
            '',
            '**Usage:** `/context`'
        ].join('\n')
    };

    const text = helpMap[command] ?? `No specific help available for \`/${command}\`. Try \`/help\` for a full list.`;
    context.stream.markdown(text);
    return { success: true, message: 'Help displayed' };
}
