/**
 * TestCommand — `/test` command definition
 *
 * Registers the `/test` slash command in the Docu extension. When invoked, it
 * orchestrates a full run of extension scenarios and streams live results to the
 * VS Code Copilot Chat window. Logs are automatically saved to `.docu/test-results/`.
 *
 * Sub-commands
 * ────────────
 *   /test               Show this help text
 *   /test list          List every available scenario and its group
 *   /test quick         System + template + command scenarios (no LLM, fast)
 *   /test system        Sanity checks: agents, state, template count
 *   /test templates     Render every built-in template
 *   /test commands      All command-routing scenarios
 *   /test agents        All 6 agents via LLM (requires a model to be selected)
 *   /test workflow      Phase-tracking + workflow shortcut commands
 *   /test full          Everything — system + templates + commands + agents + workflow
 *   /test <id>          Run a single scenario by exact ID, e.g. /test agent:prd-creator
 */

import { CommandDefinition, ParsedCommand, CommandContext, CommandResult } from './types';
import { AgentManager } from '../agents/AgentManager';
import { TemplateService } from '../templates/TemplateService';
import { WorkflowStateManager } from '../state/WorkflowStateManager';
import { CommandRouter } from './CommandRouter';
import { TestRunner } from './TestRunner';
import { TestLogger, ScenarioResult, TestRunResult } from './TestLogger';

// ─── Public factory ───────────────────────────────────────────────────────────

