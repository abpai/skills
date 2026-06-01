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

# One-shot analysis (read-only)
codex exec --sandbox read-only "Summarize uncommitted changes"

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

## Prerequisites

- `codex` CLI installed and authenticated
