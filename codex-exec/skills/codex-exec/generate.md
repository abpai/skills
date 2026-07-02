# Codex Generate

Delegate implementation to the Codex CLI while the parent agent remains the
orchestrator, comparator, and release coordinator. Use this path when Codex is
one independent candidate in a dual-candidate loop.

## Workflow

1. Confirm there is a concrete implementation brief. If the user gave only a
   vague request, write a short plan first and keep scope narrow.
2. Run the skill preflight block from `SKILL.md` against the target workspace.
   Stop on `codex: not installed`, `codex exec: unavailable`, or trust-directory
   blockers.
3. Create or choose an isolated branch or worktree before handing work to Codex.
   Prefer one coherent task per candidate workspace. Record the base ref the
   parent will compare against later.
4. Write a prompt file that includes the exact task, files/areas in scope,
   validation expectations, and explicit stop rules. Say that Codex must not ask
   clarifying questions; make reasonable assumptions, state them in the final
   report, apply changes, run relevant checks, and report what changed.
5. Launch Codex through the wrapper in `generate` mode:

```bash
run_dir_file="$(mktemp -t codex-exec-run-dir.XXXXXX)"
schema="$(dirname "$0")/references/candidate-report.schema.json"

scripts/codex-run.sh generate \
  --workspace /path/to/candidate-worktree \
  --run-dir-file "$run_dir_file" \
  --heartbeat 15 \
  --prompt-file /path/to/task-brief.txt \
  --output-schema "$schema"
```

`generate` defaults to `--sandbox workspace-write` and `--reasoning high`.
Override only when the brief calls for a narrower sandbox or lighter reasoning.

6. Monitor with the printed `monitor.sh` or poll `--run-dir-file` until the run
   finishes. Do not trust Codex prose without reading artifacts.
7. Inspect candidate output in the workspace Codex actually used:
   - `$run_dir/changed-files.txt`
   - `$run_dir/workspace.diff` and `$run_dir/workspace-diff.stat`
   - `$run_dir/workspace-status.txt`
   - `$run_dir/final.md` (or structured JSON when `--output-schema` was used)
8. Re-run validation yourself in that workspace before presenting the candidate
   to the parent synthesis step. Codex-reported test outcomes are hints, not proof.
9. Leave commit, push, and PR creation to the parent orchestrator unless the
   brief explicitly delegates that to Codex.

## Dual-candidate independence

When Codex is one of two parallel candidates:

- Give both candidates the same task brief.
- Use separate workspaces (branch or worktree) per candidate.
- Do not show either candidate the other's diff or report until both are complete.
- Let the parent orchestrator compare diffs and synthesize; do not merge
  candidates inside Codex.

## Prompt contract

Implementation prompts should say:

- What to build or fix.
- Why it matters.
- Non-goals and files/areas to avoid.
- Required validation commands.
- Whether to commit or only leave a working diff.
- That secrets and `.env` files must not be read aloud, committed, or logged.
- That unrelated cleanup belongs in a follow-up note, not the patch.
- Do not ask the user for clarification; make reasonable assumptions and proceed.

## Parent-agent responsibilities

- Do not trust Codex summaries without reading `$run_dir/workspace.diff`.
- Do not integrate a candidate branch until synthesis and validation are done.
- Prefer the smaller design when behavior is equivalent.
- Keep PR descriptions behavior-led: what changed, why it matters, how it was
  verified.

## Output

Report to the parent orchestrator:

- Workspace/branch used.
- Wrapper `run_dir` and artifact paths.
- Codex exit code and `final.md` summary.
- Changed files from `changed-files.txt`.
- Validation you re-ran and outcomes.
- Residual risks or follow-up tasks.
