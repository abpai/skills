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
- `plan`: planning-oriented restrictions; useful for simple one-shot analysis.
- `acceptEdits`: auto-accept direct edits, still subject to other permission
  behavior.
- `bypassPermissions`: only inside an external sandbox or VM.

Tool controls:

- `--disallowed-tools`: remove specific tools.
- `--allowed-tools`: preapprove a bounded subset.
- `--tools`: replace the built-in tool set entirely.

The runner rejects semantically empty `--tools` and `--allowed-tools` values.
Use its explicit `--no-tools` flag only for generic non-repository work. Review
mode supplies `Read`, `Glob`, `Grep`, and bounded read-only Bash rules while
denying direct edit tools (`Edit`, `Write`, `NotebookEdit`) and common shell
mutation paths (redirection, `tee`, mutating commands). Repo-grounded review
owns its exact plan/tool policy and rejects caller-supplied allowed-tool,
permission, tool-set, and passthrough-argument overrides.

Direct-edit denial is not an OS sandbox: a shell command may still mutate files.
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
- `sharing-approval.json`, a sanitized `review-workspace/`, and
  `evidence-access.json` for repo-grounded reviews.
- `run.env`, `monitor.sh`, and `continue.sh`.
- `child-reports/` plus parent/child transcript telemetry.
- Workspace baseline, status, changed-file, and diff artifacts for runs that are
  not marked read-only.

## Repo-Grounded Review

Blocked-transfer example:

```bash
scripts/claude-run.sh review \
  --workspace "$PWD" \
  --prompt-file /absolute/path/to/task.md \
  --evidence-class repo-grounded-review \
  --review-scope-file /absolute/path/to/approved-paths.txt \
  --sharing-approval-file /absolute/path/to/sharing-approval.json \
  --external-transfer-status blocked
```

The approval JSON contains only:

```json
{
  "destination": "Claude Code/Anthropic",
  "approved_scope": ["src/component"],
  "purpose": "Review the candidate change",
  "exclusions": [".env", "ignored files", "credentials", "unrelated paths"],
  "current_user_approved": true
}
```

The runner builds the review workspace from only matching regular tracked
files, the scoped candidate diff, a scope manifest, and redacted approval
metadata. It excludes ignored files, `.env` variants, key/credential files,
symlinks, known secret patterns, unapproved paths, and other repositories.

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

Repo-grounded runner controls:

- `--evidence-class repo-grounded-review` requires both an approved scope file
  and structured sharing-approval JSON.
- `--review-scope-file PATH` builds a tracked-file-only review workspace.
- `--sharing-approval-file PATH` carries redacted destination, scope, purpose,
  exclusions, and current-user approval.
- `--external-transfer-status allowed` is required for a repo-grounded launch;
  the default `not-checked` state blocks before authentication or launch.
- `--external-transfer-status blocked` writes terminal blocker
  `external_transfer_blocked` without probing or launching Claude.
- `--transfer-attempt` accepts only `1` or `2`; the runner never retries by
  itself.

The runner requires Bash, Python 3 with PTY support, and standard Unix process tools. Terminal
`status.json` states are `finished`, `failed`, `blocked`, `stalled`, `timed-out`,
`interrupted`, and `dry-run`. Exit 124 means inactivity or a hard deadline; 127
means the Claude executable was unavailable. When preflight fails, 69 means the
credential store was unavailable, 70 means classification was indeterminate,
and 78 means the authoritative PTY probe reported logged out. Exit 130 and 143
represent INT and TERM. Argument and contract errors exit 2. After a successful
preflight, other nonzero values come from the Claude process or an unexpected
wrapper failure.
