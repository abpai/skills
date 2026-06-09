---
name: composer
description: "Grouped Cursor Composer workflow pack. Invoke with a subcommand argument — never call the subcommand skills directly (they have disable-model-invocation). Subcommands: 'setup' (verify Cursor Agent/API key), 'generate' (delegate implementation to Composer), 'review' (strict read-only Composer review of a diff or PR)."
argument-hint: "[subcommand] [args] — e.g. generate <brief>, --review <PR>, setup --smoke"
license: MIT
# allowed-tools lives on this umbrella, not on the per-workflow wrappers: the
# wrappers set disable-model-invocation + user-invocable: false, so they are
# never the active skill. Declared here, the union suppresses prompts during the
# routed setup/generate/review workflows without depending on wrapper activation.
allowed-tools:
  - Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh)
  - Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh:*)
  - Bash(composer/skills/composer/scripts/composer-run.sh:*)
  - Bash(bash composer/skills/composer/scripts/cursor-agent-doctor.sh:*)
  - Bash(bash composer/skills/composer/scripts/composer-run.sh:*)
  - Bash(cursor-agent *)
  - Bash(codex *)
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git fetch:*)
  - Bash(git log:*)
  - Bash(git branch:*)
  - Bash(git worktree:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr edit:*)
  - Bash(gh pr checks:*)
  - Bash(gh pr merge:*)
  - Bash(mkdir:*)
  - Bash(rm:*)
  - Bash(mktemp:*)
  - Read
  - Write
  - Edit
  - Grep
  - Glob
metadata:
  version: "1.4.2"
---

# Composer Workflow Pack

Thin wrappers for using Cursor Composer as an implementation or review worker
from a planner-led session. The goal is the useful part of the Pi pattern
without adopting the Pi harness: a strong planner writes the brief, Composer
executes or reviews in a bounded workspace, and the parent agent inspects the
result before shipping.

This umbrella is the single scoped `/composer` command users see in the `/`
menu. Each workflow also ships as its own `composer/skills/<name>/SKILL.md`, but
those per-command skills set `disable-model-invocation: true`,
`user-invocable: false`, and `metadata.internal: true`, so they stay out of the
model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates
of the umbrella), and out of flat-list installers like the `npx skills`
installer used by Codex. Reach any workflow through this umbrella — the
subcommand router below maps `/composer <name>` to the matching module.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella —
this is the access path on every surface: the Claude `/` menu shows only
`/composer` (the per-command wrappers are hidden), and Codex has no `:`
namespace. Both forms are equivalent and supported:

- `composer <subcommand> <args>` — e.g. `composer generate <brief>`
- `composer --<subcommand> <args>` — e.g. `composer --review <PR>`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and
match it (case-insensitive) against `setup`, `generate`, or `review`. On a
match, load `skills/composer/<subcommand>.md` and treat the remaining tokens as
that workflow's input. If the first token is not a known subcommand, treat the
whole input as a natural-language request and route by intent.

## Routing

- Use `setup.md` to verify Cursor Agent, `CURSOR_API_KEY`, available Composer
  models, and optional OpenAI Codex login.
- Use `generate.md` to delegate implementation to Cursor Composer in a branch
  or isolated worktree.
- Use `review.md` to run strict read-only Composer review on a current diff or
  PR diff.

## Defaults

- Prefer the Cursor CLI (`cursor-agent`) over the TypeScript SDK for this skill.
  The headless CLI is the scripting path for one-off repo generate/review work:
  it supports `--print`, `--workspace`, `--worktree`, `--model`,
  `--output-format`, browser login, and `CURSOR_API_KEY`.
- Use the TypeScript SDK only when building a reusable orchestrator that needs
  local/cloud agent selection, hooks/tool gates, durable agents, artifacts, or
  parallel cloud workers. Do not switch ordinary `/composer:generate` or
  `/composer:review` runs to the SDK.
- Default implementation model: `composer-2.5-fast`.
- Use `composer-2.5` when the user asks for the slower path or when the change
  is correctness-sensitive enough to justify it.
- Run review in Cursor `ask` mode, not `plan` mode. `ask` is read-only and
  returns a review answer; `plan` can turn the run into planning UI behavior and
  hide useful findings in progress/thinking events.
- Do not print, commit, or include secrets from `.env`. Report only whether
  `CURSOR_API_KEY` is present and whether the Cursor auth/model check passed.
- Browser login is valid Cursor auth only after
  `cursor-agent-doctor.sh --auth login --smoke` passes. For unattended
  workflows, prefer `CURSOR_API_KEY`; `status` and `models` are not enough proof
  that headless `--print` prompts can run.
- Keep Composer as an executor/reviewer. The parent agent still owns scope,
  PR quality, final validation, and user-facing judgment.
- For machine-readable output, prefer `--output-format json` and read the final
  `result` field. Use `stream-json` only when you need progress events, and do
  not treat `thinking` events as user-facing review findings.

## Scripts

- `scripts/cursor-agent-doctor.sh` checks local setup and can run a small
  Composer smoke test.
- `scripts/composer-run.sh` loads `CURSOR_API_KEY` from env or `.env` and runs a
  headless Composer generate/review prompt with safer defaults.

Set `CURSOR_ENV_FILE=/path/to/.env` when working from an isolated worktree whose
real key file lives elsewhere.
