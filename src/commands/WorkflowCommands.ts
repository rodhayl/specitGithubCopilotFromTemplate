/**
 * WorkflowCommands — shortcut commands for each documentation phase
 *
 * Provides `/prd`, `/requirements`, `/design`, `/spec`, `/review`, and `/context`
 * commands that automatically activate the correct agent and start work.
 *
 * Inspired by BMAD Method workflow slash commands and Spec-Kit's linear pipeline.
 */

import * as vscode from 'vscode';
import { CommandDefinition, ParsedCommand, CommandContext, CommandResult } from './types';
import { AgentManager } from '../agents/AgentManager';
import { WorkflowStateManager } from '../state/WorkflowStateManager';
import { ToolContext } from '../tools/types';

// ─── Internal helper ─────────────────────────────────────────────────────────

async function activateAgentAndDelegate(
    agentName: string,
    prompt: string,
    agentManager: AgentManager,
    context: CommandContext
): Promise<CommandResult> {
    // Switch to the correct agent
    const switched = agentManager.setCurrentAgent(agentName);
    if (!switched) {
        context.stream.markdown(`❌ Could not activate agent **${agentName}**. Is it registered?`);
        return { success: false, error: `Agent '${agentName}' not found` };
    }

    // Build an agent context and dispatch the request
    const agentContext = agentManager.buildAgentContext(context.request);
    const toolContext: ToolContext = {
        workspaceRoot: context.workspaceRoot,
        extensionContext: context.extensionContext,
        cancellationToken: context.token,
    };
    if (context.toolManager) {
        agentContext.toolManager = context.toolManager;
        agentContext.toolContext = toolContext;
    }
    const agent = agentManager.getCurrentAgent();
    if (!agent) {
        return { success: false, error: 'No active agent after switch' };
    }

    const response = await agent.handleRequest(
        { prompt, command: 'workflow-shortcut', parameters: {}, originalRequest: context.request },
        agentContext
    );

    if (context.toolManager && response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
            await context.toolManager.executeTool(toolCall.tool, toolCall.parameters, toolContext);
        }
    }

    // Stream the response
    if (response.message) {
        context.stream.markdown(response.message);
    }
    if (response.followupSuggestions && response.followupSuggestions.length > 0) {
        const suggestions = response.followupSuggestions
            .slice(0, 4)
            .map((s: string) => `- ${s}`)
            .join('\n');
        context.stream.markdown(`\n**Suggested next steps:**\n${suggestions}`);
    }

    return { success: response.success !== false, message: response.message };
}

// ─── Command definitions ──────────────────────────────────────────────────────