export function createTestCommandDefinition(
    agentManager: AgentManager,
    templateService: TemplateService,
    workflowStateManager: WorkflowStateManager,
    commandRouter: CommandRouter
): CommandDefinition {
    const runner = new TestRunner(agentManager, templateService, workflowStateManager, commandRouter);

    return {
        name: 'test',
        description: 'Run extension test scenarios — agents, commands, templates, workflow, and e2e file creation',
        usage: '/test [quick|full|system|templates|commands|agents|workflow|e2e|list|<scenario-id>]',
        examples: [
            '/test quick',
            '/test full',
            '/test agents',
            '/test commands',
            '/test templates',
            '/test workflow',
            '/test e2e',
            '/test system',
            '/test list',
            '/test e2e:prd-creation',
            '/test agent:prd-creator',
            '/test system:agent-registration',
        ],

        handler: async (parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> => {
            // Derive sub-command from subcommand field or first positional argument
            const sub = (parsedCommand.subcommand ?? parsedCommand.arguments[0] ?? '').trim();

            // ── /test list ────────────────────────────────────────────────────
            if (sub === 'list') {
                return handleList(runner, context);
            }

            // ── /test (no sub-command) or /test help ──────────────────────────
            if (!sub || sub === 'help') {
                context.stream.markdown(HELP_TEXT);
                return { success: true, message: 'Test help displayed' };
            }

            // ── Run scenarios ─────────────────────────────────────────────────
            return runScenarios(sub, runner, context);
        },
    };
}

// ─── Sub-command handlers ─────────────────────────────────────────────────────

function handleList(runner: TestRunner, context: CommandContext): CommandResult {
    const scenarios = runner.listScenarios();

    const byGroup = new Map<string, typeof scenarios>();
    for (const s of scenarios) {
        if (!byGroup.has(s.group)) { byGroup.set(s.group, []); }
        byGroup.get(s.group)!.push(s);
    }

    const lines: string[] = [
        '## 🧪 Available Test Scenarios',
        '',
        `**Total:** ${scenarios.length} scenarios across ${byGroup.size} groups`,
        '',
    ];

    for (const [group, scenes] of byGroup) {
        lines.push(`### \`${group}\` — ${scenes.length} scenario(s)`, '');
        lines.push('| ID | Description | LLM |');
        lines.push('|----|-------------|:---:|');
        for (const s of scenes) {
            lines.push(`| \`${s.id}\` | ${s.description} | ${s.requiresLLM ? '🤖' : '—'} |`);
        }
        lines.push('');
    }

    lines.push(
        '---',
        '',
        '**Quick Reference:**',
        '| Sub-command | Groups included |',
        '|-------------|-----------------|',
        '| `quick` | system, template, cmd |',
            '| `full` | system, template, cmd, agent, workflow, e2e |',
        '| `system` | system |',
        '| `templates` | template |',
        '| `commands` | cmd |',
        '| `agents` | agent |',
        '| `workflow` | workflow |',
            '| `e2e` | e2e |',
        '| `<scenario-id>` | single scenario |',
    );

    context.stream.markdown(lines.join('\n'));
    return { success: true, message: 'Scenario list displayed' };
}

async function runScenarios(
    subCommand: string,
    runner: TestRunner,
    context: CommandContext
): Promise<CommandResult> {
    const startTime = new Date();
    const runId = `run-${startTime.getTime()}`;
    const modelName =
        (context.model as unknown as Record<string, unknown> | undefined)?.['name'] as string
        ?? (context.model as unknown as Record<string, unknown> | undefined)?.['id'] as string
        ?? 'unknown';

    // ── Header ────────────────────────────────────────────────────────────────
    context.stream.markdown([
        `## 🧪 \`/test ${subCommand}\``,
        '',
        `| Property | Value |`,
        `|----------|-------|`,
        `| Run ID | \`${runId}\` |`,
        `| Model | **${modelName}** |`,
        `| Time | ${startTime.toLocaleTimeString()} |`,
        '',
        '---',
        '',
        '**Running scenarios…**',
        '',
    ].join('\n'));

    // ── Execute ───────────────────────────────────────────────────────────────
    const results = await runner.run(subCommand, context, (msg) => {
        context.stream.markdown(`\n${msg}`);
    });

    if (results.length === 0) {
        context.stream.markdown([
            '',
            `---`,
            '',
            `❓ No scenarios matched \`${subCommand}\`.`,
            'Use `/test list` to see all available scenarios and group names.',
        ].join('\n'));
        return { success: false, error: `No scenarios found for sub-command: '${subCommand}'` };
    }

    // ── Summarise ─────────────────────────────────────────────────────────────
    const endTime   = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const summary    = buildSummary(results);

    const testRun: TestRunResult = {
        runId,
        startTime: startTime.toISOString(),
        endTime:   endTime.toISOString(),
        totalDurationMs: durationMs,
        subCommand,
        model: modelName,
        workspaceRoot: context.workspaceRoot,
        summary,
        scenarios: results,
    };

    // ── Persist logs ──────────────────────────────────────────────────────────
    const saved = await TestLogger.save(testRun);

    // ── Render chat summary ───────────────────────────────────────────────────
    context.stream.markdown('\n---\n');
    context.stream.markdown(renderSummaryMarkdown(testRun, saved));

    return {
        success: summary.failed === 0 && summary.errors === 0,
        data: testRun,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(results: ScenarioResult[]): TestRunResult['summary'] {
    return {
        total:   results.length,
        passed:  results.filter(r => r.status === 'passed').length,
        failed:  results.filter(r => r.status === 'failed').length,
        errors:  results.filter(r => r.status === 'error').length,
        skipped: results.filter(r => r.status === 'skipped').length,
    };
}

function renderSummaryMarkdown(
    r: TestRunResult,
    saved: { jsonPath: string; mdPath: string } | null
): string {
    const passRate = r.summary.total > 0
        ? Math.round(((r.summary.passed + r.summary.skipped) / r.summary.total) * 100)
        : 0;

    const allGood = r.summary.failed === 0 && r.summary.errors === 0;

    const verdict = allGood
        ? `✅ **All scenarios passed** (${passRate}% pass rate)`
        : `⚠️ **${r.summary.failed + r.summary.errors} scenario(s) need attention** (${passRate}% pass rate)`;

    const lines: string[] = [
        `## 📊 Results — \`/test ${r.subCommand}\``,
        '',
        verdict,
        '',
        `| Total | ✅ Passed | ❌ Failed | 💥 Errors | ⏭️ Skipped | ⏱ Duration |`,
        `|-------|----------|----------|----------|----------|-----------|`,
        `| ${r.summary.total} | **${r.summary.passed}** | **${r.summary.failed}** | **${r.summary.errors}** | **${r.summary.skipped}** | ${r.totalDurationMs}ms |`,
        '',
    ];

    if (saved) {
        lines.push(
            `📁 **Logs saved to workspace:**`,
            `- Markdown report: \`${saved.mdPath}\``,
            `- JSON data:       \`${saved.jsonPath}\``,
            '',
        );
    }

    const failures = r.scenarios.filter(s => s.status === 'failed' || s.status === 'error');
    if (failures.length > 0) {
        lines.push('### ❌ Failures & Errors', '');
        for (const f of failures) {
            const icon = f.status === 'error' ? '💥' : '❌';
            lines.push(`${icon} **\`${f.id}\`** — ${f.description}`);
            if (f.error)   { lines.push(`> Error: \`${f.error}\``); }
            if (f.details) { lines.push(`> ${f.details}`); }
            lines.push('');
        }
        lines.push(
            '### 💡 Debugging Tips',
            '- Run `/test <scenario-id>` to isolate and re-run a single failing scenario',
            '- Check the full log report for stack traces or additional context',
            '- Run `/test quick` for the fastest feedback loop (no LLM calls)',
            '',
        );
    }

    return lines.join('\n');
}

// ─── Help text ────────────────────────────────────────────────────────────────

const HELP_TEXT = `## 🧪 Docu Test Suite — \`/test\`

Automatically runs all extension scenarios using the currently selected GitHub Copilot model.
Results are streamed live to chat and saved to \`.docu/test-results/\` as JSON + Markdown.

### Sub-commands

| Command | Scenarios | LLM |
|---------|-----------|:---:|
| \`/test quick\` | system + templates + commands (fast) | — |
| \`/test system\` | Agents registered, state load/save, template count | — |
| \`/test templates\` | Render all 5 built-in templates | — |
| \`/test commands\` | All command-routing scenarios | — |
| \`/test agents\` | All 6 agents respond via the selected LLM | 🤖 |
| \`/test workflow\` | Phase tracking + /prd /requirements /design /spec /review | 🤖 |
| \`/test e2e\` | **Full spec workflow** — creates real files in \`.docu/test-e2e/\` | 🤖 |
| \`/test full\` | **Everything** — all groups including e2e | 🤖 |
| \`/test list\` | List every scenario and its group | — |
| \`/test <id>\` | Run a single scenario, e.g. \`/test e2e:prd-creation\` | varies |

### Log files

After every run, two files are written to \`.docu/test-results/\`:
- \`test-<timestamp>.json\` — full machine-readable results
- \`test-<timestamp>.md\`   — human-readable Markdown report

### Examples

\`\`\`
/test quick
/test full
/test e2e
/test agents
/test e2e:prd-creation
/test agent:quality-reviewer
/test system:agent-registration
\`\`\`
`;
