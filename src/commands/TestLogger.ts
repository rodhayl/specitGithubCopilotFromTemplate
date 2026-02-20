/**
 * TestLogger — persists test run results to `.docu/test-results/`
 *
 * Every `/test` run automatically writes two log files:
 *   - `test-<timestamp>.json`  — machine-readable full results (for programmatic access)
 *   - `test-<timestamp>.md`    — human-readable markdown report
 *
 * Log directory: `.docu/test-results/` inside the current workspace root.
 * The directory is created automatically on the first run.
 */

import * as vscode from 'vscode';

const LOG_DIR = '.docu/test-results';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScenarioResult {
    id: string;
    description: string;
    group: string;
    status: 'passed' | 'failed' | 'skipped' | 'error';
    durationMs: number;
    details?: string;
    error?: string;
    /** Captured LLM response text (truncated). Populated for all LLM-using scenarios. */
    rawResponse?: string;
}

export interface TestRunResult {
    runId: string;
    startTime: string;      // ISO-8601
    endTime: string;        // ISO-8601
    totalDurationMs: number;
    subCommand: string;     // e.g. "full", "agents", "quick"
    model: string;          // model name / id used during the run
    workspaceRoot: string;
    summary: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        errors: number;
    };
    scenarios: ScenarioResult[];
}

// ─── TestLogger ───────────────────────────────────────────────────────────────

export class TestLogger {
    /**
     * Save a test run result to `.docu/test-results/`.
     * Returns the absolute paths of the created JSON and Markdown files,
     * or `null` if no workspace is open.
     */
    static async save(result: TestRunResult): Promise<{ jsonPath: string; mdPath: string } | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) { return null; }

        const root = workspaceFolders[0].uri;

        // Build a filename-safe timestamp:  2026-02-19_14-30-00-123
        const ts = result.startTime
            .replace('T', '_')
            .replace(/\.\d+Z$/, '')       // strip fractional seconds + Z
            .replace(/:/g, '-');          // colons → dashes

        const dirUri = vscode.Uri.joinPath(root, LOG_DIR);
        try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* already exists */ }

        const jsonUri = vscode.Uri.joinPath(dirUri, `test-${ts}.json`);
        const mdUri = vscode.Uri.joinPath(dirUri, `test-${ts}.md`);

        try {
            await vscode.workspace.fs.writeFile(
                jsonUri,
                Buffer.from(JSON.stringify(result, null, 2), 'utf8')
            );
            await vscode.workspace.fs.writeFile(
                mdUri,
                Buffer.from(TestLogger.toMarkdown(result), 'utf8')
            );
            return { jsonPath: jsonUri.fsPath, mdPath: mdUri.fsPath };
        } catch (e) {
            console.error('Failed to save test results:', e);
            return null;
        }
    }

    // ─── Markdown report renderer ─────────────────────────────────────────────

    static toMarkdown(r: TestRunResult): string {
        const icon = (s: ScenarioResult['status']): string =>
            ({ passed: '✅', failed: '❌', error: '💥', skipped: '⏭️' }[s] ?? '❓');

        const passRate = r.summary.total > 0
            ? Math.round(((r.summary.passed + r.summary.skipped) / r.summary.total) * 100)
            : 0;

        const allGood = r.summary.failed === 0 && r.summary.errors === 0;
        const verdict = allGood
            ? `✅ **All scenarios passed** (${passRate}% pass rate)`
            : `⚠️ **${r.summary.failed + r.summary.errors} scenario(s) failed** (${passRate}% pass rate)`;

        const lines: string[] = [
            `# Docu Extension Test Report`,
            '',
            verdict,
            '',
            `| Property | Value |`,
            `|----------|-------|`,
            `| **Run ID** | \`${r.runId}\` |`,
            `| **Command** | \`/test ${r.subCommand}\` |`,
            `| **Model** | ${r.model} |`,
            `| **Started** | ${r.startTime} |`,
            `| **Duration** | ${r.totalDurationMs}ms |`,
            `| **Workspace** | \`${r.workspaceRoot}\` |`,
            '',
            `## Summary`,
            '',
            `| Total | ✅ Passed | ❌ Failed | 💥 Errors | ⏭️ Skipped |`,
            `|-------|----------|----------|----------|----------|`,
            `| **${r.summary.total}** | **${r.summary.passed}** | **${r.summary.failed}** | **${r.summary.errors}** | **${r.summary.skipped}** |`,
            '',
            `## Scenario Results`,
            '',
            `| Status | Group | ID | Description | Duration |`,
            `|--------|-------|----|-------------|----------|`,
            ...r.scenarios.map(s =>
                `| ${icon(s.status)} ${s.status.toUpperCase()} | \`${s.group}\` | \`${s.id}\` | ${s.description} | ${s.durationMs}ms |`
            ),
            '',
        ];

        // ── Failures & errors ──────────────────────────────────────────────────
        const failures = r.scenarios.filter(s => s.status === 'failed' || s.status === 'error');
        if (failures.length > 0) {
            lines.push(`## Failures & Errors`, '');
            for (const f of failures) {
                lines.push(`### \`${f.id}\` — ${f.description}`, '');
                if (f.error) { lines.push(`**Error:** \`${f.error}\``, ''); }
                if (f.details) { lines.push(`**Details:** ${f.details}`, ''); }
                if (f.rawResponse) {
                    const snippet = f.rawResponse.length > 800
                        ? f.rawResponse.slice(0, 800) + '\n…(truncated)'
                        : f.rawResponse;
                    lines.push('**LLM Response (raw):**', '```', snippet, '```', '');
                }
            }
        }

        // ── Passed details ─────────────────────────────────────────────────────
        const withDetails = r.scenarios.filter(s => s.status === 'passed' && s.details);
        if (withDetails.length > 0) {
            lines.push(`## Passed Scenario Details`, '');
            for (const p of withDetails) {
                lines.push(`- **\`${p.id}\`** (${p.durationMs}ms): ${p.details}`);
            }
            lines.push('');
        }

        // ── Diagnostic snapshot (all scenarios with their LLM output) ──────────
        const withRaw = r.scenarios.filter(s => s.rawResponse);
        if (withRaw.length > 0) {
            lines.push(`## Diagnostic Snapshot`, '');
            lines.push('> Raw LLM responses captured during this run. Use these to diagnose unexpected behaviour.', '');
            for (const s of withRaw) {
                const snippet = (s.rawResponse ?? '').length > 400
                    ? (s.rawResponse ?? '').slice(0, 400) + '\n…'
                    : (s.rawResponse ?? '');
                lines.push(`### ${icon(s.status)} \`${s.id}\``, '');
                lines.push('```', snippet, '```', '');
            }
        }

        return lines.join('\n');
    }
}
