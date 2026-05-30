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

## Monitor-Friendly Wrapper

`scripts/codex-run.sh` is the preferred launch path when Claude starts a Codex
run and then monitors it. It wraps `codex exec`, `codex exec review`, and
`codex exec resume` with:

- stdin prompt transport through `prompt.txt`
- `--output-last-message` capture in `final.md`
- stable `[codex-exec] event=...` lifecycle and heartbeat lines
- `status.env`, `monitor.sh`, `stdout.log`, `stderr.log`, `events.jsonl`,
  `command.txt`, and `preflight.log` in a printed run directory

When Claude starts the wrapper in the background, the follow-up MonitorTool
command can be `bash "$run_dir/monitor.sh"`. The generated monitor emits
periodic wait lines and exits with the Codex run's exit code.

Use raw `codex` commands for very short manual checks or for CLI options that
the wrapper does not expose. Extra Codex arguments can be passed after `--`.
For scoped reviews with custom instructions, the wrapper composes a read-only
`codex exec` review prompt with explicit git inspection commands instead of
passing `review --uncommitted -`, because current Codex CLI builds can reject
scoped review flags together with a prompt argument.

## Notes

- Prefer `scripts/codex-run.sh review` for monitored reviews. In raw CLI mode,
  prefer `codex review` over a hand-written review prompt when the task is code review.
- Prefer stdin with `-` when the prompt is large, multi-line, generated, or quoting-sensitive.
- Use argv prompts only for short simple text, and add `< /dev/null` so inherited stdin cannot be appended accidentally.
- If both an argv prompt and piped stdin are provided to `codex exec`, Codex appends stdin as a
  `<stdin>` block after the prompt.
- Keep `--skip-git-repo-check` rare; it is for intentional out-of-repo runs.
- Do not suppress stderr by default unless a specific automation path requires it.
