# MANUAL_TEST.md

This guide verifies Docu slash commands end-to-end in Copilot Chat and validates created files on disk.

## 1) Preconditions

- VS Code opened on this workspace root.
- Extension built/installed from current source.
- GitHub Copilot Chat enabled.
- In chat, select a model (required for LLM scenarios).
- Run commands as `@docu /...` in Copilot Chat.

## 2) Reset test artifacts (PowerShell)

Run from workspace root:

```powershell
Remove-Item -Recurse -Force .docu\test-e2e -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .docu\test-results -ErrorAction SilentlyContinue
Remove-Item -Force docs\manual-e2e-prd.md -ErrorAction SilentlyContinue
Remove-Item -Force requirements.md -ErrorAction SilentlyContinue
Remove-Item -Force design.md -ErrorAction SilentlyContinue
Remove-Item -Force tasks.md -ErrorAction SilentlyContinue
Remove-Item -Force summary.md -ErrorAction SilentlyContinue
Remove-Item -Force index.md -ErrorAction SilentlyContinue
```

## 3) Core command sanity checks (Copilot Chat)

Run in this order and confirm expected behavior.

1. `@docu /help`
   - Expect: smart help dashboard with recommended next workflow step.

2. `@docu /agent list`
   - Expect: list includes `prd-creator`, `requirements-gatherer`, `solution-architect`, `specification-writer`, `quality-reviewer`, `brainstormer`.

3. `@docu /agent set prd-creator`
   - Expect: active agent switched.

4. `@docu /agent current`
   - Expect: `prd-creator` is active.

5. `@docu /templates list`
   - Expect: available template IDs shown.

6. `@docu /templates show prd`
   - Expect: template details rendered.

7. `@docu /diagnostic --all`
   - Expect: conversation + agent + system diagnostic output.

## 4) Full E2E workflow test (creates real files)

### 4.1 Optional shared context

Run:

`@docu /context`

If `.docu/context.md` is created/opened, paste this content and save:

```markdown
# Project Context

## Project Overview
Build a SaaS task management app for small software teams.

## Tech Stack
TypeScript, Node.js, React, PostgreSQL.

## Constraints
MVP in 6 weeks, team of 3 engineers, must support GDPR basics.

## Glossary
- Workspace: tenant container
- Task Board: kanban board for tasks
```

### 4.2 Phase commands

Run each command in chat and validate file creation:

1. `@docu /prd "Manual E2E PRD"`
   - Expect command response from `prd-creator`.
   - Expect file created: `docs/manual-e2e-prd.md`.

2. `@docu /requirements`
   - Expect response from `requirements-gatherer`.
   - Expect file created: `requirements.md`.

3. `@docu /design`
   - Expect response from `solution-architect`.
   - Expect file created: `design.md`.

4. `@docu /spec`
   - Expect response from `specification-writer`.
   - Expect file created: `tasks.md`.

5. `@docu /review --file tasks.md --level normal`
   - Expect quality report from `quality-reviewer`.
   - No new file required; review is streamed in chat.

6. `@docu /status`
   - Expect workflow progress summary.

## 5) Non-workflow manual commands

1. `@docu /new "Manual Command Doc" --template basic --path docs/manual-command-doc.md`
   - Expect file created: `docs/manual-command-doc.md`.

2. `@docu /update --file docs/manual-command-doc.md --section "Overview" --mode append "Added by manual update command."`
   - Expect existing file modified in-place.

3. `@docu /catalog --glob "**/*.md" --output index.md`
   - Expect file created: `index.md`.

4. `@docu /summarize --glob "**/*.md" --output summary.md`
   - Expect file created: `summary.md`.

5. `@docu /chat create PRD for a lightweight bug tracker`
   - Precondition: an agent is active (`/agent set ...`).
   - Expect agent response; if that agent returns tool calls, files may be created/updated accordingly.

## 6) Built-in `/test` suite manual checks

Run:

1. `@docu /test quick`
   - Expect pass on system/template/cmd scenarios.
   - Expect logs created in `.docu/test-results/`.

2. `@docu /test e2e`
   - Expect 5 scenarios for real file creation under `.docu/test-e2e/`:
     - `.docu/test-e2e/docs/e2e-test-app.md`
     - `.docu/test-e2e/requirements.md`
     - `.docu/test-e2e/design.md`
     - `.docu/test-e2e/tasks.md`
   - Expect runtime in seconds (LLM-backed), not sub-second.

3. `@docu /test full`
   - Expect all groups, including `e2e`.

## 7) File verification (PowerShell)

```powershell
$expected = @(
  "docs/manual-e2e-prd.md",
  "requirements.md",
  "design.md",
  "tasks.md",
  "docs/manual-command-doc.md",
  "index.md",
  "summary.md",
  ".docu/test-e2e/docs/e2e-test-app.md",
  ".docu/test-e2e/requirements.md",
  ".docu/test-e2e/design.md",
  ".docu/test-e2e/tasks.md"
)

$expected | ForEach-Object {
  if (Test-Path $_) { "OK  $_" } else { "MISS $_" }
}
```

## 8) Pass/Fail criteria

PASS if all are true:

- No command returns parser/validation errors for valid syntax above.
- Workflow slash commands create expected files (`/prd`, `/requirements`, `/design`, `/spec`).
- `/review --file tasks.md --level normal` returns a report successfully.
- `/catalog` and `/summarize` write output files.
- `/test e2e` reports successful e2e scenarios and writes `.docu/test-e2e/*` files.
- `.docu/test-results/` contains Markdown + JSON reports for each `/test` run.

FAIL if any expected file is missing, any command errors unexpectedly, or e2e scenarios are skipped due to missing model.
