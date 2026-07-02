---
name: codex-exec
description: >
  Run, review, resume, or delegate through the Codex CLI as a second-opinion
  worker. Use for `codex exec`, `codex review`, implementation candidates via
  `generate`, monitored long-running Codex runs, CLI continuation, or
  provider-diverse critique of plans, diffs, code, tests, and architecture.
license: MIT
metadata:
  author: Andy Pai
  version: "1.6.0"
---

# Codex CLI

Use this skill when you need the local `codex` CLI from a terminal harness.
Bias toward non-interactive runs. Use the interactive Codex UI only when the
user explicitly wants to stay inside it.

## Workflow routing

- Use `./generate.md` when Codex is an **implementation candidate** in a
  planner-led loop. Prefer `scripts/codex-run.sh generate` with an isolated
  branch or worktree.
- Use `scripts/codex-run.sh review` or `codex review` for read-only critique.
- Use `scripts/codex-run.sh exec` for one-shot analysis or generation that does
  not need the implementation-candidate artifact bundle.
- Use `./references/implementation-candidate-plan.md` for the phased roadmap
  when extending dual-candidate support.

Load only the module that matches the task. For implementation delegation, read
`generate.md`; do not pre-load review-only guidance unless the next step is
comparison or critique.

## Dual-candidate orchestration

When a parent agent runs Codex as one of two independent implementation
candidates:

1. Same task brief.
2. Separate workspaces.
3. No peer diff/report visibility until both candidates finish.
4. Parent inspects artifacts, reruns validation, and synthesizes.

The runtime workflow lives in `./generate.md`. Keep Fable, Opus, Composer, or
other workers as examples only; the stable vocabulary is parent orchestrator,
Codex candidate, and peer candidate.

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
If it shows `not a git repo`, **do not launch `codex exec` from that directory
as-is**: outside a Git repo (or any directory Codex has not been trusted in)
`codex exec` does not fail fast — it blocks on a `Not inside a trusted
directory` trust prompt and hangs indefinitely reading stdin. Either `cd` into
the target Git repo first, or pass `--skip-git-repo-check` **and** close stdin
(`< /dev/null` for argv prompts, `- < prompt.txt` for stdin prompts).
Git-dependent flows such as `codex review --uncommitted` also will not work
outside a repo.

## Default Stance

Unless the user asks for something else:

- Prefer `scripts/codex-run.sh` when Claude starts a run that it will monitor,
  especially for long reviews, generated prompt files, implementation candidates,
  or any task where progress visibility matters.
- Use `scripts/codex-run.sh generate` for implementation candidates; it defaults
  to `workspace-write`, `high` reasoning, and the bundled candidate-report
  schema while capturing workspace diff artifacts.
- Use `codex exec` for one-shot work.
- Use `scripts/codex-run.sh review` for monitored code reviews; use
  `codex review` for short raw CLI review requests.
- Use direct `codex exec ... - < prompt.txt > result.md 2> stderr.log` when
  the caller needs the text back in the same turn more than background
  monitoring artifacts.
- Use a prior wrapper run's generated `continue.sh` for follow-up reviews or
  critiques in the same Codex session; use `codex exec resume --last` only when
  no wrapper run directory is available.
- Do not pass `--model` by default; let the user's Codex configuration choose the model.
- Pass `--model <MODEL>` only when the user explicitly requests a specific model.
- Use `medium` reasoning for ordinary work, `high` for harder tasks, and `low` for tiny checks.
- Use `--sandbox read-only` for `codex exec` analysis runs, and use the wrapper or `codex review` for review tasks.
- Expand to `workspace-write` only when Codex should edit files; use bypass flags only in externally sandboxed automation.
- Use `--json` or a custom `--output-schema` only when another tool will parse the result.

Do not hide stderr by default. Do not add `--skip-git-repo-check` inside a
normal Git repo; but when you intentionally run outside a Git repo (or in a
directory Codex has not been trusted in), you **must** add it and close stdin —
otherwise `codex exec` hangs on a trust prompt instead of failing fast.

Keep shell usage scoped to the documented `codex`, read-only `git`, and wrapper
commands below. Do not use this skill as general-purpose shell access.

For the current flag surface and example command matrix, see
`./references/codex-cli.md`.

Preflight is complete when the Codex CLI surface, repository state, and stdin
trust behavior are known, and any blocker is reported before launching the real
task.

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
[codex-exec] event=paths run_dir=... run_dir_file=... status=... run_env=... monitor=... continue=... stdout=... stderr=... final=...
[codex-exec] event=spawn pid=...
[codex-exec] event=progress elapsed=...
[codex-exec] event=finish exit_code=... session_id=... final_source=... continue=...
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
- `final.md`: the `--output-last-message` capture, or the successful-run
  fallback recorded in `status.env`'s `final_source`.
