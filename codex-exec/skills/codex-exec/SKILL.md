---
name: codex-exec
description: >
  Run the Codex CLI for non-interactive coding work. Use when users ask to run
  `codex exec`, `codex review`, or `codex exec resume`, continue a prior Codex
  session, or delegate software engineering work to OpenAI Codex from the
  terminal.
license: MIT
metadata:
  author: Andy Pai
  version: "1.5.1"
---

# Codex CLI

Use this skill when you need the local `codex` CLI from a terminal harness.
Bias toward non-interactive runs. Use the interactive Codex UI only when the
user explicitly wants to stay inside it.

## Environment (preflight)

```bash
echo "CODEX_EXEC_PREFLIGHT_$(date +%s%N)"
codex_exec_timeout() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 3 "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout 3 "$@"
  else
    "$@"
  fi
}
codex_exec_timeout codex --version 2>&1 || echo "codex: not installed"
codex_exec_timeout codex exec --version 2>&1 || echo "codex exec: unavailable"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git status --short 2>/dev/null | head -40
```

Run the block above before launching a long Codex task and treat it as ground
truth. If it shows `codex: not installed`, stop and report the setup issue instead of retrying.
If it shows `codex exec: unavailable`, the installed Codex CLI is broken or its
subcommand surface changed; stop and report that before launching a real task.
If it shows `not a git repo`, note that `codex review --uncommitted` and
similar git-dependent flows will not work.

## Default Stance

Unless the user asks for something else:

- Prefer `scripts/codex-run.sh` when Claude starts a run that it will monitor,
  especially for long reviews, generated prompt files, or any task where
  progress visibility matters.
- Use `codex exec` for one-shot work.
- Use `scripts/codex-run.sh review` for monitored code reviews; use
  `codex review` for short raw CLI review requests.
- Use a prior wrapper run's generated `continue.sh` for follow-up reviews or
  critiques in the same Codex session; use `codex exec resume --last` only when
  no wrapper run directory is available.
- Do not pass `--model` by default; let the user's Codex configuration choose the model.
- Pass `--model <MODEL>` only when the user explicitly requests a specific model.
- Use `medium` reasoning for ordinary work, `high` for harder tasks, and `low` for tiny checks.
- Use `--sandbox read-only` for `codex exec` analysis runs, and use the wrapper or `codex review` for review tasks.
- Expand to `workspace-write` only when Codex should edit files; use bypass flags only in externally sandboxed automation.
- Use `--json` or `--output-schema` only when another tool will parse the result.

Do not hide stderr by default, and do not add `--skip-git-repo-check` unless you
are intentionally running outside a Git repo.

Keep shell usage scoped to the documented `codex`, read-only `git`, and wrapper
commands below. Do not use this skill as general-purpose shell access.

For the current flag surface and example command matrix, see
`./references/codex-cli.md`.

## Monitor-Friendly Wrapper

Resolve `scripts/codex-run.sh` relative to this `SKILL.md` and call it with an
absolute path when your terminal cwd is the target repo. The wrapper exists to
make Claude and MonitorTool handoffs more reliable; it is intentionally thin and
still shells out to the local `codex` CLI.

Use it when:

- Claude will kick off the run and then monitor progress.
- The prompt is generated, multi-line, or stored in a file.
- You want stable artifacts for follow-up inspection.
- You need `--output-last-message` captured even when terminal output is noisy.

The wrapper prints stable lifecycle lines:

```text
[codex-exec] event=start ...
[codex-exec] event=paths run_dir=... status=... run_env=... monitor=... continue=... stdout=... stderr=... final=...
[codex-exec] event=spawn pid=...
[codex-exec] event=progress elapsed=...
[codex-exec] event=finish exit_code=... session_id=... continue=...
```

It writes each run under
`${CODEX_EXEC_RUNS_DIR:-${CODEX_HOME:-~/.codex}/codex-exec-runs}` by default:

- `status.env`: monitor-friendly state, paths, elapsed time, and exit code.
- `run.env`: stable run metadata, including the captured Codex session id once
  the run has started.
- `monitor.sh`: a MonitorTool-friendly wait command with periodic progress and
  the same exit code as the Codex run.
- `continue.sh`: resumes this exact Codex session in a fresh run directory.
- `stdout.log` / `stderr.log`: raw CLI streams.
- `events.jsonl`: mirror of stdout when `--json` is enabled.
- `final.md`: the `--output-last-message` capture.
- `command.txt`: shell-quoted command without prompt text.
- `prompt.txt`: prompt content sent through stdin.
- `preflight.log`: Codex version and workspace git status.

Example one-shot run:

```bash
scripts/codex-run.sh exec \
  --workspace "$PWD" \
  --sandbox read-only \
  --reasoning medium \
  --prompt-file prompt.txt
```

Example code review with MonitorTool-friendly heartbeats:

```bash
scripts/codex-run.sh review \
  --workspace "$PWD" \
  --heartbeat 15 \
  --prompt "Focus on bugs, regressions, and missing tests. Findings first."
```

When Claude starts the wrapper as a background task, point MonitorTool at the
printed `monitor.sh` path or run `bash "$run_dir/monitor.sh"`. That avoids
fragile sleeps, raw task-output polling, and repeated `tail` loops.

When review mode has custom instructions, the wrapper composes a read-only
`codex exec` review prompt with explicit git inspection commands for the
requested scope. This avoids current Codex CLI parsing behavior where scoped
review flags such as `--uncommitted` can be rejected when combined with a prompt
argument. When review mode has no custom prompt, the wrapper uses the dedicated
`codex exec review` subcommand.

Example resume:

```bash
scripts/codex-run.sh resume \
  --workspace "$PWD" \
  --last \
  --prompt-file follow-up.txt
```

Preferred follow-up after a wrapper run:

