# Finish Lane

Internal helper for `prepare-pr.md`. Run a deterministic post-implementation
lane after code has been written and is roughly working. The lane does not
replace review judgment; it gives the agent a repeatable sequence and durable
artifacts so QA, cleanup, validation, and PR prep do not depend on memory or
vibes.

Inspired by dynamic-workflow patterns: code controls ordering and evidence,
while the model handles judgment, fixes, and final narrative.

## When To Use

Use this helper from `prepare-pr.md` when the user asks to:

- finish or harden a working change
- run QA, cleanup, validation, and PR prep in one pass
- make an implementation PR-ready
- avoid the agent forgetting manual QA or PR-description cleanup
- run the same end-of-task checklist across Claude, Codex, or another agent

Do not expose this as a public slash command by default, and do not use it as a
substitute for implementation. Use it after the code path exists, even if it
still needs cleanup or verification.

## First Action

Run the bundled script from the installed skill directory:

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

For an audit-only pass that writes artifacts but makes no mechanical cleanup
changes:

```bash
bun /path/to/code/skills/code/scripts/finish-lane.ts
```

By default, the script uses the saved project independent-review preference from
`.workflow/finish-lane/preferences.json`; if no preference exists, it skips the
agent review. To opt in to the opposite agent from the detected invoker and save
that project preference after verifying the executable is available:

```bash
bun /path/to/code/skills/code/scripts/finish-lane.ts --fix --agent peer
```

You can also choose a reviewer explicitly, which verifies availability before
saving the project preference:

```bash
bun /path/to/code/skills/code/scripts/finish-lane.ts --fix --agent codex
bun /path/to/code/skills/code/scripts/finish-lane.ts --fix --agent claude
```

## What The Script Does

The script creates `.workflow/finish-lane/<timestamp>/` with:

- `report.md` - run summary, step statuses, and next actions
- `workflow-status.html` - browser-friendly phase map, artifact links, gates, and validation status
- `workflow-status.md` - visual phase map and current next action
- `changed-files.txt` - deduplicated scope inventory
- `secret-risk.md` - filename-only scan for secret-looking or bulky files
- `setup-scripts.txt` - deterministic setup/auth/test entrypoint candidates
- `setup-blueprint-template.yml` - template for saving hard-won setup knowledge
- `quality-gates.md` - self-contained gate manifest with review patterns, quick
  passes, deep passes, and evidence requirements
- `gate-decisions.md` - agent-owned applicability ledger, new-gate check, and
  intentionally skipped gate summary
- `qa-plan.md` - targeted manual QA starter based on changed surfaces
- `verification-timeline.md` - setup/action/assertion ledger
- `subagent-plan.md` - read-only specialist review suggestions
- `agent-review.md` - optional read-only Claude/Codex review output or skip note
- `evidence/` - screenshots, recordings, traces, logs, and snippets
- `prompts/finish-review.md` - prompt for the active agent or a second pass
- `pr-body-draft.md` - PR body skeleton seeded with validation status
- `logs/` - command output for each step

It runs:

1. `git status`, diff stats, and `git diff --check`
2. optional mechanical cleanup with discovered package scripts such as
   `format`, `fmt`, `lint:fix`, or `fix`
3. discovered validation scripts such as `validate`, `check`, `lint`,
   `typecheck`, `test`, and `build`
4. language-native tests when obvious (`pytest`, `go test ./...`, `cargo test`)
5. optional independent review when a project preference is saved or an agent is
   requested explicitly. `codex exec` runs with a hard read-only sandbox;
   `claude -p` is constrained with plan mode and a narrow read-only tool
   allowlist.

It never stages, commits, pushes, deploys, or creates a PR.

Open `workflow-status.html` first when you want to see where the workflow is. It
is a self-contained HTML/JS artifact in the same style as `/code:understand`:
phase cards, artifact links, validation status, gate filters, and the current
next action. Use `workflow-status.md` as the Markdown fallback/reference version.

## Verification Mode

The lane is meant to push the agent into test mode, not just command-running
mode:

- Ground every named test in source, docs, or a user-visible contract before
  testing.
- Write the expected behavior into `verification-timeline.md` before each
  action, then mark it `passed`, `failed`, or `untested`.
- Prefer real user-path actions for UI verification. JavaScript/state injection
  is allowed only when labeled as a lower-level diagnostic.
- Capture proof in `evidence/` when practical. For timing-sensitive UI, capture
  around the action instead of trusting a single arbitrary screenshot.
- If setup required painful manual discovery, fill the setup blueprint and
  propose a deterministic setup script or repo-owned testing skill.

## Quality Gates

`quality-gates.md` makes the finishing passes explicit so the user does not have
to remember to invoke them one by one. It is a compact, self-contained gate
manifest; all instructions needed to run the gates are generated into the
artifact. The script recommends applicability from bounded path, diff, and text
signals, then `gate-decisions.md` asks the active agent to accept, override, or
add gates from project context. Each row records:

- review pattern
- why the script recommended or skipped the gate
- when the gate usually applies
- quick pass for normal PR prep
- deep pass for risky diffs
- evidence required or skip rationale

- prose quality and PR copy cleanup
- mock/stub/placeholder sweep
- multi-pass bug hunting
- UBS/static risk scan when available
- isomorphic simplification
- web/UI E2E and UX/accessibility audit
- real-service integration checks
- golden artifact and metamorphic/property-test decisions
- CLI ergonomics and doctor/self-healing candidates
- performance profiling when performance is changed or claimed

For each selected pass, run the quick pass and record evidence; for each
intentionally skipped pass, write the reason in `gate-decisions.md`. Use the deep
pass only when the diff risk justifies it.

The agent also does a new-gate check. If the change introduces something the
project did not previously have, such as a first web UI, new public CLI, API
route, database migration, auth boundary, billing path, background job, or
runtime target, add a local gate for that change and capture evidence for it.

## Agent Loop

After the script finishes:

1. Read `report.md`, `qa-plan.md`, `secret-risk.md`, failed logs, and the prompt
   under `prompts/`.
2. Replace the generic QA starter with source-grounded exact probes: route,
   command, payload, account, browser state, expected result, and evidence.
3. Annotate `verification-timeline.md` before and after each test action.
4. Fill `gate-decisions.md`: accept or override recommended gates, add any
   one-off local gate for new functionality, and summarize intentional skips.
5. Run each selected quick pass in `quality-gates.md`, escalate only when risk
   justifies it, or write a skip rationale.
6. Fix true defects and cleanup only where behavior can be proved unchanged.
7. Rerun the script after fixes.
8. Use `pr-body-draft.md` as raw material, but rewrite it against the actual
   behavior and validation before opening or updating a PR.

## Decision Rules

- Treat failed checks as evidence, not as automatic code defects. Classify each
  failure as current-change bug, unrelated pre-existing issue, or environment
  blocker.
- Keep cleanup scoped. Do not use this lane to absorb unrelated worktree noise.
- If live QA is blocked, isolate the smallest reason why and write the exact
  residual human QA.
- Prefer one narrow rerun after each fix over one giant final sweep.
- Before committing, fall back into `prepare-pr.md` for PR narrative, commit
  planning, approval, and staging discipline.

## PR Prep Bar

A PR is not ready until the artifacts answer:

- what behavior changed
- why it matters
- how the changed surface was actually exercised
- which checks passed, failed, or were skipped
- which gates were intentionally skipped and why
- what manual QA remains
- which files are intentionally excluded from commit scope
