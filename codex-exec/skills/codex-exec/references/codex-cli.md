# Codex CLI Reference

Use this file when you need the current command surface or a reminder of which
flags belong to which non-interactive path.

## Main Commands

- `codex exec`: run Codex non-interactively
- `codex review`: run a non-interactive code review
- `codex exec resume --last`: continue the latest saved session non-interactively

## Sandbox Defaults

| Use case | Recommended path |
| --- | --- |
| Read-only analysis with `codex exec` | `--sandbox read-only` |
| Code review | `codex review` |
| Local file edits with `codex exec` | `--sandbox workspace-write` |
| Broad local/network access with `codex exec` | `--sandbox danger-full-access` only when truly needed |

## Useful Flags

- `--model <MODEL>`: choose the model
- `-c model_reasoning_effort="medium"`: set reasoning effort
- `--ephemeral`: do not persist the session to disk
- `--json`: stream JSONL events for machine parsing
- `--output-schema <FILE>`: constrain final output to a JSON schema
- `--skip-git-repo-check`: allow running outside a Git repo

For same-turn answers where the caller needs the text immediately, prefer raw
stdout capture over the monitor wrapper:

```bash
codex exec --sandbox read-only - < prompt.txt > result.md 2> stderr.log
```

Use the wrapper when progress visibility, artifacts, and follow-up continuation
matter more than reading the answer directly from the shell command.

## Monitor-Friendly Wrapper

`scripts/codex-run.sh` is the preferred launch path when Claude starts a Codex
run and then monitors it. It wraps `codex exec`, `codex exec review`, and
`codex exec resume` with:

- stdin prompt transport through `prompt.txt`
- `--output-last-message` capture in `final.md`
- captured session id in `run.env` / `status.env`
- `continue.sh` for follow-ups against the same Codex session
- stable `[codex-exec] event=...` lifecycle and heartbeat lines
- optional `--run-dir-file PATH` for exact background-run handoff
- `status.env`, `monitor.sh`, `stdout.log`, `stderr.log`, `events.jsonl`,
  `command.txt`, `prompt.txt`, `run.env`, `continue.sh`, and `preflight.log` in
  a printed run directory

When Claude starts the wrapper in the background, the follow-up MonitorTool
command can be `bash "$run_dir/monitor.sh"`. The generated monitor emits
periodic wait lines and exits with the Codex run's exit code.
Capture `run_dir` from the printed `event=paths` line. For background launches,
prefer `--run-dir-file "$run_dir_file"` and read that file once the launcher has
started:

```bash
run_dir="$(cat "$run_dir_file")"
bash "$run_dir/monitor.sh"
```

Do not pipe the wrapper launch through `tail` or `head`; that can hide
`event=paths` and lead to racy "latest" lookups. Avoid rediscovering "latest"
with `ls -t`; concurrent runs from other workspaces can be newer. If the path
was lost, narrow by workspace:

```bash
grep -l "workspace=$(pwd -P)" \
  "${CODEX_EXEC_RUNS_DIR:-${CODEX_HOME:-$HOME/.codex}/codex-exec-runs}"/*/status.env |
  xargs -n1 dirname |
  tail -20
```

The wrapper requests `--output-last-message` into `final.md`. If a successful
run leaves that file empty, it backfills from `stdout.log`; review mode can also
backfill from `stderr.log` because some Codex review builds stream the verdict
there, filtering out the benign environmental noise listed below (the
`session id:` marker, `rmcp` auth errors, and macOS sandbox messages) so the
captured verdict stays clean. JSON stdout is not copied into `final.md`; when
`final_source=empty-json-stdout`, read `events.jsonl` instead. Inspect
`status.env`'s `final_source` field to see which artifact supplied `final.md`.

For follow-up review, prefer:

```bash
<run-dir>/continue.sh --prompt-file follow-up.txt
```

The helper uses the captured session id when available and writes a new run
directory for each follow-up, so MonitorTool can watch the continuation without
losing the prior artifacts.
If no session id can be recovered, it fails instead of guessing with `--last`.
Runs launched with `--ephemeral` are intentionally disposable and should not be
continued.
For raw resume commands, remember that `resume` has a different flag surface
than initial `exec`. `codex exec resume --last --sandbox read-only -` is invalid
because `--sandbox` is an `exec` parent flag. Either inherit the prior sandbox or
place parent flags before the subcommand:

```bash
printf '%s\n' "Continue the review." | \
  codex exec --sandbox read-only resume --last -
```

Use raw `codex` commands for very short manual checks or for CLI options that
the wrapper does not expose. Extra Codex arguments can be passed after `--`.
For scoped reviews with custom instructions, the wrapper composes a read-only
`codex exec` review prompt with explicit git inspection commands instead of
passing `review --uncommitted -`, because current Codex CLI builds can reject
scoped review flags together with a prompt argument.

## Notes

- Prefer `scripts/codex-run.sh review` for monitored reviews. In raw CLI mode,
  prefer `codex review` over a hand-written review prompt when the task is code review.
- Prefer a prior wrapper run's `continue.sh` for follow-up reviews. Use
  `codex exec resume --last` only when there is no run directory with a captured
  session id.
- Prefer stdin with `-` when the prompt is large, multi-line, generated, or quoting-sensitive.
- Use argv prompts only for short simple text, and add `< /dev/null` so inherited stdin cannot be appended accidentally.
- If both an argv prompt and piped stdin are provided to `codex exec`, Codex appends stdin as a
  `<stdin>` block after the prompt.
- Keep `--skip-git-repo-check` rare; it is for intentional out-of-repo runs.
- Do not suppress stderr by default unless a specific automation path requires it.
- If a wrapper shell exit and `status.env` disagree, trust `status.env` for the
  Codex child process result; shell exits like 143/144 usually mean wrapper or
  monitor teardown was interrupted.
- MCP auth failures such as Cloudflare `rmcp` token errors, and macOS
  read-only-sandbox messages such as `confstr()`, `xcrun_db`, or `xcodebuild`
  cache-write errors, are environmental noise when the run exit code is 0 and
  the requested analysis completed.
