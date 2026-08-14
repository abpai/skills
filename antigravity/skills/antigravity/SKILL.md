---
name: antigravity
disable-model-invocation: true
description: >
  Run Google Antigravity CLI as a headless worker for bounded implementation,
  investigation, planning, or repository review, with Gemini model routing,
  durable liveness artifacts, and exact conversation continuation.
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
---

# Antigravity

Use Antigravity CLI as a headless worker through `scripts/antigravity-run.sh`.
Give it a bounded task, scope, non-goals, proof command, and stop condition. The
parent owns the resulting diff, validation, commit, push, PR, and merge choices.

## Authority and external sharing

Loading this skill or naming Antigravity, Gemini, or `$antigravity` does not
authorize execution. Launch only when the user explicitly asks to run,
delegate, review, or continue work with Antigravity or Gemini through this CLI.

Antigravity sends prompts and workspace context to Google. Before launching,
verify that the user approved the destination, workspace/data scope, purpose,
and exclusions. A standing approval that already covers the task is enough.
Carry that scope into the prompt and stop instead of widening it. Do not claim a
repository review if transfer is blocked or the run did not inspect repository
content.

## Run

Resolve the runner relative to this `SKILL.md`:

```bash
scripts/antigravity-run.sh run \
  --workspace "$PWD" \
  --prompt-file /absolute/path/to/task.md
```

Omit `--model` and `--effort` to use Antigravity's configured defaults. Pass a
model only when the user names one for the run. Resolve the exact slug with
`agy models`; headless mode fails rather than silently falling back on an
unknown slug. Gemini 3.7 Flash currently exposes separate medium and high
slugs, so do not guess which effort the user intended.

Use `--allow-all` only when the user explicitly authorizes every tool call in
the bounded workspace. It maps to Antigravity's
`--dangerously-skip-permissions`. Prefer the user's configured fine-grained
permissions. Use `--sandbox` when terminal containment is appropriate; it does
not replace the permission policy.

Before launch, tell the user the objective and either the explicit
model/effort or that both use configured defaults. After launch, report the
exact model slug when one was requested; Antigravity's stream does not identify
the configured default model when no override is passed.

## Review

For findings-first review:

```bash
scripts/antigravity-run.sh review \
  --workspace "$PWD" \
  --prompt "Review the current changes. Findings first. Do not edit files."
```

Headless review commonly needs shell commands to inspect the repository. When
the user explicitly authorizes all tool calls for the bounded review, combine
`--sandbox --allow-all`; the first enables terminal containment and the second
maps to Antigravity's `--dangerously-skip-permissions`. Do not add these flags
silently or treat sandboxing as protection from web or MCP side effects.

Review mode creates a disposable local clone containing tracked changes and
non-ignored untracked files, then runs Antigravity there. This protects the
source workspace even though Antigravity auto-allows workspace writes. Ignored
files are excluded. The runner records source-workspace status before and after
the run and fails if the source changed.

Treat review isolation as local write containment, not external-transfer
approval. The cloned repository content still goes to Google when the agent
reads it.

## Liveness and artifacts

`status.json` is the source of truth. Meaningful progress is Antigravity stream
growth or Git-visible content changes in the active run workspace. The default
inactivity limit is five minutes and the overall deadline is 45 minutes. The
runner terminates its owned process group and never replays a prompt.

Every run writes `status.json`, `status.env`, `events.jsonl`, `stdout.log`,
`stderr.log`, `runner.log`, `final.md`, `prompt.txt`, `command.txt`,
`preflight.log`, `run.env`, `monitor.sh`, and `continue.sh`. Write-capable runs
also capture workspace baseline, status, changed files, and diff. Review runs
record source-workspace status before and after isolation.

Use `--run-dir-file PATH` for background handoff. Wait on the exact generated
`monitor.sh`; never rediscover a global latest directory. Raw NDJSON remains in
the artifacts instead of flooding the parent console.

## Continue

```bash
<run-dir>/continue.sh --prompt "Continue the same Antigravity conversation."
```

The helper resumes the exact `conversation_id` and preserves workspace, model,
effort, agent, authority, sandbox, and timeout defaults in a fresh run
directory. It fails instead of guessing when the prior run has no conversation
ID.

## Failures

The runner performs one preflight and records the installed CLI version and
model-list result without storing credentials. A missing CLI, unavailable
keyring, unauthenticated session, invalid model, soft-denied tool, timeout, or
non-success result remains non-successful in `status.json`. Do not call a
soft-denied run successful merely because `agy` exited zero; inspect stream and
stderr evidence.

Read `references/antigravity-cli.md` for the supported headless flags, event
shape, permission behavior, and artifact details. Treat the worker's final text
as input, not proof; inspect its artifacts and rerun repository gates yourself.
