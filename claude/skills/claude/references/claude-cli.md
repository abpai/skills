# Claude CLI Reference

Use this file only when the main `claude` workflow is not enough.

Verify every flag here against the local `claude --help` or `claude -p --help`
before first use in a new environment.

## Tmux Wrapper Details

The main skill uses `scripts/claude-tmux-run.sh` instead of `claude -p` for
default delegation. The wrapper creates or reuses a normal tmux session running
interactive Claude Code, so the user can attach and take over:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --tmux-session claude-review \
  --permission-mode plan \
  --prompt "Review the current diff"
```

Useful follow-up commands:

```bash
<run-dir>/continue.sh --prompt "Follow up in the same Claude session"
scripts/claude-tmux-run.sh run --continue-run <run-dir> --prompt "Follow up in the same Claude session"
scripts/claude-tmux-run.sh attach --run-dir <run-dir>
scripts/claude-tmux-run.sh monitor --run-dir <run-dir>
scripts/claude-tmux-run.sh stop --run-dir <run-dir>
scripts/claude-tmux-run.sh list
```

Use the generated `continue.sh` for the common Codex-to-Claude back-and-forth
loop. It reuses the prior tmux session, Claude session id, and workspace, but
creates a new run directory for the new prompt so earlier artifacts stay intact.

The monitor reads Claude's transcript JSONL under `~/.claude/projects`, not the
ANSI terminal screen. `pane.txt` is only a diagnostic snapshot for permission
prompts, trust dialogs, or other TUI states that require manual takeover.

The wrapper adds a small run marker to the prompt so it can find the matching
turn in the transcript. Do not use it when the exact user-visible prompt bytes
must be preserved; use an interactive attach or `claude -p` instead.

## Built-In Claude Tmux

Claude's own `--tmux` flag is tied to `--worktree`:

```bash
claude --worktree feature-auth --tmux
```

Use that when Claude should create and own an isolated worktree. Prefer the
bundled wrapper when Codex needs to drive the current checkout and keep
MonitorTool-friendly artifacts.

## Tool Controls

Claude exposes three tool controls:

- `--disallowedTools`: remove a few tools
- `--allowedTools`: auto-approve a safe subset
- `--tools`: replace the available built-in tool set entirely

Prefer them in that order. `--tools` is the sharpest knob and should not be the
default for ordinary harness runs.

```bash
claude -p \
  --disallowedTools "Edit" \
  --permission-mode plan \
  --no-session-persistence \
  "Review this repo for risky shell scripts"
```

## System Prompt Control

Prefer `--append-system-prompt` when you want to add constraints without
replacing Claude's default behavior.

Use `--system-prompt` only when you intentionally want a full replacement.

## Streaming

Use `--output-format stream-json` only for real streaming integrations.

- `stream-json` is an event stream, not a single final blob
- `--include-partial-messages` only works with `stream-json`
- `--verbose` is optional, not required

For most harness work, prefer plain `text` or `json`.

## Settings And Scope

Prefer CLI flags over mutating config files when this harness needs temporary
overrides.

Useful flags:

- `--settings <file-or-json>`
- `--setting-sources <sources>`
- `--add-dir <dir>`

Useful non-interactive commands:

```bash
claude --version
claude auth status --text
claude agents
claude doctor
```

## Worktree Mode

Use worktree mode only when the user wants isolation from the current checkout.

```bash
claude -p -w feature-auth \
  --model sonnet \
  --effort high \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "Investigate and fix the auth regression"
```

## JSON Notes

`--output-format json` returns a result envelope that can include fields such as:

- `type`
- `subtype`
- `result`
- `session_id`
- `num_turns`
- `usage`
- `total_cost_usd`
- `errors`

Do not assume a valid task result lives at the top level. The useful model body
is usually in `result`.
