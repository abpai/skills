---
name: composer
description: Use when the user asks for /composer:setup, /composer:generate, /composer:review, Cursor Composer delegation, Composer 2.5 implementation subagents, Cursor-agent setup checks, Cursor API key validation, or a thin planner/executor workflow that uses Cursor without the Pi harness.
argument-hint: "[subcommand] [args] — e.g. generate <brief>, --review <PR>, setup --smoke"
license: MIT
metadata:
  version: "1.3.1"
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
  The CLI reuses the user's Cursor setup, supports `CURSOR_API_KEY`, and is
  easier to smoke-test from arbitrary repos.
- Default implementation model: `composer-2.5-fast`.
- Use `composer-2.5` when the user asks for the slower path or when the change
  is correctness-sensitive enough to justify it.
- Do not print, commit, or include secrets from `.env`. Report only whether
  `CURSOR_API_KEY` is present and whether the Cursor auth/model check passed.
- Keep Composer as an executor/reviewer. The parent agent still owns scope,
  PR quality, final validation, and user-facing judgment.

## Scripts

- `scripts/cursor-agent-doctor.sh` checks local setup and can run a small
  Composer smoke test.
- `scripts/composer-run.sh` loads `CURSOR_API_KEY` from env or `.env` and runs a
  headless Composer generate/review prompt with safer defaults.

Set `CURSOR_ENV_FILE=/path/to/.env` when working from an isolated worktree whose
real key file lives elsewhere.
