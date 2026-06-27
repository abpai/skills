---
name: composer
description: "Route Cursor Composer workflows through one scoped /composer command. Use setup to verify Cursor Agent login or API-key readiness, generate to delegate bounded implementation from a planner brief, and review for strict read-only or adversarial Composer review of a diff or PR."
argument-hint: "[subcommand] [args] - e.g. generate <brief>, --review <PR>, setup --smoke"
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
  - Bash(agent *)
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
  version: "1.4.5"
---

# Composer Workflow Pack

Thin wrappers for using Cursor Composer as an implementation or review worker
from a planner-led session. The goal is the useful part of the Pi pattern
without adopting the Pi harness: a strong planner writes the brief, Composer
executes or reviews in a bounded workspace, and the parent agent inspects the
result before shipping.

This umbrella is the single scoped `/composer` command users see in the `/`
menu. Hidden wrappers stay out of model routing, menus, and flat-list
installers; reach every workflow through `/composer <name>`.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella —
this is the access path on every surface: the Claude `/` menu shows only
`/composer` (the per-command wrappers are hidden), and Codex has no `:`
namespace. Both forms are equivalent and supported:

- `composer <subcommand> <args>` — e.g. `composer generate <brief>`
- `composer --<subcommand> <args>` — e.g. `composer --review <PR>`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and
match it (case-insensitive) against `setup`, `generate`, or `review`. On a
match, load the sibling module `./<subcommand>.md` and treat the remaining
tokens as that workflow's input. Routing is complete when exactly one module is
selected, loaded, and handed the remaining args. If the first token is not a
known subcommand, treat the whole input as a natural-language request and route
by intent.

## Routing

- Use `setup.md` to verify Cursor Agent browser-login or `CURSOR_API_KEY`
  readiness, available Composer models, and optional OpenAI Codex login.
- Use `generate.md` to delegate implementation to Cursor Composer in a branch
  or isolated worktree.
- Use `review.md` to run strict read-only Composer review on a current diff or
  PR diff.

Load only the selected sibling module. For review, read `setup.md` only when
auth/model readiness is unknown; do not pre-load `generate.md`.

## Defaults

- Prefer the Cursor CLI (`cursor-agent`) over the TypeScript SDK for this skill.
  The headless CLI is the scripting path for one-off repo generate/review work:
  it supports `-p`/`--print`, `--workspace`, `--worktree`, `--model`,
  `--output-format`, browser login, and optional `CURSOR_API_KEY` /
  `--api-key`.
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
- Cursor API keys are optional. If the user has already run `agent login` /
  `cursor-agent login` and browser-login auth is healthy, run the wrapper with
  `--auth login` instead of hunting for an API key. For unattended automation,
  prefer `CURSOR_API_KEY`.
- `--auth login` is a **wrapper option**, not a Cursor Agent CLI flag. Do not
  run `agent --auth login` or `cursor-agent --auth login`; direct Cursor CLI
  auth uses `agent login` / `cursor-agent login`, and headless execution uses
  `agent -p ...` or `cursor-agent -p ...`.
- Browser login is valid Cursor auth only after
  `cursor-agent-doctor.sh --auth login --smoke` passes. `status` and `models`
  are not enough proof that headless `-p` prompts can run.
- For review-readiness checks, prove the path with `setup.md` smoke commands
  before sending repo code or diffs to Composer.
- Keep Composer as an executor/reviewer. The parent agent still owns scope,
  PR quality, final validation, and user-facing judgment.
- For machine-readable output, prefer `--output-format json` and read the final
  `result` field. Use `stream-json` only when you need progress events, and do
  not treat `thinking` events as user-facing review findings.

## Scripts

- `scripts/cursor-agent-doctor.sh` checks local setup and can run a small
  Composer smoke test.
- `scripts/composer-run.sh` loads `CURSOR_API_KEY` from env or `.env` when
  requested, or falls back to Cursor browser-login auth in `auto`/`login` modes,
  and runs a headless Composer generate/review prompt with safer defaults.

Set `CURSOR_ENV_FILE=/path/to/.env` only when intentionally using a Cursor API
key from another location. Do not point it at a repo `.env` "just in case"; a
repo env file without `CURSOR_API_KEY` should not block browser-login auth.