```bash
<run-dir>/continue.sh --prompt-file follow-up.txt
```

`continue.sh` calls `codex exec resume` with the captured session id when
available, preserving the prior workspace, run root, reasoning effort, timeout,
heartbeat, and sandbox defaults unless the follow-up command overrides them.
This is the best path when Claude is using MonitorTool because every follow-up
gets its own `run.env`, `status.env`, `monitor.sh`, and `final.md` while
keeping Codex conversation context warm.
If the prior run has no captured session id, the helper fails instead of
guessing with `--last`; pass `--last` explicitly only when that is intended.
Do not expect continuation to work from `--ephemeral` runs; those are
intentionally disposable.

Use raw `codex` commands for very small manual checks or rare CLI flags the
wrapper does not expose. For advanced cases, pass extra Codex arguments after
`--`, but keep model selection explicit and user-requested.

## Pick The Run Shape

### One-shot run

Default raw CLI shape for short delegated work:

```bash
codex exec \
  --sandbox read-only \
  -c model_reasoning_effort="medium" \
  "Summarize the uncommitted changes" \
  < /dev/null
```

### Prompt transport rule

Only pass the prompt on argv when it is short, single-line, and simple:
approximately under 500 characters with no quotes, shell substitutions, heredocs,
or generated text. Close stdin on argv runs so inherited pipes or terminals
cannot become extra input:

```bash
codex exec \
  --sandbox read-only \
  -c model_reasoning_effort="low" \
  "Say whether the repo has uncommitted changes" \
  < /dev/null
```

For anything larger, multi-line, generated, or quoting-sensitive, pass the
prompt through stdin and use `-` as the prompt sentinel:

```bash
codex exec \
  --sandbox read-only \
  -c model_reasoning_effort="medium" \
  - < prompt.txt
```

Do not assemble `codex exec` with shell `eval`. If you are writing a wrapper,
build an argv array and either close stdin for argv prompts or pipe the prompt
with `-`.

### Code review

Use the dedicated review subcommand for simple raw CLI reviews:

```bash
codex review --uncommitted < /dev/null
```

For custom review instructions plus a scoped diff, prefer the wrapper because
current Codex CLI builds can reject scoped review flags combined with a prompt:

```bash
scripts/codex-run.sh review \
  --workspace "$PWD" \
  --uncommitted \
  --prompt-file review-instructions.txt
```

### Resume the latest session

Use stdin when the follow-up prompt is large or multi-line:

```bash
printf '%s\n' "Continue and focus on the failing tests only" | \
  codex exec resume --last -
```

When resuming, keep prior settings unless the user explicitly wants to change
model, sandbox, or autonomy level.

### Resume a wrapper session

After `scripts/codex-run.sh exec` or `scripts/codex-run.sh review`, prefer the
generated continuation helper:

```bash
<run-dir>/continue.sh --prompt "Follow up on the same review and focus on tests."
```

This avoids guessing with `--last` and is usually faster/token-lighter than
restarting a fresh review because Codex can reuse the prior session context.

## Codex-Specific Gotchas

- `codex review` is the default review path when the task is code review.
- `codex exec` reads instructions from stdin when the prompt argument is omitted or set to `-`.
- If `codex exec` receives both an argv prompt and piped stdin, stdin is appended as a `<stdin>` block after
  the argv prompt. Do this only when you want that extra context.
- `codex exec resume --last` is the non-interactive continuation path; do not replace it with the top-level interactive `codex resume` command.
- `--skip-git-repo-check` is a situational escape hatch, not a default.
- `--ephemeral` is useful for disposable runs when session persistence would add noise.

## First-Run Sanity Check

Before delegating a long prompt on a machine or shell you have not used in this
session, verify that stdin transport works. With the wrapper:

```bash
scripts/codex-run.sh exec \
  --workspace "$PWD" \
  --sandbox read-only \
  --reasoning low \
  --timeout 60 \
  --prompt "Reply with one short hello."
```

Raw CLI fallback:

```bash
printf '%s\n' "Say hello in one short sentence." | \
  timeout 30 codex exec --sandbox read-only -c model_reasoning_effort="low" -
```

If this exits non-zero or hangs before any meaningful progress, debug the Codex
installation, authentication, or wrapper before sending the real prompt.

## Structured Output

Use structured output only when another tool needs to consume the result:

```bash
codex exec \
  --sandbox read-only \
  --output-schema schema.json \
  "Review the current diff" \
  < /dev/null
```

## Troubleshooting

- If the preflight block above showed `codex: not installed`, report a CLI setup issue.
- If the preflight block above showed `codex exec: unavailable`, report a CLI install or version issue.
- If `codex exec` or `codex review` exits non-zero, treat the run as failed.
- If the wrapper exits non-zero, inspect `status.env`, `stderr.log`, and
  `final.md` in the printed run directory before retrying.
- If MonitorTool needs progress, prefer the wrapper because it emits heartbeat
  lines even when Codex has not produced new terminal output.
- If a non-interactive run needs too much context, switch from argv text to stdin with `-`.
- If a run prints `Reading additional input from stdin...`, that message alone is normal when Codex is
  consuming stdin. If it then produces no meaningful progress for more than about 30 seconds, kill it and
  rerun with either `- < prompt.txt` for stdin prompts or `< /dev/null` for short argv prompts.
- If a prompt has newlines or is longer than about 500 characters, do not retry argv quoting. Use stdin.
- If the task is review-oriented, use the wrapper for monitored/custom-instruction reviews and raw `codex review` for simple unprompted reviews.
- If a run needs edits, change the sandbox and autonomy deliberately instead of piling on flags by habit.
- If output includes warnings or partial results, summarize what Codex completed and what remains uncertain.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `codex-exec` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **codex-exec** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update codex-exec` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
