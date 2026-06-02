# Prepare PR

Prepare working-tree changes for a pull request: run the finish lane, review
the diff, verify changed behavior with targeted QA, clean up meaningful issues,
draft reviewer-facing PR text, and only then build an optional commit plan.

Source basis: evolved from the earlier `review-and-commit.md` workflow plus a
deterministic finish-lane helper.

## Working tree (preflight)

```!
echo "PREPARE_PR_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -40
git diff --stat 2>/dev/null | head -20
git diff --cached --stat 2>/dev/null | head -20
git log --oneline -n 5 2>/dev/null
```

Run the block above before preparing the PR. Treat it as ground truth for the
initial "Inspect Current Change Scope" step. Defer full `git diff` bodies to
explicit Read/Bash calls where you need more than the stat summary.

## Workflow

1. Inspect current change scope.
1. Run the deterministic finish lane.
1. Enter source-grounded test mode.
1. Run the built-in quality gates that apply to the diff.
1. Review for correctness and maintainability issues.
1. Apply necessary fixes.
1. Build and run the exact targeted QA plan.
1. Validate updated changes.
1. Run an independent review when the diff is correctness-sensitive.
1. Draft or update PR text from the actual diff and evidence.
1. Build an optional commit plan.
1. Ask for approval before creating commits.
1. Execute commits in order only when the user asked for commits.

`finish-lane.md` is the advanced method's deterministic core. Its script gives
you durable artifacts for QA, cleanup, validation, and PR prep; this module
still owns findings, judgment, fixes, PR narrative, approval, staging, and
commit discipline.

## 1) Inspect Current Change Scope

Run:

- `git status --short`
- `git diff` (unstaged)
- `git diff --staged` (if relevant)

Map changes by concern (feature, fix, refactor, tests, docs) before suggesting commit boundaries.

Enumerate untracked files explicitly. Flag anything large, data-shaped, or secret-looking (dumps, exports, `.env`, tokens) as commit-excluded by default — do not let it ride along into a commit.

## 2) Run The Finish Lane

Run the bundled helper before deep review unless the change is trivially
docs-only:

```bash
# inside the abpai/skills checkout itself
bun code/skills/code/scripts/finish-lane.ts --fix

# installed via project-local skills
bun .agents/skills/code/scripts/finish-lane.ts --fix

# loaded as a Claude Code plugin
bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --fix
```

Pick the path that exists. If none of those resolve, locate this module's skill
directory and run `scripts/finish-lane.ts` relative to it.

Open `.workflow/finish-lane/<timestamp>/workflow-status.html` first to see the
browser-friendly phase map, artifact links, validation status, gate filters, and
current next action. Use `workflow-status.md` as the Markdown fallback. Then read
`report.md`, `qa-plan.md`, `secret-risk.md`, failed logs, and `pr-body-draft.md`.
Treat those artifacts as the shared state for the rest of the workflow.

Independent agent review is project opt-in. A normal run uses the saved
`.workflow/finish-lane/preferences.json` reviewer when present; otherwise it
skips the agent pass. To save the opposite reviewer after verifying it exists on
PATH, run the helper once with `--agent peer`. Use `--agent codex` or
`--agent claude` only when you want that explicit reviewer saved for this
checkout.

If the helper cannot run, continue manually through the same phases and explain
the blocker.

## 3) Source-Grounded Test Mode

Before driving the app, API, or CLI, write named tests into the finish-lane
artifacts:

- `qa-plan.md` must cite the source, docs, route, command, or user-visible
  contract that makes the expected behavior real.
- `verification-timeline.md` must record the expected behavior before each
  action, then mark it `passed`, `failed`, or `untested`.
- `evidence/` should hold screenshots, recordings, traces, logs, response
  snippets, or command output for important assertions.

This is the "don't let the agent rationalize a pass after the fact" rule. If
the expected behavior was not written before the action, treat the result as a
probe, not proof.

Prefer real user-path testing for UI changes. Browser JavaScript, direct DB
writes, request mocking, or forced client state can be useful diagnostics, but
label them as lower-level probes and do not present them as user-path proof.

