# codex-exec

Run the Codex CLI as a headless implementation, review, or second-opinion
worker with durable artifacts and session continuation.

```bash
# Read-only work
skills/codex-exec/scripts/codex-run.sh run \
  --workspace "$PWD" --prompt-file prompt.md

# Write-capable work with workspace diff capture
skills/codex-exec/scripts/codex-run.sh run \
  --workspace "$PWD" --write --prompt-file task.md

# Review
skills/codex-exec/scripts/codex-run.sh review \
  --workspace "$PWD" --uncommitted \
  --prompt "Find concrete bugs and regressions. Findings first."

# Continue the captured session
<run-dir>/continue.sh --prompt-file follow-up.md
```

Runs write `status.json`, compatibility `status.env`, raw streams, JSONL
events, `final.md`, monitor/continuation helpers, and workspace artifacts for
write-capable runs. The runner kills meaningful-inactivity stalls, retries
read-only work once, and never automatically replays a write-capable prompt.

`generate` remains a compatibility alias for `run --write`. The advanced
worktree helper remains available for explicit independent-candidate workflows.

Requires an installed and authenticated `codex` CLI.
