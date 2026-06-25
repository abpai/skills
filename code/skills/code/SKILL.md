---
name: code
description: "Route coding workflows through one scoped /code command. Use prepare-pr for full PR readiness, review-and-commit for a quick local commit, handoff for continuation prompts, thermo-nuclear for strict read-only audits, walkthrough for mastery checks, understand for traced code maps, dead-code for reachability audits, and secure-dependencies for dependency hardening."
argument-hint: "[subcommand] [args] - e.g. understand src/api, --prepare-pr, review-and-commit, thermo-nuclear"
# allowed-tools belongs on the umbrella because hidden wrappers never become the
# active skill; git push and PR writes are still sealed by hooks/gate-before-push.sh.
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *)
  Bash(git add *) Bash(git commit *) Bash(git branch *)
  Bash(git push *) Bash(git rev-parse *) Bash(git restore --staged *)
  Bash(codex *) Bash(curl *) Bash(npm *) Bash(yarn *)
  Bash(pnpm *) Bash(bun *) Bash(npx *) Bash(pytest *)
  Bash(go test *) Bash(cargo test *) Bash(gh *)
  mcp__chrome-devtools__* mcp__playwright__* mcp__browser__*
  Read Write Edit Grep Glob
metadata:
  version: "2.1.4"
---

# Code Workflow Pack

This umbrella skill is the model-invocable entry point for the pack and the single scoped `/code` command users see in the `/` menu. Each workflow also ships as its own `code/skills/<name>/SKILL.md`, but those per-command skills set `disable-model-invocation: true`, `user-invocable: false`, and `metadata.internal: true`, so they stay out of the model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates of the umbrella), and out of flat-list installers like the `npx skills` installer used by Codex. Reach any workflow through this umbrella — the subcommand router below maps `/code <name>` to the matching module. The workflow modules referenced below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/code` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `code <subcommand> <args>` — e.g. `code understand src/api`
- `code --<subcommand> <args>` — e.g. `code --understand src/api`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it (case-insensitive) against the workflow names below. On a match, load the sibling module `./<subcommand>.md` and treat the remaining tokens as that workflow's input. Routing is complete when exactly one module is selected, loaded, and handed the remaining args. If the first token is not a known subcommand, treat the whole input as a natural-language request and route by intent. Known subcommands: `prepare-pr`, `review-and-commit`, `handoff`, `thermo-nuclear`, `walkthrough`, `understand`, `dead-code`, `secure-dependencies`.

## Routing

- Use `prepare-pr.md` for full PR readiness: deterministic preflight, quality gates from `review-patterns/`, source-grounded QA, validation, PR text, commit, seal, push, and PR update. There is no separate finish-lane command; the preflight is a phase inside `prepare-pr`.
- Use `review-and-commit.md` for quick local review plus commit: inspect scope, fix real issues, run targeted checks, plan a commit, ask approval, then commit.
- Treat `review-patterns/` as the bundled detailed prompt library for `prepare-pr` gates. The `prepare-pr` workflow loads only the lenses it selects from the script's suggested-lens list (progressive disclosure).
- Use `walkthrough.md` to teach the owner a system or change to verified mastery: establish mission and prior knowledge, ground a checklist, then quiz one scenario at a time until every item has an unaided correct answer. It is a persistent comprehension goal, not a tour.
- Use `understand.md` for tracing a specific code path into a `.understand/<topic>.html` artifact with call graph, concrete values, side effects, and import skeleton.
- Use `dead-code.md` for conservative dead-code reachability audits and safe removal plans.
- Use `secure-dependencies.md` for dependency resolution and supply-chain hardening in code repositories.
- Use `handoff.md` for creating a focused continuation prompt that lets a new coding session resume with live repo state, file refs, decisions, next steps, and verification.
- Use `thermo-nuclear.md` for unusually strict baseline-to-PR code quality audits: define scope, protect the working tree, gather structural evidence, and report only evidence-backed findings without editing code or preparing PR artifacts.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
