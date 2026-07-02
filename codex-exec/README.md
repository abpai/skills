# codex-exec

Run the Codex CLI from Claude Code for second opinions, code review,
implementation candidates, and multi-model consensus.

## Modes

```
/codex-exec
  ├── generate ── implementation candidate (workspace-write + diff artifacts)
  ├── exec ────── one-shot task (analysis, generation, structured output)
  ├── review ──── code review (uncommitted changes or specific files)
  └── resume ──── continue the most recent saved session
```

## Quick Reference

```bash
# Implementation candidate for dual-candidate orchestration
run_dir_file="$(mktemp -t codex-exec-run-dir.XXXXXX)"
skills/codex-exec/scripts/codex-run.sh generate \
  --workspace "$PWD" \
  --run-dir-file "$run_dir_file" \
  --heartbeat 15 \
  --prompt-file task-brief.txt

# Monitor-friendly one-shot run for Claude/MonitorTool
skills/codex-exec/scripts/codex-run.sh exec --workspace "$PWD" --prompt-file prompt.txt

# Monitor-friendly code review with heartbeats and final.md capture
run_dir_file="$(mktemp -t codex-exec-run-dir.XXXXXX)"
skills/codex-exec/scripts/codex-run.sh review --workspace "$PWD" --heartbeat 15 \
  --run-dir-file "$run_dir_file" \
  --prompt "Focus on bugs and regressions. Findings first."

# In Claude MonitorTool, wait for the wrapper to record the exact run_dir,
# then monitor it. The launcher writes run_dir_file before any slow preflight,
# so poll until it is non-empty rather than reading it blindly.
until [[ -s "$run_dir_file" ]]; do sleep 0.1; done
run_dir="$(cat "$run_dir_file")" # or the run_dir printed by event=paths
[[ -n "$run_dir" ]] || { echo "run_dir_file is empty" >&2; exit 1; }
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
- Sandbox: `read-only` for analysis/review, `workspace-write` for `generate`
- Reasoning: `medium` (ordinary), `high` (generate and hard tasks), `low` (quick checks)
- Generate output schema: defaults to the bundled `candidate-report.schema.json`
- Monitoring: prefer `skills/codex-exec/scripts/codex-run.sh` when Claude starts the run and tracks it with MonitorTool
- Run artifacts: wrapper logs live under `${CODEX_EXEC_RUNS_DIR:-${CODEX_HOME:-~/.codex}/codex-exec-runs}` and include `run.env`, `status.env`, `monitor.sh`, `continue.sh`, `stdout.log`, `stderr.log`, `final.md`, `prompt.txt`, and `command.txt`
- Generate artifacts: also writes `workspace-baseline.txt`, `changed-files.txt`, `workspace.diff`, `workspace-diff.stat`, and `workspace-status.txt`
- Run discovery: capture the printed `event=paths run_dir=...`; avoid `ls -t`
  "latest" lookups because another workspace may have a newer run; for
  background launches, pass `--run-dir-file` and read that file instead of
  scraping truncated output
- Final capture: `final.md` is populated from `--output-last-message`; when
  Codex exits 0 but leaves it empty, check `status.env`'s `final_source`, then
  `stdout.log` and `stderr.log`; `final_source=empty-json-stdout` means raw
  JSONL was left in `events.jsonl` instead of copied into `final.md`
- Same-turn reads: use raw `codex exec ... > result.md 2> stderr.log` when the
  caller needs to consume the answer immediately; use the wrapper for monitored
  long runs and resumable follow-ups

## Dual-candidate orchestration

When Codex is one independent candidate beside another worker (for example Opus):

1. Use the same task brief for both candidates.
2. Give each candidate its own branch or worktree.
3. Do not share either candidate's diff or report until both finish.
4. Launch Codex with `generate`; inspect `$run_dir/workspace.diff`, not only `final.md`.
5. Let the parent orchestrator synthesize, validate, commit, and open PRs.

See `skills/codex-exec/references/implementation-candidate-plan.md` for the
full phased roadmap.

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
