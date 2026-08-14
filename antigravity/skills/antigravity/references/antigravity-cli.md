# Antigravity CLI runner reference

This reference tracks the contract used by `scripts/antigravity-run.sh`. Verify
the live CLI and official documentation before changing flags or parsers.

## Supported command shape

```bash
agy --output-format stream-json --print-timeout 45m -p "prompt"
```

Keep the prompt immediately after `-p`. The installed CLI treats `-p` as a
value-taking flag, so inserting another option between `-p` and the prompt can
turn that option into the prompt and prevent later flags from taking effect.

Antigravity exposes no prompt-file or stdin flag in headless mode. The runner
keeps prompt text out of `command.txt`, but the required `-p` argument can be
visible to other local users with process-inspection privileges while the CLI
runs. Do not place raw secrets in delegated prompts.

Supported routing and continuation flags:

- `--model <slug>`: exact model from `agy models`; unknown slugs fail loudly.
- `--effort low|medium|high`: reasoning effort.
- `--agent <name>`: exact agent from `agy agents`.
- `--conversation <id>`: resume an exact conversation.
- `--sandbox`: enable terminal sandbox restrictions.
- `--dangerously-skip-permissions`: approve all tool calls for this run.

The prompt is passed as the final argument after `-p`. Headless mode uses
cached credentials. It exits instead of opening an interactive login when no
terminal is available.

## Stream contract

`stream-json` emits NDJSON:

- `init`: contains `conversation_id`, `cwd`, tools, permission mode, and any
  explicitly requested model or agent.
- `step_update`: contains agent response deltas, tool calls, subagent data, and
  token usage.
- `result`: contains the terminal `status`, `response`, `error`, duration,
  turn count, and usage.

Terminal statuses are `SUCCESS`, `ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID`,
`WAITING`, and `RUNNING`. Only `SUCCESS` is accepted as a finished run.

The runner stores the raw stream in `events.jsonl` and extracts the final
`result.response` into `final.md`. It takes the conversation ID from `init` or
`result`. When `--model` is omitted, the stream does not promise the configured
default model slug; report it as configured default rather than inventing one.

## Permissions

Antigravity reads `~/.gemini/antigravity-cli/settings.json`. Fine-grained rules
use `action(target)` entries under `permissions.allow`, `permissions.ask`, and
`permissions.deny`; precedence is deny, then ask, then allow. Workspace file
reads and writes are auto-allowed by default. Commands, MCP calls, web access,
and non-workspace paths default to Ask and are soft-denied in headless mode when
approval is unavailable.

Because a soft denial can still leave the process exit code at zero, the runner
also requires a terminal `SUCCESS` result and scans diagnostics for permission
denials. The user can configure narrow persistent rules or explicitly authorize
`--allow-all` for a bounded run.

Review mode uses a disposable local clone because the CLI has no run-scoped
read-only switch. The clone includes:

- the checked-out `HEAD` and Git metadata from a local clone;
- tracked working-tree changes from `git diff --binary HEAD`;
- non-ignored untracked files.

Ignored files are deliberately excluded. The source repository is fingerprinted
before and after the review; any source change makes the run fail.

## Artifact contract

- `status.json`, `status.env`: terminal state, health, exit code, conversation,
  routing, workspace, and artifact paths.
- `events.jsonl`, `stdout.log`: the same hard-linked raw NDJSON stream.
- `stderr.log`: CLI diagnostics and permission notices.
- `runner.log`: wrapper lifecycle transitions only.
- `final.md`: terminal successful response, or empty on pre-response failure.
- `prompt.txt`, `command.txt`, `preflight.log`, `run.env`: reproducibility and
  continuation inputs without credential values.
- `monitor.sh`, `continue.sh`: exact attachment and continuation helpers.
- `workspace-baseline.txt`, `workspace-status.txt`, `workspace.diff`,
  `changed-files.txt`: write-capable workspace evidence.
- `source-status-before.txt`, `source-status-after.txt`: review isolation proof.

The monitor has its own finite deadline and fails if the wrapper disappears
without writing a terminal status. Continuation creates a new artifact directory
and never appends to the previous run.

## Official documentation

- Product: https://antigravity.google/product/antigravity-cli
- Headless mode: https://antigravity.google/docs/cli/headless
- Permissions: https://antigravity.google/docs/cli/permissions
- Installation and auth: https://antigravity.google/docs/cli/install
- CLI reference: https://antigravity.google/docs/cli/reference
