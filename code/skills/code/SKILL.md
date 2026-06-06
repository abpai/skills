---
name: code
description: Grouped coding workflow pack. Use /code:prepare-pr for full PR readiness — full PR diff (committed and uncommitted), deterministic preflight, quality gates, source-grounded QA, validation, PR text, optional commits, gate-before-push. Use /code:review-and-commit for quick local review plus commit. Also use for /code:explain, /code:walkthrough, /code:understand, /code:dead-code, /code:scratch, /code:secure-dependencies, and /code:handoff.
argument-hint: "[subcommand] [args] — e.g. understand src/api, --prepare-pr, review-and-commit"
metadata:
  version: "2.0.0"
---

# Code Workflow Pack

This umbrella skill is the model-invocable entry point for the pack and the single scoped `/code` command users see in the `/` menu. Each workflow also ships as its own `code/skills/<name>/SKILL.md`, but those per-command skills set `disable-model-invocation: true`, `user-invocable: false`, and `metadata.internal: true`, so they stay out of the model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates of the umbrella), and out of flat-list installers like the `npx skills` installer used by Codex. Reach any workflow through this umbrella — the subcommand router below maps `/code <name>` to the matching module. The workflow modules referenced below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/code` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `code <subcommand> <args>` — e.g. `code understand src/api`
- `code --<subcommand> <args>` — e.g. `code --understand src/api`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it (case-insensitive) against the workflow names below. On a match, load `skills/code/<subcommand>.md` and treat the remaining tokens as that workflow's input. If the first token is not a known subcommand, treat the whole input as a natural-language request and route by intent. Known subcommands: `prepare-pr`, `review-and-commit`, `explain`, `walkthrough`, `understand`, `dead-code`, `scratch`, `secure-dependencies`, `handoff`.

## Routing

- Use `prepare-pr.md` for full PR readiness: a single self-contained workflow that runs a deterministic preflight (scope union of `<base>...HEAD` + uncommitted + untracked, discovered fix/validation commands, mechanical scans, suggested-lens tagger), selects and runs quality gates from `review-patterns/`, performs source-grounded QA and verification, runs independent review, drafts PR text, then seals and gates before push. There is no separate finish-lane command — the preflight is a phase inside `prepare-pr`.
- Use `review-and-commit.md` for quick local review plus commit: inspect scope, fix real issues, run targeted checks, plan a commit, ask approval, then commit.
- Treat `review-patterns/` as the bundled detailed prompt library for `prepare-pr` gates. The `prepare-pr` workflow loads only the lenses it selects from the script's suggested-lens list (progressive disclosure).
- Use `explain.md` for dense technical explanations, tutorials, walkthrough prose, README guidance, or onboarding docs.
- Use `walkthrough.md` to teach the owner a system or change to verified mastery: ground a checklist, then quiz one scenario at a time until every item has an unaided correct answer. It is a persistent comprehension goal, not a tour.
- Use `understand.md` for tracing a specific code path into a `.understand/<topic>.html` artifact with call graph, concrete values, side effects, and scratch skeleton imports.
- Use `dead-code.md` for conservative dead-code reachability audits and safe removal plans.
- Use `scratch.md` for hands-on codebase exploration with runnable `.scratch/` scripts.
- Use `secure-dependencies.md` for dependency resolution and supply-chain hardening in code repositories.
- Use `handoff.md` for creating a focused continuation prompt that lets a new coding session resume with live repo state, file refs, decisions, next steps, and verification.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