- `workspace-baseline.txt`, `changed-files.txt`, `workspace.diff`,
  `workspace-diff.stat`,
  `workspace-status.txt`: written after `generate` runs in git workspaces.
- `command.txt`: shell-quoted command without prompt text.
- `prompt.txt`: the full prompt sent through stdin (in `review`/`generate` mode
  this includes the wrapper's scaffolding around your brief).
- `user-prompt.txt`: your raw brief before wrapping, written in `review`/`generate`
  mode when a custom prompt was supplied. Compare against `prompt.txt` to see
  exactly what scaffolding the wrapper added.
- `preflight.log`: Codex version and workspace git status.

Example implementation candidate with diff capture:

```bash
run_dir_file="$(mktemp -t codex-exec-run-dir.XXXXXX)"
skill_dir="/path/to/codex-exec/skills/codex-exec"
"$skill_dir/scripts/codex-run.sh" generate \
  --workspace "$PWD" \
  --run-dir-file "$run_dir_file" \
  --heartbeat 15 \
  --prompt-file task-brief.txt
```

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
run_dir_file="$(mktemp -t codex-exec-run-dir.XXXXXX)"
scripts/codex-run.sh review \
  --workspace "$PWD" \
  --run-dir-file "$run_dir_file" \
  --heartbeat 15 \
  --uncommitted \
  --prompt "Focus on bugs, regressions, and missing tests. Findings first."
```

`--uncommitted` is already the review-mode default; it is passed explicitly here
and in the examples below so the scope is self-documenting. Omitting it reviews
the same uncommitted changes.

The wrapper does **not** daemonize itself. To monitor a run concurrently you
must launch it in the background with your harness's own mechanism: your Bash
tool's background-task flag, or a trailing `&` with output redirected to a log
(`"$skill_dir/scripts/codex-run.sh" generate … > launch.log 2>&1 &`). If you run
it in the foreground it blocks your turn until Codex finishes and there is
nothing to "monitor". Once it is backgrounded, point MonitorTool at the printed
`monitor.sh` path or run `bash "$run_dir/monitor.sh"`. That avoids fragile
sleeps, raw task-output polling, and repeated `tail` loops.

Capture `run_dir` from the printed `event=paths` line or, for background
launches, pass `--run-dir-file "$run_dir_file"` and read that file once it is
non-empty. The wrapper writes it before any slow preflight, so poll instead of
reading blindly — an immediate `cat` can otherwise race the write and leave
`run_dir` empty. Keep the poll **bounded** (do not use an unbounded `until`
loop — if the launch failed, the file never appears and an unbounded loop hangs
the turn):

```bash
for _ in $(seq 1 50); do [[ -s "$run_dir_file" ]] && break; sleep 0.2; done
run_dir="$(cat "$run_dir_file")"
[[ -n "$run_dir" ]] || { echo "run_dir_file still empty; check launch.log" >&2; exit 1; }
bash "$run_dir/monitor.sh"
```

`monitor.sh` blocks until the run is over and its exit code mirrors Codex's, so
once it is backgrounded you do **not** need a second poll loop on `status.env`.
If you must check `status.env` directly, the completion signal is
`state=finished` (or `failed`/`interrupted`) — **not** the mere presence of an
`exit_code=` line, which is written empty (`exit_code=`) while the run is still
in progress. Match on `state=`, not on the `exit_code=` key existing.

Do not pipe the wrapper launch through `tail`, `head`, or a similar truncating
filter; that can hide the early `event=paths` line and push Claude back toward
racy "latest" discovery. Do not rediscover the "latest" run with `ls -t`;
concurrent Codex runs from other workspaces can win that race. If you lost the
path, narrow by workspace:

```bash
grep -l "workspace=$(pwd -P)" \
  "${CODEX_EXEC_RUNS_DIR:-${CODEX_HOME:-$HOME/.codex}/codex-exec-runs}"/*/status.env |
  xargs -n1 dirname |
  tail -20
```

When review mode has custom instructions, the wrapper composes a read-only
`codex exec` review prompt with explicit git inspection commands for the
requested scope. This avoids current Codex CLI parsing behavior where scoped
review flags such as `--uncommitted` can be rejected when combined with a prompt
argument. When review mode has no custom prompt, the wrapper uses the dedicated
`codex exec review` subcommand.
The wrapper always requests `--output-last-message` into `final.md`. If Codex
exits 0 but leaves `final.md` empty, the wrapper backfills it from `stdout.log`;
for review mode only, it can backfill from `stderr.log` because some review
builds stream the verdict there. JSON stdout is not copied into `final.md`; in
that case `final_source=empty-json-stdout` and consumers should read
`events.jsonl`. Check `status.env`'s `final_source` field when you need to know
which path supplied the result.

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

Wrapper runs are complete when `monitor.sh` exits, `status.env` records the
Codex child exit code, and `final.md` or `events.jsonl` contains the usable
result or the failure is summarized from `stderr.log`.

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
Raw `resume` has a different flag surface than initial `exec`. In particular,
`codex exec resume --last --sandbox read-only -` is invalid because `--sandbox`
is an `exec` parent flag, not a `resume` flag. Prefer the wrapper's
`continue.sh`; if you must use raw CLI, either inherit the prior sandbox or put
parent flags before the subcommand, for example:

```bash
printf '%s\n' "Continue the review." | \
  codex exec --sandbox read-only resume --last -
```

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
- `--skip-git-repo-check` is a situational escape hatch, not a default — but it
  is **required** when running outside a Git repo or in a directory Codex has
  not been trusted in. Without it `codex exec` does not error out; it blocks on
  a `Not inside a trusted directory` prompt and hangs reading stdin. Always pair
  it with a closed stdin. Known-good out-of-repo shape:
  `codex exec --sandbox read-only --skip-git-repo-check "<short prompt>" < /dev/null`.
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
  `final.md` in the printed run directory before retrying. On a non-zero exit
  `final.md` is left empty (the fallback only runs on exit 0), so the real error
  lives in `stderr.log`, not `final.md`.
- If `stderr.log` shows `invalid_json_schema` (for example `'required' is
  required to be supplied and to be an array including every key in
  properties. Missing '<field>'`), the `--output-schema` file violates OpenAI
  strict-mode rules: every key in an object's `properties` must also appear in
  that object's `required` array — mark truly-optional fields with a nullable
  type (`"type": ["string", "null"]`) and still list them in `required`. This
  fails fast (~5s) with no edits made; it is **not** a hang, so the "kill after
  ~30s / trust-directory" recovery does not apply. Fix the schema file (the
  bundled `candidate-report.schema.json` is validated in CI) or pass a corrected
  copy via `--output-schema`.
- If the wrapper's shell exit and `status.env` disagree, trust `status.env` for
  the Codex child process result; shell exits like 143/144 usually mean the
  wrapper or monitor process was interrupted during teardown.
- If `final.md` is empty but `status.env` says `exit_code=0`, inspect
  `status.env`'s `final_source`, then `stdout.log` and `stderr.log`. Some
  successful review builds emit their verdict on stderr. If
  `final_source=empty-json-stdout`, use `events.jsonl`; the wrapper deliberately
  left `final.md` empty instead of copying raw JSONL into a Markdown artifact.
- If MonitorTool needs progress, prefer the wrapper because it emits heartbeat
  lines even when Codex has not produced new terminal output.
- If a non-interactive run needs too much context, switch from argv text to stdin with `-`.
- If a run prints `Reading additional input from stdin...`, that message alone is normal when Codex is
  consuming stdin. If it then produces no meaningful progress for more than about 30 seconds, kill it and
  rerun with either `- < prompt.txt` for stdin prompts or `< /dev/null` for short argv prompts.
  A frequent silent cause is launching from a non-Git or untrusted directory (e.g. a scratch or
  tmp dir): Codex is blocking on a `Not inside a trusted directory` trust prompt, not doing work.
  Fix by running from inside the Git repo, or add `--skip-git-repo-check` with stdin closed.
- If a prompt has newlines or is longer than about 500 characters, do not retry argv quoting. Use stdin.
- If the task is review-oriented, use the wrapper for monitored/custom-instruction reviews and raw `codex review` for simple unprompted reviews.
- If the task is "run and read the answer now", use direct `codex exec` with
  stdout redirection instead of the wrapper, for example
  `codex exec --sandbox read-only - < prompt.txt > result.md 2> stderr.log`.
- If a run needs edits, change the sandbox and autonomy deliberately instead of piling on flags by habit.
- MCP auth failures such as Cloudflare `rmcp` auth-token errors are usually
  environment noise unless the task required that MCP server. Note them, but do
  not treat them as the Codex run result.
- On macOS, read-only sandbox runs can print `confstr()`, `xcrun_db`, or
  `xcodebuild` cache-write errors from developer tools. Treat them as benign
  sandbox noise when the run exit code is 0 and the requested analysis completed.
- If output includes warnings or partial results, summarize what Codex completed and what remains uncertain.