export function createWorkflowCommandDefinitions(
    workflowStateManager: WorkflowStateManager,
    agentManager: AgentManager
): CommandDefinition[] {
    return [
        // /prd — PRD phase
        {
            name: 'prd',
            description: 'Start the PRD phase — activates prd-creator and creates prd.md',
            usage: '/prd [title]',
            examples: ['/prd', '/prd "My Application"'],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
                const title = parsedCommand.arguments.join(' ').trim();
                const prompt = title ? `create PRD: ${title}` : 'create PRD';
                await workflowStateManager.setPhase('prd', 'prd-creator');
                const result = await activateAgentAndDelegate('prd-creator', prompt, agentManager, context);
                if (result.success) {
                    // Record doc path from agent state or fallback
                    const doc = agentManager.getWorkflowState().documents?.prd;
                    if (doc) { await workflowStateManager.setDocument('prd', doc); }
                }
                return result;
            }
        },

        // /requirements — Requirements phase
        {
            name: 'requirements',
            description: 'Start the requirements phase — activates requirements-gatherer and creates requirements.md',
            usage: '/requirements',
            examples: ['/requirements'],
            handler: async (_parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
                await workflowStateManager.setPhase('requirements', 'requirements-gatherer');
                const result = await activateAgentAndDelegate('requirements-gatherer', 'gather requirements', agentManager, context);
                if (result.success) { await workflowStateManager.setDocument('requirements', 'requirements.md'); }
                return result;
            }
        },

        // /design — Design phase
        {
            name: 'design',
            description: 'Start the design phase — activates solution-architect and creates design.md',
            usage: '/design',
            examples: ['/design'],
            handler: async (_parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
                await workflowStateManager.setPhase('design', 'solution-architect');
                const result = await activateAgentAndDelegate('solution-architect', 'create design document based on requirements', agentManager, context);
                if (result.success) { await workflowStateManager.setDocument('design', 'design.md'); }
                return result;
            }
        },

        // /spec — Specification / Implementation Plan phase
        {
            name: 'spec',
            description: 'Start the specification phase — activates specification-writer and creates tasks.md',
            usage: '/spec',
            examples: ['/spec'],
            handler: async (_parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
                await workflowStateManager.setPhase('implementation', 'specification-writer');
                const result = await activateAgentAndDelegate('specification-writer', 'create implementation plan from design', agentManager, context);
                if (result.success) { await workflowStateManager.setDocument('tasks', 'tasks.md'); }
                return result;
            }
        },

        // /review — Quality review shortcut
        {
            name: 'review',
            description: 'Review document quality — activates quality-reviewer. Use --file <path> [--level strict] [--fix]',
            usage: '/review --file <path> [--level light|normal|strict] [--fix]',
            examples: [
                '/review --file prd.md',
                '/review --file requirements.md --level strict',
                '/review --file design.md --fix'
            ],
            flags: [
                { name: 'file', description: 'Path to file to review', type: 'string', required: true },
                { name: 'level', description: 'Review depth: light, normal, or strict', type: 'string' },
                { name: 'fix', description: 'Automatically apply fixable suggestions', type: 'boolean' }
            ],
            handler: async (parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
                const file = parsedCommand.flags.file as string;
                const level = (parsedCommand.flags.level as string) || 'normal';
                const fix = parsedCommand.flags.fix ? '--fix' : '';

                if (!file) {
                    context.stream.markdown('❌ Please specify a file: `/review --file <path>`\n\nExample: `/review --file prd.md --level strict`');
                    return { success: false, error: 'Missing --file flag' };
                }

                const prompt = `review --file ${file} --level ${level} ${fix}`.trim();
                return activateAgentAndDelegate('quality-reviewer', prompt, agentManager, context);
            }
        },

        // /context — Show or update project context
        {
            name: 'context',
            description: 'Show or update the shared project context file (.docu/context.md)',
            usage: '/context',
            examples: ['/context'],
            handler: async (_parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
                try {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders || workspaceFolders.length === 0) {
                        context.stream.markdown('\u274c No workspace open. Open a folder first.');
                        return { success: false, error: 'No workspace' };
                    }

                    const contextUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.docu', 'context.md');

                    let content: string;
                    try {
                        const bytes = await vscode.workspace.fs.readFile(contextUri);
                        content = Buffer.from(bytes).toString('utf8');
                    } catch {
                        // Create with starter template
                        content = [
                            '# Project Context',
                            '',
                            '<!-- This file is automatically loaded by all Docu agents. -->',
                            '<!-- Add project-level context here to keep agents aligned. -->',
                            '',
                            '## Project Overview',
                            '',
                            '<!-- Describe your project in 2-3 sentences -->',
                            '',
                            '## Tech Stack',
                            '',
                            '<!-- List key technologies, frameworks, languages -->',
                            '',
                            '## Constraints',
                            '',
                            '<!-- Budget, timeline, team size, regulatory requirements, etc. -->',
                            '',
                            '## Glossary',
                            '',
                            '<!-- Domain-specific terms and abbreviations -->',
                        ].join('\n');
                        await vscode.workspace.fs.writeFile(contextUri, Buffer.from(content, 'utf8'));
                        await vscode.window.showTextDocument(contextUri);
                        context.stream.markdown(
                            '## 📄 Project Context Created\n\n' +
                            'I\'ve created `.docu/context.md` and opened it for editing.\n\n' +
                            'All Docu agents will automatically load this file so they stay aligned with your project goals, tech stack, and constraints.\n\n' +
                            '**Fill in the sections and save — then run any workflow command.**'
                        );
                        return { success: true, message: 'Context file created' };
                    }

                    // Display existing context
                    context.stream.markdown(`## 📄 Project Context (\`.docu/context.md\`)\n\n${content}\n\n---\n*Edit this file to update shared context for all agents.*`);
                    return { success: true, message: 'Context displayed' };
                } catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : String(error) };
                }
            }
        }
    ];
}