If setup is slow or repeatedly discovered the hard way, inspect
`setup-scripts.txt`, fill `setup-blueprint-template.yml`, and propose a
repo-owned setup script, fixture, or testing skill for the next run.

## 4) Run Quality Gates

Open `review-patterns.md`, `quality-gates.md`, and `gate-decisions.md` together.
The script makes a cheap recommendation from bounded path, diff, and text
signals, but the active agent makes the final applicability call. Accept the
recommendation, override it with a concrete reason, or add a one-off local gate
when the change introduces a new surface or risk the defaults missed. For each
selected gate, read only the bundled playbook named in `review-patterns.md`, run
the quick pass, and record evidence. Mark skipped gates with a concrete reason.
Use the deep pass only when the diff risk justifies it.

The default gate set internalizes the useful review patterns directly in this
workflow. The underlying prompts live in `review-patterns/` beside this module
so the plugin can be published independently:

- `review-patterns/prose-quality-pr-copy.md` - public docs, handoffs, and PR body text should be
  specific, human, and low-hype.
- `review-patterns/config-contract-check.md` - manifests, versions, command
  names, and plugin metadata should describe the same public surface.
- `review-patterns/mock-stub-placeholder-sweep.md` - changed code should not leave fake implementations,
  placeholder data, TODO traps, or overly broad mocks.
- `review-patterns/multi-pass-bug-hunting.md` - do a correctness/security pass, fix findings,
  then do a fresh-eyes pass over the resulting diff.
- `review-patterns/ubs-static-risk-scanner.md` - run `ubs` when available on changed code and triage
  findings instead of treating scanner output as automatically correct.
- `review-patterns/isomorphic-simplification.md` - remove accidental complexity only when
  behavior is protected by tests, goldens, or explicit invariants.
- `review-patterns/browser-e2e-verification.md` - UI changes need real route/component exercise,
  console/network checks, and screenshot/trace evidence when practical.
- `review-patterns/ux-accessibility-audit.md` - changed UI should pass a focused
  usability, keyboard, responsive, state, and accessibility check.
- `review-patterns/real-service-integration-check.md` - auth, billing, webhooks, data deletion, migrations, and
  cache/proxy behavior should prefer real service paths over mocks when safe.
- `review-patterns/golden-artifact-decision.md` - complex stable outputs should be frozen and reviewed
  by diff when exact field assertions would be weaker.
- `review-patterns/metamorphic-property-test-decision.md` - when exact expected output is hard, test
  invariant relationships instead of guessing a weak oracle.
- `review-patterns/cli-agent-ergonomics.md` - CLI/script changes should check help, exit codes,
  non-TTY behavior, JSON/robot output, and actionable errors.
- `review-patterns/doctor-self-healing-candidate.md` - recurring setup or repair
  pain should become a safe check/doctor/setup workflow only when justified.
- `review-patterns/performance-profiling.md` - performance claims require a baseline, profile, one lever per
  change, and behavior proof.

For clarity: these are Jeffery-skills-inspired ideas plus local repo metadata
checks, but they are now bundled as local `prepare-pr` / `finish-lane`
playbooks rather than imported as external skill dependencies. The generated
`review-patterns.md` repeats the selected mapping with absolute paths for the
current install.

Do a quick new-functionality check before QA. If the diff adds a surface the
project did not previously have, such as a first web UI, public CLI, API route,
database migration path, auth/billing boundary, background job, or runtime
target, add a local gate in `gate-decisions.md` and capture evidence for it.

Before handing work back, summarize intentionally skipped gates in
`gate-decisions.md` and in the final response or PR draft. Do not force every
gate on every diff. The important behavior is explicit applicability, evidence,
and visible skip rationale, not ceremony.

## 5) Review Priorities

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
- Parse/trust boundaries: when code decodes external data (JWT, API payload, header, cookie), confirm the test fixtures match a sanitized real sample or shape-only example, not an invented shape. A green suite whose fixtures encode the code's own assumption proves nothing.
- Cross-boundary values: when a change emits a value that crosses a boundary (HTTP header, env var, API field, cache-key dimension), find the consumer and confirm it accepts that shape/value. Flag logic duplicated across modules or services that must agree — it drifts.

