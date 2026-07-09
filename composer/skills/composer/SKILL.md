---
name: composer
description: >
  Run, monitor, resume, or review work with Cursor Agent and Composer models.
  Use when delegating bounded implementation, investigation, planning, or
  read-only review to Cursor; when durable headless artifacts are useful; or
  when continuing an exact Cursor chat from another agent workflow.
license: MIT
metadata:
  version: "2.0.0"
---

# Cursor Composer

Use Cursor Agent as a headless worker when a delegated task benefits from
durable liveness and continuation. The single entrypoint is
`bin/composer-run.sh`; there are no setup, generate, or review subskills.

## Run

Resolve the runner beside this `SKILL.md`:

```bash
bin/composer-run.sh run \
  --workspace "$PWD" \
  --prompt-file /absolute/path/to/task.md
```

The runner uses Cursor's configured default model. Pass `--model` only when the
user or task needs a specific model. Write-capable runs use Cursor headless
`--force --trust --approve-mcps`; use `--read-only`, `review`,
`--no-force`, or `--no-approve-mcps` to narrow that authority.

For findings-first review:

```bash
bin/composer-run.sh review \
  --workspace "$PWD" \
  --prompt "Review the current diff. Do not edit files. Findings first."
```

Review uses Cursor `ask` mode and never passes force or MCP approval. Treat that
as intent-level read-only behavior, then inspect the workspace yourself.

## Auth

The runner resolves auth in this order:

1. Existing Cursor browser login.
2. `CURSOR_API_KEY` already present in the environment.
3. An explicitly supplied `--env-file` or `CURSOR_ENV_FILE` containing
   `CURSOR_API_KEY`.

It never crawls workspace or ancestor `.env` files. If no auth source works, it
stops with the exact login/key setup choices. Never print or log the key.

## Liveness

Meaningful progress is a change to Cursor stream events or Git-visible tracked
or untracked file content. The default inactivity limit is five minutes and the
overall deadline is 45 minutes. Both terminate the owned process group with a
TERM-to-KILL escalation. The runner never automatically replays a prompt.

Use `status.json` as the source of truth. `monitor.sh` exits with the run, stops
if the wrapper disappears without a terminal status, and has its own finite
deadline. Use `--run-dir-file PATH` for exact background handoff; never discover
a global latest run.

## Artifacts

Each run writes `status.json`, `status.env`, `events.jsonl`, `stdout.log`,
`stderr.log`, `final.md`, `prompt.txt`, `command.txt`, `preflight.log`,
`run.env`, `monitor.sh`, and `continue.sh`. Write-capable runs also capture the
workspace baseline, status, changed files, and diff.

Raw stream JSON stays in artifacts. The parent console receives compact start,
progress, stall, timeout, and finish events.

## Continue

```bash
<run-dir>/continue.sh --prompt "Continue the same Cursor chat."
```

The helper resumes the exact `session_id` emitted by Cursor and preserves
workspace, model, auth mode, authority, and timeout defaults in a fresh run
directory. It fails instead of guessing when the initial run did not produce a
session id.

## Parent Contract

Give Composer a bounded task, scope, non-goals, proof command, and stop rules.
Let capable models plan and execute internally instead of imposing a separate
planner/executor ceremony. The parent still owns the diff, validation, commit,
push, PR, and merge decisions.

Use raw `agent -p` only for tiny one-shot answers where durable artifacts and
continuation add no value. Use Cursor worktrees explicitly outside this wrapper
so the parent always knows the workspace that must be inspected.
