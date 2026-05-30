# Code Review and Commit

Perform a high-signal review of working-tree changes, verify the changed behavior with targeted QA, fix meaningful issues, and produce an understandable commit history.

Source basis: adapted from a local Claude Code agent prompt (`review-and-commit.md`).

## Working tree (preflight)

```!
echo "REVIEW_COMMIT_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -40
git diff --stat 2>/dev/null | head -20
git diff --cached --stat 2>/dev/null | head -20
git log --oneline -n 5 2>/dev/null
```

Run the block above before reviewing. Treat it as ground truth for the initial
"Inspect Current Change Scope" step. Defer full `git diff` bodies to explicit
Read/Bash calls where you need more than the stat summary.

## Workflow

1. Inspect current change scope.
1. Review for correctness and maintainability issues.
1. Apply necessary fixes.
1. Build and run a targeted QA plan.
1. Validate updated changes.
1. Build a commit plan.
1. Ask for approval before creating commits.
1. Execute commits in order and report results.

## 1) Inspect Current Change Scope

Run:

- `git status --short`
- `git diff` (unstaged)
- `git diff --staged` (if relevant)

Map changes by concern (feature, fix, refactor, tests, docs) before suggesting commit boundaries.

Enumerate untracked files explicitly. Flag anything large, data-shaped, or secret-looking (dumps, exports, `.env`, tokens) as commit-excluded by default — do not let it ride along into a commit.

## 2) Review Priorities

Prioritize in this order:

1. Correctness and regressions.
1. Security and secret leakage risks.
1. Broken architecture or project-pattern violations.
1. Missing tests or missing QA coverage for behavior changes.
1. Readability and maintainability improvements.

Review for:

- Logic bugs and unhandled edge cases.
- Missing error handling or validation.
- Performance pitfalls in changed code paths.
- Type accuracy and docstring quality; favor concise, useful docs.
- Low-value comments that restate obvious code behavior.
- Resource-lifecycle problems (cleanup, context management).
- Violations of repository conventions from project docs.
- User-visible behavior that automated checks do not cover.
- Parse/trust boundaries: when code decodes external data (JWT, API payload, header, cookie), confirm the test fixtures match a real sample, not an invented shape. A green suite whose fixtures encode the code's own assumption proves nothing.
- Cross-boundary values: when a change emits a value that crosses a boundary (HTTP header, env var, API field, cache-key dimension), find the consumer and confirm it accepts that shape/value. Flag logic duplicated across modules or services that must agree — it drifts.

## 3) Apply Fixes

When findings are actionable and safe, implement fixes directly.

- Keep scope tight to the requested work.
- Avoid unrelated refactors unless necessary for correctness.
- Re-check diffs after each meaningful fix.

## 4) Build and Run a Targeted QA Plan

For every review, generate the manual QA you would ask a human to perform for the changed behavior, then do as much of it as the current environment allows before proposing commits.

The QA plan must name:

- **Surface** - UI route, CLI command, API endpoint, worker/proxy path, background job, database migration, or docs-only behavior.
- **Inputs** - URL, command, fixture, token, account, payload, browser state, or seed data.
- **Expected result** - exact visible output, status code, header, console/network behavior, persisted state, or absence of a regression.
- **Tooling** - browser, Chrome DevTools MCP, in-app Browser, Playwright, curl, app CLI, test harness, logs, database query, or another repo-native probe.
- **Evidence to capture** - screenshot, console/network notes, command output, response snippet, log line, or test name.

Choose the tool that best exercises the actual changed surface:

- UI/browser changes: start or reuse the dev server when practical, then use Browser, Chrome DevTools MCP, Playwright, or the available browser tool. Check visible render, key interaction, console errors, and relevant network/request behavior.
- API/edge/proxy changes: use curl or repo tests for status codes, headers, auth, cache behavior, and representative payloads. Use real tokens/fixtures when available, sanitized in reports.
- CLI/dev-tooling changes: run the command a user would run, verify stdout/stderr, exit code, and generated side effects.
- Data/backend changes: verify through the narrowest useful test plus a direct query/log/probe when the behavior is observable only outside unit tests.
- Docs-only changes: QA the instructions by checking commands, paths, and expected outputs against the live repo.

If a live QA path is blocked, do not skip it silently and do not invent a code fix for an environment limitation. Isolate the blocker with the smallest diagnostic that distinguishes client, server, network, auth, fixture, or sandbox failure. Then report:

- what manual QA was attempted
- where it blocked
- why that blocker is or is not a code defect
- the closest automated or lower-level proof you ran instead
- the exact residual manual QA for the human to run

Example: if a browser cannot get past a server-side outbound fetch hang, prove whether the inbound route works with a no-outbound request before concluding that Chrome/DevTools cannot route around it.

## 5) Validate

Run relevant quality checks when available (for example lint, tests, type checks).

If checks cannot run, explicitly state what was skipped and why.

## Independent Review (recommended for correctness-sensitive diffs)

Before the commit plan, have an independent reviewer read the staged diff — `codex review --uncommitted`, or a fresh sub-agent with no prior context. Self-review reliably misses regressions your own fix just introduced (for example, a corrected parser that now emits a value the consumer rejects). Fold its findings into `Review Findings` and triage them; do not auto-apply.

## Optional HTML PR Explainer

For complex diffs, risky PRs, unfamiliar code paths, or review handoffs, create a self-contained HTML explainer before or alongside the commit plan. Do not make this mandatory for small commits.

Good HTML PR explainers include:

- annotated diff snippets with severity-colored margin notes
- before/after flow diagrams for changed behavior
- file-by-file tour focused on why each file changed
- reviewer focus areas and validation status
- links or copied file:line refs for the exact hot spots

Use Markdown for the commit plan and final chat summary. Use HTML when the reviewer needs spatial context they will not get from a terminal diff.

## 6) Build Commit Plan

Group changes into atomic commits that can be reverted independently.

For each proposed commit include:

- Commit type and summary (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`).
- Exact files to stage.
- Why this grouping is coherent.
- Final commit message draft.

Commit message rules:

- Use imperative mood.
- Keep subject concise (target <= 50 chars).
- Add body only when needed, explaining why.
- Wrap body lines near 72 chars.

## 7) Approval Gate

Before running `git add` or `git commit`, present the full commit plan and request approval.

If the user asks for changes, revise the plan and re-present before executing.

## 8) Execute and Report

After approval:

1. Stage only planned files for the current commit. Stage planned paths by name; never `git add -A` or `git add .`.
1. Create the commit.
1. Confirm success with commit hash and summary.
1. Repeat for remaining commits.

End with a concise recap:

- Commits created (hash + subject).
- Files included per commit.
- Any remaining unstaged/uncommitted changes.

## Output Format

Use this structure:

1. `Review Findings` grouped by severity (`Critical`, `Important`, `Suggestion`).
1. `Applied Fixes` with file-level summary.
1. `QA Plan` (manual/user-path checks with inputs and expected results).
1. `QA Results` (what was run, evidence, blockers, and residual human checks).
1. `Validation Results` (automated commands run and outcomes).
1. `Proposed Commit Plan` (numbered commits with file list + message).
1. `Execution Results` after approval.

## Decision Rules

- Prefer correctness over style.
- Favor project conventions over personal preference.
- Surface trade-offs when multiple valid approaches exist.
- Escalate explicitly when changes are risky or architecture-affecting.
- When review or QA surfaces a bug outside the current change's scope, propose it as a separate commit or stacked PR rather than bundling it into unrelated work.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `code` against `code/skills/code/SKILL.md`.
3. If the remote version is newer, pause before the main task and ask:
   > **code** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update code` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
