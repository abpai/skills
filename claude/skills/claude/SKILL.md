---
name: claude
description: >
  Run, monitor, resume, or inspect Claude Code from Codex. Use when users ask to
  delegate implementation, planning, review, or investigation to Claude; run
  claude -p; continue a Claude session; monitor named subagents; use native
  Claude background agents; or choose between CLI and Agent SDK execution.
license: MIT
metadata:
  author: Andy Pai
  version: "2.0.0"
---

# Claude Code CLI

Use Claude as a headless worker with durable artifacts. The default path is
`scripts/claude-run.sh`; it runs `claude -p` directly and does not use tmux.

## External Sharing

Claude Code sends prompts and workspace context to Claude Code/Anthropic. Before
launching, verify that the user has approved the destination, workspace/data
scope, purpose, and any exclusions. A standing approval in the current repo or
conversation satisfies this check; do not ask again when it already covers the
task.

Carry the approved scope into the prompt:

```text
User-approved external data sharing:
- Destination: Claude Code/Anthropic.
- Scope: <workspace, diff, and files Claude may inspect>.
- Purpose: <implementation, review, planning, or investigation>.
- Limits: <exclusions, or none under standing approval>.

Task:
...
```

If Claude needs context outside the approved scope, stop before widening it.

## Preflight

```bash
claude --version
claude auth status --text
```

Prefer an existing Claude plan login on a developer machine. Do not introduce an
API key merely because the task is headless. Billing and product behavior can
change; verify current Anthropic documentation before making cost claims.

## Run

Resolve the runner relative to this `SKILL.md`:

```bash
scripts/claude-run.sh run \
  --workspace "$PWD" \
  --prompt-file /absolute/path/to/task.md
```

The runner uses the configured default model unless `--model` is explicit. It
uses `--permission-mode auto` by default so unattended work does not park on a
manual prompt. Choose `--effort high` only when the task justifies it.

For a strict review:

```bash
scripts/claude-run.sh review \
  --workspace "$PWD" \
  --prompt "Review the current changes. Findings first. Do not edit files."
```

Review mode denies `Edit`, `Write`, and `NotebookEdit`. Claude can still run
shell tools, so the parent must inspect the workspace after every run. The
runner never automatically replays a Claude prompt.

## Liveness

`status.json` is the source of truth. Meaningful progress is any of:

- Claude stream events, including partial messages and hooks.
- Parent or named-subagent transcript growth.
- Content changes to Git-visible tracked or untracked workspace files.

The default inactivity timeout is five minutes and the overall deadline is 45
minutes. Both terminate the Claude process group, escalating from TERM to KILL.
Pass `0` only when another supervisor owns that limit.

Named-subagent transcripts are part of the liveness fingerprint. Completed child
answers are copied to `child-reports/`. When a child has finished but the parent
has not consumed its newer report, health becomes `report-pending`; 90 seconds of
continued non-consumption stops the parent and preserves the child report for
recovery. Any new stream, transcript, or workspace progress resets that shorter
clock. A legitimately quiet parent can hit this stricter child-report guard;
raise `--report-timeout` or set it to `0` when another supervisor owns recovery.

## Artifacts

Every run writes:

- `status.json` and compatibility `status.env`.
- `events.jsonl`, `stdout.log`, and `stderr.log`.
- `final.md`, `prompt.txt`, `command.txt`, and `preflight.log`.
- `run.env`, `monitor.sh`, and `continue.sh`.
- `child-reports/` plus parent/child transcript telemetry.
- Workspace baseline, status, changed-file, and diff artifacts for runs that are
  not marked read-only.

Use `--run-dir-file PATH` when another process launches the runner in the
background. Wait on the exact generated `monitor.sh`; never rediscover a global
"latest" directory. The monitor exits if the wrapper disappears without writing
a terminal status and has its own finite deadline, so attachment cannot wait
forever on stale artifacts. Raw stream JSON stays in the run artifacts instead
of flooding the parent console.

## Continue

```bash
<run-dir>/continue.sh --prompt "Follow up using the same Claude session."
```

The helper resumes the exact session and preserves workspace, model, permission,
effort, and timeout defaults in a fresh run directory. It fails instead of
guessing when no session id exists. Runs started with
`--no-session-persistence` cannot continue.

## Delegating To Named Subagents

Let Claude choose named agents when decomposition is genuinely useful. Prompts
should give each child a bounded question, expected report, and stop condition;
the parent remains responsible for synthesis and validation. Do not ask many
children to perform the same broad repository scan.

The runner monitors child transcripts directly, so a quiet parent waiting on an
active child is not mistaken for a stall. If a child finished but the parent is
stuck, inspect `child-reports/` before relaunching anything.

## Native Background Agents

Use Claude's own background feature only when the caller explicitly wants a
detached Claude-owned agent:

```bash
claude --bg --permission-mode auto "Investigate the bounded issue."
claude agents --json --all
```

Native background agents are managed by `claude agents`; they do not use this
wrapper's artifact contract. Prefer the wrapper for ordinary delegated work that
the current orchestrator must await and verify.

## Direct CLI And SDK

For a tiny answer needed immediately, raw print mode is acceptable:

```bash
printf '%s\n' "Answer this bounded question." | \
  claude -p --output-format json --permission-mode plan
```

Use the Agent SDK only when building a programmatic Claude integration with
custom tools, callbacks, or an application-owned event loop. It is unnecessary
for normal shell delegation.

Read `references/claude-cli.md` for current flags and raw stream details. Treat
Claude summaries as input, not proof: inspect diffs, rerun repository gates, and
own commit, push, PR, and merge decisions in the parent process.
