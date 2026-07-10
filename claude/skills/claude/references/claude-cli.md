# Claude CLI Reference

Verify flags against `claude --help` after CLI upgrades.

## Headless Commands

```bash
claude -p --output-format text "One-shot prompt"
claude -p --output-format json "Structured result envelope"
claude -p --output-format stream-json --verbose \
  --include-partial-messages --include-hook-events "Streaming prompt"
claude -p --resume <session-id> "Continue"
```

`stream-json` emits system, assistant, stream, hook, rate-limit, and final
`result` objects. The useful final body is `result.result`, not the whole JSON
line. `--include-partial-messages` supplies fine-grained liveness while Claude is
responding.

## Session Files

Parent transcripts live under:

```text
~/.claude/projects/<encoded-workspace>/<session-id>.jsonl
```

Named-subagent transcripts live under:

```text
~/.claude/projects/<encoded-workspace>/<session-id>/subagents/*.jsonl
```

A child assistant event with `message.stop_reason = "end_turn"` and text content
is a completed child report. The parent may not yet have consumed it; compare
child and parent transcript activity instead of declaring the whole turn done.

## Permissions

- `auto`: classifier-backed unattended execution; default for delegated work.
- `plan`: planning-oriented restrictions; useful for simple one-shot analysis.
- `acceptEdits`: auto-accept direct edits, still subject to other permission
  behavior.
- `bypassPermissions`: only inside an external sandbox or VM.

Tool controls:

- `--disallowed-tools`: remove specific tools.
- `--allowed-tools`: preapprove a bounded subset.
- `--tools`: replace the built-in tool set entirely.

Direct-edit denial is not an OS sandbox: a shell command may still mutate files.
Always inspect the workspace after a review.

## Model And Effort

Omit `--model` to use the configured default. Current aliases and availability
can change; inspect local help and account access instead of hardcoding a model.

Effort choices currently include `low`, `medium`, `high`, `xhigh`, and `max`.
Use higher effort deliberately rather than as wrapper ceremony.

## Native Background Agents

```bash
claude --bg --permission-mode auto "Bounded task"
claude agents --json --all
```

The background registry reports session id, cwd, name, state, and status. Use it
for explicit detached ownership, not as the default monitored runner.

## Worktrees

Claude can own an isolated worktree with `--worktree`. This is separate from the
headless runner and should be explicit:

```bash
claude -p --worktree feature-auth --permission-mode auto "Implement the task"
```

The parent still validates and integrates the result.

## Settings

Prefer temporary CLI flags over config mutation:

- `--settings <file-or-json>`
- `--setting-sources <sources>`
- `--add-dir <dir>`
- `--mcp-config <config>`
- `--agent <name>` or `--agents <json>`

Useful diagnostics:

```bash
claude --version
claude auth status --text
claude doctor
claude agents --json --all
```

## Runner Controls

`claude-run.sh` accepts flags for the common controls and environment variables
for supervisor defaults:

- `CLAUDE_RUNS_DIR`: artifact root.
- `CLAUDE_HEARTBEAT_SECONDS`: progress cadence, default 15.
- `CLAUDE_STALL_TIMEOUT_SECONDS`: meaningful-inactivity limit, default 300.
- `CLAUDE_REPORT_TIMEOUT_SECONDS`: unconsumed-child-report limit, default 90.
- `CLAUDE_TIMEOUT_SECONDS`: hard process deadline, default 2700.
- `CLAUDE_MONITOR_POLL_SECONDS`: generated-monitor polling cadence, default 3.
- `CLAUDE_MONITOR_TIMEOUT_SECONDS`: monitor-only deadline, default 3600.
- `CLAUDE_TERM_GRACE_SECONDS`: TERM-to-KILL grace period, default 5.

The runner requires Bash, Python 3, and standard Unix process tools. Terminal
`status.json` states are `finished`, `failed`, `stalled`, `timed-out`,
`interrupted`, and `dry-run`. Exit 124 means inactivity or a hard deadline; 127
means a required executable was unavailable; 130 and 143 represent INT and
TERM. Argument and contract errors exit 2. Other nonzero values come from the
Claude process or an unexpected wrapper failure.
