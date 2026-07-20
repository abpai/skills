---
name: code
disable-model-invocation: true
description: "Route coding workflows through one scoped /code command. Use prepare-pr for effort-scaled PR readiness through push, simplify for behavior-preserving cleanup and high-signal test pruning of a target or a ranked whole-repo proposal, handoff for continuation prompts, and understand for an HTML code map plus a runnable real-code snippet."
argument-hint: "[subcommand] [args] - e.g. prepare-pr --effort low, simplify src/api, understand login flow, handoff"
# allowed-tools belongs on the umbrella because hidden wrappers never become the
# active skill; git push and PR writes are still sealed by hooks/gate-before-push.sh.
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *)
  Bash(git add *) Bash(git commit *) Bash(git branch *)
  Bash(git push *) Bash(git rev-parse *) Bash(git restore --staged *)
  Bash(codex *) Bash(curl *) Bash(npm *) Bash(yarn *)
  Bash(pnpm *) Bash(bun *) Bash(npx *) Bash(node *) Bash(python3 *) Bash(pytest *)
  Bash(go test *) Bash(cargo test *) Bash(gh *)
  mcp__chrome-devtools__* mcp__playwright__* mcp__browser__*
  Read Write Edit Grep Glob AskUserQuestion Agent
metadata:
  version: "3.1.2"
---

# Code Workflow Pack

This umbrella skill is the model-invocable entry point for the pack and the single scoped `/code` command users see in the `/` menu. Each workflow also ships as its own `code/skills/<name>/SKILL.md`, but those per-command skills set `disable-model-invocation: true`, `user-invocable: false`, and `metadata.internal: true`, so they stay out of the model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates of the umbrella), and out of flat-list installers like the `npx skills` installer used by Codex. Reach any workflow through this umbrella — the subcommand router below maps `/code <name>` to the matching module. The workflow modules referenced below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/code` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `code <subcommand> <args>` — e.g. `code understand src/api`
- `code --<subcommand> <args>` — e.g. `code --understand src/api`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it (case-insensitive) against the workflow names below. On a match, load the sibling module `./<subcommand>.md` and treat the remaining tokens as that workflow's input. Routing is complete when exactly one module is selected, loaded, and handed the remaining args. If the first token is not a known subcommand, treat the whole input as a natural-language request and route by intent. Known subcommands: `prepare-pr`, `simplify`, `handoff`, `understand`.

Before natural-language fallback, detect these removed exact subcommand tokens and
return the migration guidance instead of silently changing side effects:

- `review-and-commit` → `code prepare-pr --effort low` (warning: the replacement
  commits, pushes, and creates or updates a PR).
- `dead-code`, `thermo-nuclear`, or `test-deslop` → `code simplify [scope]`.
  Simplify's reachability and test-signal passes own those audits now, but they
  were read-only and a scoped `simplify` applies edits; omit the scope for a
  proposal-only ranking, the closest match to the old audit reports.
- `walkthrough` → `code understand [topic]`; the mastery-quiz workflow was removed.
- `secure-dependencies` → `harness secure-dependencies [scope]` (requires the
  harness plugin), the focused dependency-hardening pass; the broader
  `harness compliant` also runs it as one step of end-to-end remediation.

Carry the user's remaining arguments into the suggested replacement. Do not load
a removed module or pretend the migration ran. Stop after giving the replacement
so the user can accept the new contract explicitly.

## Routing

- Use `prepare-pr.md` for PR readiness through push. It accepts `--effort low|medium|high` (default `low`) to scale review depth while preserving risk-required gates. Natural-language requests to review and commit route to `prepare-pr --effort low`; this pack no longer has a local-only commit workflow.
- Use `simplify.md` for behavior-preserving simplification, including pruning low-value tests while protecting load-bearing guards. A named path, symbol, file, or subsystem is edited and validated autonomously. Omitted scope or repository-root scope produces a ranked whole-repository proposal without edits.
- Treat `review-patterns/` as the bundled detailed prompt library for `prepare-pr` gates. The `prepare-pr` workflow loads only the lenses it selects from the script's suggested-lens list (progressive disclosure).
- Use `understand.md` for tracing a specific code path into `.understand/<topic>/index.html` plus a runnable `how_<topic>_works.<ext>` that imports and executes real code. It may leave clearly tagged temporary exports in place so the snippet remains runnable.
- Use `handoff.md` for creating a focused continuation prompt that lets a new coding session resume with live repo state, file refs, decisions, next steps, and verification.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