## 6) Apply Fixes

When findings are actionable and safe, implement fixes directly.

- Keep scope tight to the requested work.
- Avoid unrelated refactors unless necessary for correctness.
- Re-check diffs after each meaningful fix.

## 7) Build and Run a Targeted QA Plan

For every review, generate the manual QA you would ask a human to perform for the changed behavior, then do as much of it as the current environment allows before proposing commits.

The QA plan must name:

- **Surface** - UI route, CLI command, API endpoint, worker/proxy path, background job, database migration, or docs-only behavior.
- **Inputs** - URL, command, fixture, token, account, payload, browser state, or seed data.
- **Expected result** - exact visible output, status code, header, console/network behavior, persisted state, or absence of a regression.
- **Tooling** - browser, Chrome DevTools MCP, in-app Browser, Playwright, curl, app CLI, test harness, logs, database query, or another repo-native probe.
- **Evidence to capture** - screenshot, console/network notes, command output, response snippet, log line, or test name.

Choose the tool that best exercises the actual changed surface:

- UI/browser changes: start or reuse the dev server when practical, then use Browser, Chrome DevTools MCP, Playwright, or the available browser tool. Check visible render, key interaction, console errors, and relevant network/request behavior.
- API/edge/proxy changes: use curl or repo tests for status codes, headers, auth, cache behavior, and representative payloads. Use real tokens/fixtures when available, but report only sanitized or shape-only evidence and never commit secrets.
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

## 8) Validate

Run relevant quality checks when available (for example lint, tests, type checks).

If checks cannot run, explicitly state what was skipped and why.

## 9) Independent Review

Before the commit plan, run an independent review for correctness-sensitive or behavior-affecting diffs: `codex review --uncommitted`, or a fresh sub-agent with no prior context, should read the current working-tree diff. For trivial docs-only or metadata-only changes, state the skip rationale instead of forcing ceremony.

Self-review reliably misses regressions your own fix just introduced (for example, a corrected parser that now emits a value the consumer rejects). Fold independent findings into `Review Findings` and triage them; do not auto-apply.

## 10) Draft Or Update PR Text

Use `pr-body-draft.md` only as raw material. Rewrite it against the actual diff,
artifact evidence, and user-visible behavior.

Good PR text starts with the job-to-be-done:

- what now happens that did not happen before
- why it matters for the user, operator, reviewer, or future agent
- how it works, only as much as a reviewer needs
- exact validation commands and live QA evidence
- residual manual QA or known risk

For a live PR update, use `gh pr edit --body-file` only after comparing the
draft against the current diff and latest commits.

## Optional HTML PR Explainer

For complex diffs, risky PRs, unfamiliar code paths, or review handoffs, create a self-contained HTML explainer before or alongside the commit plan. Do not make this mandatory for small commits.

Good HTML PR explainers include:

- annotated diff snippets with severity-colored margin notes
- before/after flow diagrams for changed behavior
- file-by-file tour focused on why each file changed
- reviewer focus areas and validation status
- links or copied file:line refs for the exact hot spots

Use Markdown for the commit plan and final chat summary. Use HTML when the reviewer needs spatial context they will not get from a terminal diff.

## 11) Build Commit Plan

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

## 12) Approval Gate

Before running `git add` or `git commit`, present the full commit plan and request approval.

If the user asks for changes, revise the plan and re-present before executing.

## 13) Execute and Report

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
1. `Quality Gates` (applicable built-in passes run, evidence, and skip rationales).
1. `QA Plan` (manual/user-path checks with inputs and expected results).
1. `Verification Timeline` (named tests, expected-before-action assertions, pass/fail/untested status, and evidence paths).
1. `QA Results` (what was run, evidence, blockers, and residual human checks).
1. `Validation Results` (automated commands run and outcomes).
1. `Independent Review Results` (findings, or skip rationale for trivial diffs).
1. `Reusable Setup` (new deterministic setup scripts/skills to create, or "none").
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
