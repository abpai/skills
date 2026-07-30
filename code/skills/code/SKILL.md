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
  version: "3.1.6"
---

# Code Workflow Pack

This umbrella skill is the pack's explicit, human-invoked entry point: the single `/code` command in the `/` menu. It sets `disable-model-invocation: true` (`policy.allow_implicit_invocation: false` for Codex), so it runs only on human invocation. Each workflow also ships as its own `code/skills/<name>/SKILL.md` with `user-invocable: false` and `metadata.internal: true`, keeping per-command duplicates out of the `/` menu and out of flat-list installers like Codex's `npx skills`. Reach every workflow through this umbrella: the subcommand router below maps `/code <name>` to its module, each a flat support file beside this `SKILL.md`.

## Subcommand invocation

Pass a workflow's name as the first argument — the access path on every surface, since the Claude `/` menu shows only `/code` (per-command wrappers are hidden) and Codex has no `:` namespace. Both forms are equivalent:

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

- Use `prepare-pr.md` for PR readiness through push, effort-scaled via `--effort low|medium|high` (default `low`) — see its effort contract. Natural-language "review and commit" requests route here too; the pack has no local-only commit workflow.
- Use `simplify.md` for behavior-preserving simplification and low-value test pruning — see its scope contract for when it edits autonomously versus returns a proposal.
- Treat `review-patterns/` as the bundled detailed prompt library for `prepare-pr` gates. The `prepare-pr` workflow loads only the lenses it selects from the script's suggested-lens list (progressive disclosure).
- Use `understand.md` to trace a code path into `.understand/<topic>/` — an HTML map plus a runnable snippet backed by real code.
- Use `handoff.md` to create a continuation prompt so a fresh session can resume with live repo state, file refs, decisions, next steps, and verification.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
