# codex-exec

Run the Codex CLI from Claude Code for second opinions, code review, and
multi-model consensus.

## Modes

```
/codex-exec
  ├── exec ────── one-shot task (analysis, generation, structured output)
  ├── review ──── code review (uncommitted changes or specific files)
  └── resume ──── continue the most recent saved session
```

## Quick Reference

```bash
# Monitor-friendly one-shot run for Claude/MonitorTool
skills/codex-exec/scripts/codex-run.sh exec --workspace "$PWD" --prompt-file prompt.txt

# Monitor-friendly code review with heartbeats and final.md capture
skills/codex-exec/scripts/codex-run.sh review --workspace "$PWD" --heartbeat 15 \
  --prompt "Focus on bugs and regressions. Findings first."

# In Claude MonitorTool, wait on the run_dir printed by event=paths
run_dir="/path/from/event-paths"
bash "$run_dir/monitor.sh"

# Follow up in the same Codex session with fresh artifacts
"$run_dir/continue.sh" --prompt-file follow-up.txt

# One-shot analysis when you need the text back now
codex exec --sandbox read-only - < prompt.txt > result.md 2> stderr.log

# Code review
codex review --uncommitted

# Resume last session
codex exec resume --last

# Structured output (for tool consumption)
codex exec --sandbox read-only --output-schema schema.json "Review the diff"
```

## Key Defaults

- Model: use the user's configured Codex default; pass `--model` only when explicitly requested
- Sandbox: `read-only` for analysis, `workspace-write` when edits needed
- Reasoning: `medium` (ordinary), `high` (hard tasks), `low` (quick checks)
- Monitoring: prefer `skills/codex-exec/scripts/codex-run.sh` when Claude starts the run and tracks it with MonitorTool
- Run artifacts: wrapper logs live under `${CODEX_EXEC_RUNS_DIR:-${CODEX_HOME:-~/.codex}/codex-exec-runs}` and include `run.env`, `status.env`, `monitor.sh`, `continue.sh`, `stdout.log`, `stderr.log`, `final.md`, `prompt.txt`, and `command.txt`
- Run discovery: capture the printed `event=paths run_dir=...`; avoid `ls -t`
  "latest" lookups because another workspace may have a newer run
- Final capture: `final.md` is populated from `--output-last-message`; when
  Codex exits 0 but leaves it empty, check `status.env`'s `final_source`, then
  `stdout.log` and `stderr.log`
- Same-turn reads: use raw `codex exec ... > result.md 2> stderr.log` when the
  caller needs to consume the answer immediately; use the wrapper for monitored
  long runs and resumable follow-ups

## Troubleshooting Hints

- If the wrapper shell exit and `status.env` disagree, trust `status.env` for the
  Codex child result; 143/144 can come from wrapper or monitor teardown.
- If raw `codex exec resume --last --sandbox read-only -` fails, put parent
  flags before `resume` (`codex exec --sandbox read-only resume --last -`) or
  use the wrapper-generated `continue.sh`.
- Cloudflare `rmcp` token errors and macOS `confstr()`, `xcrun_db`, or
  `xcodebuild` cache-write messages can be benign environment noise under a
  read-only sandbox when the run itself exits 0.

## Prerequisites

- `codex` CLI installed and authenticated
