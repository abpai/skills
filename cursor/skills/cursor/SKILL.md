---
name: cursor
disable-model-invocation: true
description: >
  Run, monitor, resume, or review work with Cursor Agent and Cursor models —
  bounded implementation, investigation, planning, or read-only review, with
  durable headless artifacts and exact chat continuation.
license: MIT
metadata:
  version: "2.2.3"
---

# Cursor

Use Cursor Agent as a headless worker when a delegated task benefits from
durable liveness and continuation. The single entrypoint is
`bin/cursor-run.sh`; there are no setup, generate, or review subskills.

## Run

Resolve the runner beside this `SKILL.md`:

```bash
bin/cursor-run.sh run \
  --workspace "$PWD" \
  --prompt-file /absolute/path/to/task.md
```

Omit `--model`. The run then uses the model the user already selected in Cursor,
which is the intended default and the reason they configured one. Pass `--model`
only when the user names a model for this run; a routing preference in your own
operating instructions is not that request, and neither is your judgment that
another model suits the task. When the user does name one, resolve its exact id
with `cursor-agent models` before passing it — Cursor accepts only ids from that
list and rejects everything else, so a plausible-looking alias like `grok` or
`sonnet` fails the run rather than resolving to the family you meant.

Write-capable runs use Cursor headless `--force --trust --approve-mcps`; use
`--read-only`, `review`, `--no-force`, or `--no-approve-mcps` to narrow that
authority.

For findings-first review:

```bash
bin/cursor-run.sh review \
  --workspace "$PWD" \
  --prompt "Review the current diff. Do not edit files. Findings first."
```

Review uses Cursor `ask` mode and never passes force or MCP approval. Treat that
as intent-level read-only behavior, then inspect the workspace yourself.

The default artifact root is `~/.cursor/headless-runs`. If that location is not
writable, as in some agent sandboxes, pass `--run-root` with an absolute path to
a writable temporary or workspace directory. Do not treat an artifact-path
permission error as a Cursor authentication failure.

## Auth

The runner resolves auth in this order:

1. Existing Cursor browser login.
2. `CURSOR_API_KEY` already present in the environment.
3. An explicitly supplied `--env-file` or `CURSOR_ENV_FILE` containing
   `CURSOR_API_KEY`.

It never crawls workspace or ancestor `.env` files. If no auth source works, it
stops with the exact login/key setup choices. Never print or log the key.

Browser-login visibility can be host-bound. If a sandboxed run reports missing
auth, inspect that attempt's `runner.log`, then retry the same bounded command on
the host before concluding that the user is logged out. Reuse one task-scoped
`--run-dir-file` for a related sandbox/host retry chain; the runner appends every
published run directory to `<run-dir-file>.history`. Reserve distinct pointers
for unrelated tasks.

## Liveness

Meaningful progress is a change to Cursor stream events or Git-visible tracked
or untracked file content. The default inactivity limit is five minutes and the
overall deadline is 45 minutes. Both terminate the owned process group with a
TERM-to-KILL escalation. The runner never automatically replays a prompt.

Use `status.json` as the source of truth. `monitor.sh` exits with the run, stops
if the wrapper disappears without a terminal status, and has its own finite
deadline. Use `--run-dir-file PATH` for exact background handoff; never discover
a global latest run.

After a run starts, read its `[cursor-run] event=model` line or `status.json`'s
`model` field and tell the user which model Cursor selected. Do not issue a
separate model probe: Auto selection is task-specific. `requested_model` records
an optional `--model` override separately from the resolved model.

## Artifacts

Each run writes `status.json`, `status.env`, `events.jsonl`, `stdout.log`,
`stderr.log`, `runner.log`, `final.md`, `prompt.txt`, `command.txt`,
`preflight.log`,
`run.env`, `monitor.sh`, and `continue.sh`. Write-capable runs also capture the
workspace baseline, status, changed files, and diff.

Raw stream JSON stays in artifacts. `runner.log` retains wrapper state
transitions and pre-spawn diagnostics without storing the raw account-status response. The
parent console distinguishes meaningful `progress` from silent `heartbeat`
events, plus stall, timeout, and finish events. `final.md` prefers the last
complete assistant message and falls back to Cursor's result field. Cursor's
result may concatenate intermediate progress narration before that terminal
answer; `final.md` intentionally omits those updates. Treat it as truncated only
when substantive final-answer material is missing, not merely because it is
shorter than the result field.

## Continue

```bash
<run-dir>/continue.sh --prompt "Continue the same Cursor chat."
```

The helper resumes the exact `session_id` emitted by Cursor and preserves
workspace, model, auth mode, authority, and timeout defaults in a fresh run
directory. It fails instead of guessing when the initial run did not produce a
session id.

## Parent Contract

Give Cursor a bounded task, scope, non-goals, proof command, and stop rules.
Let capable models plan and execute internally instead of imposing a separate
planner/executor ceremony. The parent still owns the diff, validation, commit,
push, PR, and merge decisions.

Use raw `agent -p` only for tiny one-shot answers where durable artifacts and
continuation add no value. Use Cursor worktrees explicitly outside this wrapper
so the parent always knows the workspace that must be inspected.
