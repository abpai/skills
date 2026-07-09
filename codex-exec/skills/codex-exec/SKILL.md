---
name: codex-exec
description: >
  Run, review, resume, or delegate through the Codex CLI as a headless worker.
  Use for implementation, code review, second opinions, monitored long-running
  Codex work, session continuation, or provider-diverse critique of plans,
  diffs, tests, and architecture.
license: MIT
metadata:
  author: Andy Pai
  version: "2.0.0"
---

# Codex CLI

Use the local `codex` CLI as a non-interactive worker. Let the parent agent own
scope, validation, integration, and the user-facing verdict.

## Route The Work

- Use `scripts/codex-run.sh run` for analysis or implementation.
- Add `--write` only when Codex should edit the workspace.
- Use `scripts/codex-run.sh review` for a diff, branch, commit, or PR review.
- Use a completed run's `continue.sh` for follow-up work in the same session.
- Use raw `codex exec` only for tiny one-shot requests that do not need durable
  artifacts or monitoring.

Resolve scripts relative to this `SKILL.md`; installed plugin paths may differ
from the source checkout.

## Preflight

Before a long run, verify:

```bash
codex --version
codex exec --version
git rev-parse --show-toplevel
git status --short
```

Stop on missing/broken CLI or auth. Outside a trusted Git repository, either
move into the target repository or explicitly pass `--skip-git-repo-check` and
close stdin. Do not let Codex wait on an invisible trust prompt.

## Run

Read-only:

```bash
scripts/codex-run.sh run \
  --workspace "$PWD" \
  --prompt-file /path/to/prompt.md
```

Write-capable:

```bash
scripts/codex-run.sh run \
  --workspace "$PWD" \
  --write \
  --prompt-file /path/to/task.md
```

The wrapper defaults to the user's configured model, medium reasoning,
JSONL events, a five-minute meaningful-inactivity limit, and a 45-minute hard
limit. Pass `--model` only when the user requests a model. Use `--reasoning
high` for genuinely difficult work rather than by habit.

Write runs capture the workspace baseline, status, changed files, full diff,
and diff stat. Do not ask a workspace-write run in a linked worktree to commit:
its Git metadata may live outside the sandbox. Let the parent inspect and
commit the diff.

## Review

```bash
scripts/codex-run.sh review \
  --workspace "$PWD" \
  --uncommitted \
  --prompt "Find concrete bugs and regressions. Findings first."
```

Use `--base REF` or `--commit SHA` when that is the requested scope. Keep the
review read-only and verify each reported finding before forwarding it.

## Continue

Prefer the run-specific helper:

```bash
<run-dir>/continue.sh --prompt-file /path/to/follow-up.md
```

It resumes the captured session with the prior workspace, sandbox, reasoning,
timeouts, and run root. Use `codex exec resume --last` only when guessing the
latest session is explicitly intended.

## Artifact Contract

Every wrapper run writes:

- `status.json`: source of truth for state, health, liveness, counts, paths,
  session id, and exit code.
- `status.env`: compatibility projection; do not source it as shell.
- `run.env`: continuation metadata.
- `events.jsonl`, `stdout.log`, and `stderr.log`: raw execution evidence.
- `final.md`: final answer when the CLI produced one.
- `prompt.txt`, `command.txt`, and `preflight.log`: auditable input and launch
  metadata; `command.txt` excludes prompt text.
- `monitor.sh` and `continue.sh`: deterministic wait and continuation helpers.
- Workspace baseline/diff artifacts whenever the run can write.

Pass `--run-dir-file PATH` for background launches so the caller receives the
exact run directory without racing global "latest" discovery. The wrapper does
not daemonize; use the caller's background-process facility, then wait on the
generated `monitor.sh`. The monitor is finite: it exits when the wrapper
process recorded in `status.json` is gone without a terminal state, and after
`CODEX_EXEC_MONITOR_TIMEOUT_SECONDS` (default 3600, `0` disables) as a
last-resort bound.

## Liveness And Recovery

Meaningful progress is provider output, JSON events, or content changes to
Git-visible tracked and untracked files.
Heartbeat lines alone do not reset the inactivity clock.

On a silent stall, the wrapper terminates the provider process group. It retries
once only for read-only work; write-capable prompts are never replayed
automatically. A second stall ends with state `stalled` and exit code 124,
preserving all artifacts for diagnosis.

`--timeout` is a hard child-process deadline, not a monitor-detach operation.
Use `--stall-timeout 0` or `--timeout 0` only when another supervisor owns that
limit.

## Prompt Contract

For delegated implementation, state the task, scope, non-goals, validation,
allowed delivery actions, and stop conditions. Tell Codex to make reasonable
assumptions and proceed instead of asking routine clarification questions.

Treat Codex output as input, not proof. The parent must inspect the diff, rerun
the relevant repository gates, and own commit, push, PR, and merge decisions.

## Compatibility And Advanced Cases

`generate` remains a compatibility alias for `run --write`; new workflows must
use `run --write`. Read `generate.md` only for explicit independent-candidate or
isolated-worktree orchestration. Use `scripts/codex-workspace.sh` only when that
extra isolation is actually required.

Read `references/codex-cli.md` for current raw CLI flags and edge cases. Use a
custom output schema only when another tool requires structured final output.

When a run fails, inspect `status.json`, then `stderr.log`, `events.jsonl`, and
`final.md`. Report the concrete failure instead of retrying a changed shape
repeatedly.
