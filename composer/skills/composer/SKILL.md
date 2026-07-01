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
  # Claude plugin install: the plugin's bin/ (symlinks to skills/composer/bin/)
  # is on PATH, so the wrappers run as bare commands. (${CLAUDE_PLUGIN_ROOT} and
  # ~ are NOT expanded in permission rules, so the bare command and the
  # checkout-relative paths below are the prompt-free forms.)
  - Bash(cursor-agent-doctor.sh)
  - Bash(cursor-agent-doctor.sh:*)
  - Bash(composer-run.sh:*)
  # Source checkout: real scripts in skills/composer/bin/ and plugin-root symlinks.
  - Bash(composer/skills/composer/bin/cursor-agent-doctor.sh)
  - Bash(composer/skills/composer/bin/cursor-agent-doctor.sh:*)
  - Bash(composer/skills/composer/bin/composer-run.sh:*)
  - Bash(composer/bin/cursor-agent-doctor.sh)
  - Bash(composer/bin/cursor-agent-doctor.sh:*)
  - Bash(composer/bin/composer-run.sh:*)
  - Bash(bash composer/skills/composer/bin/cursor-agent-doctor.sh:*)
  - Bash(bash composer/skills/composer/bin/composer-run.sh:*)
  - Bash(bash composer/bin/cursor-agent-doctor.sh:*)
  - Bash(bash composer/bin/composer-run.sh:*)
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
  version: "1.4.12"
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

## Cursor Agent CLI auth

**Browser login first, API key fallback, hard stop if neither.** The wrapper
scripts implement exactly this as `--auth auto` (default), so routed
`composer-run.sh` / `cursor-agent-doctor.sh` runs resolve auth for you — relay any
hard stop they emit to the user. When you call `agent -p` directly, follow the
same order:

1. Confirm `agent` (or `cursor-agent`) is on `PATH`.
2. Check browser auth with `agent status --format json` (else `agent status`),
   with `CURSOR_API_KEY` unset for the probe.
3. Authenticated → run headless with `agent -p ...`; no API-key ceremony.
4. Not authenticated → use a non-empty `CURSOR_API_KEY` from the environment.
   The CLI reads it automatically, so never run `agent login` with the key and
   never print, log, or echo it.
5. Neither → stop immediately and ask the user to run `agent login` or
   `export CURSOR_API_KEY=...`.

`--auth login` forces browser login; `--auth api-key` is for unattended
automation. `--auth` is a **wrapper option**, not a Cursor CLI flag — never run
`agent --auth ...` (direct CLI auth is `agent login`). Set
`CURSOR_ENV_FILE=/path/to/.env` (or `--env-file`) only when intentionally
supplying an API key from a file; do not point it at a repo `.env` "just in
case" — a repo env file without `CURSOR_API_KEY` must not block browser login.

## Defaults

- Prefer the Cursor Agent CLI (`agent`, falling back to `cursor-agent`) over the
  TypeScript SDK for this skill. The headless CLI is the scripting path for
  one-off repo generate/review work: it supports `-p`/`--print`, `--force`,
  `--trust`, `--approve-mcps`, `--workspace`, `--worktree`, `--model`,
  `--output-format`, browser login, and optional `CURSOR_API_KEY`.
- Use the TypeScript SDK only when building a reusable orchestrator that needs
  local/cloud agent selection, hooks/tool gates, durable agents, artifacts, or
  parallel cloud workers. Do not switch ordinary `/composer:generate` or
  `/composer:review` runs to the SDK.
- Prompt transport: Cursor Agent CLI takes the prompt as trailing positional
  `prompt...` for `agent -p`. Do not assume stdin or a native Cursor
  `--prompt-file` surface unless a local CLI smoke or current Cursor docs prove
  it. `composer-run.sh --prompt-file` is a wrapper abstraction: it reads the
  file and passes its contents as the final positional prompt argument. For very
  large prompts, compact the prompt, split the task, or first verify a newly
  documented Cursor transport before changing the wrapper.
- Default implementation model: `composer-2.5-fast`.
- Use `composer-2.5` when the user asks for the slower path or when the change
  is correctness-sensitive enough to justify it.
- Run review in Cursor `ask` mode, not `plan` mode. `ask` is read-only and
  returns a review answer; `plan` can turn the run into planning UI behavior and
  hide useful findings in progress/thinking events.
- Do not print, commit, or include secrets from `.env`. Report only whether
  `CURSOR_API_KEY` is present and whether the Cursor auth/model check passed.
- Default generate headless invocation (Run Everything equivalent):

  ```bash
  agent -p --force --trust --approve-mcps --output-format stream-json "$PROMPT"
  ```

  `composer-run.sh generate` adds `--force` and `--approve-mcps` by default.
  Use `--no-force` when the user only wants proposed changes. Review stays
  read-only (`--mode ask`, no `--force`).
- Add a prompt rule for generate runs: do not ask clarifying questions; make
  reasonable assumptions, apply changes, run relevant checks, and report what
  changed. `--force` prevents approval stops; it does not stop the model from
  asking questions unless the prompt forbids it.
- Browser login is valid Cursor auth only after
  `cursor-agent-doctor.sh --smoke` passes. `status` alone is not enough proof
  that headless `-p` prompts can run.
- For review-readiness checks, prove the path with `setup.md` smoke commands
  before sending repo code or diffs to Composer.
- Keep Composer as an executor/reviewer. The parent agent still owns scope,
  PR quality, final validation, and user-facing judgment.
- For machine-readable output, prefer `--output-format json` and read the final
  `result` field. Use `stream-json` only when you need progress events, and do
  not treat `thinking` events as user-facing review findings.

## Scripts

The wrappers ship in `bin/` beside this skill, so they travel with **both** the
Claude plugin install and the Codex flat install. Locate them, then use that
exact form in every wrapper command below (env vars do not persist across
separate shell calls, so don't rely on a saved variable — substitute the
resolved path inline):

1. **Claude plugin** — on `PATH`; run the bare command (`composer-run.sh`,
   `cursor-agent-doctor.sh`). Confirm with `command -v composer-run.sh`.
2. **Codex flat install** — `~/.agents/skills/composer/bin/` (the installer
   copies `bin/` next to `SKILL.md`).
3. **Source checkout** — `composer/skills/composer/bin/`.
4. **None present** — fall back to `agent -p ...` directly, resolving auth with
   the order above.

The module examples show the bare command; when it is not on `PATH`, prefix it
with the directory from step 2 or 3 (e.g.
`~/.agents/skills/composer/bin/cursor-agent-doctor.sh`).

- `cursor-agent-doctor.sh` checks local setup and can run a small Composer smoke
  test.
- `composer-run.sh` resolves auth, then runs a headless generate/review prompt
  with `--trust` and generate defaults `--force --approve-mcps`.
- `cursor-agent-lib.sh` (sourced, not run) resolves `agent` vs `cursor-agent`,
  checks browser auth via `agent status --format json`, and implements the
  login-first auth fallback.
