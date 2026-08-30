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

## Preflight

Before spawning Claude, the runner resolves one executable and runs
`claude auth status --text` through a controlling PTY in the same inherited
environment and workspace as the real invocation. The probe has an eight-second
default deadline (`CLAUDE_PREFLIGHT_TIMEOUT_SECONDS`) and writes only
normalized `preflight.json` and `preflight.log` fields; raw account,
organization, token, and credential output is never persisted.

Non-`credential_store_unavailable` failure statuses:

- `not_logged_in`: the authoritative PTY probe explicitly reported logged out;
  ask the user to authenticate.
- `timed_out`: preflight exceeded its deadline and terminated its process
  group.
- `cli_missing`: the resolved Claude executable does not exist.
- `indeterminate`: preflight failed without a safe classification.

## Permissions

- `auto`: classifier-backed unattended execution; default for delegated work.
- `manual` (config value `default`): prompts on first use of each tool. It is
  the built-in starting mode for `-p`, so headless work must pass an explicit
  mode or it stalls on a prompt the runner cannot answer.
- `plan`: planning-oriented restrictions. It can hide Bash and may try to write
  a plan file, so do not use it for a repository review that requires Git
  evidence.
- `dontAsk`: only preapproved tools and recognized read-only commands run;
  unmatched tool calls are denied instead of prompting. Pair it with explicit
  tool controls for locked-down headless review.
- `acceptEdits`: auto-accept direct edits, still subject to other permission
  behavior.
- `bypassPermissions`: only inside an external sandbox or VM.

Tool controls:

- `--disallowed-tools`: remove specific tools.
- `--allowed-tools`: preapprove a bounded subset; it does not remove other
  tools by itself.
- `--tools`: replace the built-in tool set. Configured MCP tools are separate
  and can remain available.
- `--restricted` (Claude Code 2.1.248+): loads only managed settings and
  `--settings`, so the workspace's own user, project, and local settings —
  including its hooks and `permissions.allow` rules — are ignored. It also
  confines the built-in file tools to the working directories and refuses
  `bypassPermissions`. It removes the command- and code-running tools plus
  WebFetch unless `--tools` names them individually; the `default` preset does
  not count.

A `-p` session shows no workspace trust dialog and, by default, still runs the
workspace's hooks and `.mcp.json` servers. In `dontAsk` a repository's own
`permissions.allow` rules are what grant tools, so a review of code you do not
control needs `--restricted` to keep that repository from widening its own
surface.

The runner rejects semantically empty `--tools` and `--allowed-tools` values.
Use its explicit `--no-tools` flag when no tools are needed. Review mode runs in
the requested workspace without a runner-owned tool policy. For an exact
review surface, combine `--permission-mode dontAsk`, `--read-only`, explicit
`--tools` and `--allowed-tools`, then pass
`--restricted --strict-mcp-config --no-chrome` after the runner's `--`
separator. That recipe supports inspection, not network ref refresh or
arbitrary test execution; the parent owns those gates unless it deliberately
expands the allowed commands.

Always inspect the workspace after a review.

## Model And Effort

Omit `--model` to use the configured default. Current aliases and availability
can change; inspect local help and account access instead of hardcoding a model.

Effort choices currently include `low`, `medium`, `high`, `xhigh`, and `max`.
Use higher effort deliberately rather than as wrapper ceremony.

The runner records requested routing and, when a stream event exposes it, the
actual resolved model in `run.env` and `status.json`.

## Liveness

Inactivity and deadline timeouts terminate the Claude process group, escalating
from TERM to KILL after `CLAUDE_TERM_GRACE_SECONDS` (default 5s).

## Artifacts

Every run writes:

- `status.json` and compatibility `status.env`.
- `events.jsonl`, `stdout.log`, and `stderr.log`.
- `final.md`, `prompt.txt`, `command.txt`, and `preflight.log`.
- Normalized `preflight.json` plus requested and resolved routing in
  `status.json` and `run.env`.
- `run.env`, `extra-args`, `monitor.sh`, and `continue.sh`. Together they carry
  the permission mode, tool allowances, and passthrough flags into a resume.
- `child-reports/` plus parent/child transcript telemetry.
- Workspace baseline, status, changed-file, and diff artifacts for runs that are
  not marked read-only.

`status.json` reports runner and process state. `finished` with exit zero does
not prove that Claude gathered the requested evidence or completed the task;
inspect `final.md` for proof gaps.

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

These commands are for a developer's interactive terminal. A parent agent must
not chain them as a preflight before `claude-run.sh`; the runner owns the
bounded PTY authentication check and its machine-readable classification.
`claude config get model` is not a supported model-discovery command and must
not be used. Omit `--model` for the configured default or pass an explicit
`--model` value when exact routing is required.

## Runner Controls

`claude-run.sh` accepts flags for the common controls and environment variables
for supervisor defaults:

- `CLAUDE_RUNS_DIR`: artifact root.
- `CLAUDE_HEARTBEAT_SECONDS`: progress cadence, default 15.
- `CLAUDE_PREFLIGHT_TIMEOUT_SECONDS`: runner-owned auth deadline, default 8.
- `CLAUDE_STALL_TIMEOUT_SECONDS`: meaningful-inactivity limit, default 300.
- `CLAUDE_REPORT_TIMEOUT_SECONDS`: unconsumed-child-report limit, default 90.
- `CLAUDE_TIMEOUT_SECONDS`: hard process deadline, default 2700.
- `CLAUDE_MONITOR_POLL_SECONDS`: generated-monitor polling cadence, default 3.
- `CLAUDE_MONITOR_TIMEOUT_SECONDS`: monitor-only deadline, default 3600.
- `CLAUDE_TERM_GRACE_SECONDS`: TERM-to-KILL grace period, default 5.

The runner requires Bash, Python 3 with PTY support, and standard Unix process tools. Terminal
`status.json` states are `finished`, `failed`, `stalled`, `timed-out`,
`interrupted`, and `dry-run`. Exit 124 means inactivity or a hard deadline; 127
means the Claude executable was unavailable. When preflight fails, 69 means the
credential store was unavailable, 70 means classification was indeterminate,
and 78 means the authoritative PTY probe reported logged out. Exit 130 and 143
represent INT and TERM. Argument and contract errors exit 2. After a successful
preflight, other nonzero values come from the Claude process or an unexpected
wrapper failure.
