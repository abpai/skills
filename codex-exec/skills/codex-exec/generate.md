# Codex Generate

Delegate implementation to the Codex CLI while the parent agent remains the
orchestrator, comparator, validator, and release coordinator. Use this path when
Codex is one independent candidate in a dual-candidate loop.

## Runtime contract

1. Parent prepares an isolated workspace and one concrete task brief.
2. Parent runs `scripts/codex-run.sh generate`.
3. Wrapper applies implementation defaults and captures candidate artifacts.
4. Parent inspects the artifacts and reruns validation.
5. Parent synthesizes the final implementation; Codex never owns integration.

## Workflow

1. Confirm there is a concrete implementation brief. If the user gave only a
   vague request, write a short plan first and keep scope narrow.
2. Run the skill preflight block from `SKILL.md` against the target workspace.
   Stop on `codex: not installed`, `codex exec: unavailable`, or trust-directory
   blockers.
3. Create or choose an isolated branch or worktree before handing work to Codex.
   Prefer one coherent task per candidate workspace. A worktree keeps the
   candidate fully separate from your checkout, e.g.:

   ```bash
   git worktree add -b candidate-a ../myproj-candidate-a HEAD
   ```

   Do the `generate` run with `--workspace` pointed at that worktree. Codex is
   told not to commit, so the result lands as an uncommitted diff there for you
   to inspect.
4. Write a prompt file that includes the exact task, files/areas in scope,
   validation expectations, and explicit stop rules. Say that Codex must not ask
   clarifying questions; make reasonable assumptions, state them in the final
   report, apply changes, and report what changed. If validation commands are
   named, Codex should run them; otherwise it should run the smallest obvious
   focused check when practical or report `not_run`.
5. Launch Codex through the wrapper in `generate` mode:

```bash
run_dir_file="$(mktemp -t codex-exec-run-dir.XXXXXX)"
skill_dir="/path/to/codex-exec/skills/codex-exec"

"$skill_dir/scripts/codex-run.sh" generate \
  --workspace /path/to/candidate-worktree \
  --run-dir-file "$run_dir_file" \
  --heartbeat 15 \
  --prompt-file /path/to/task-brief.txt
```

`generate` defaults to `--sandbox workspace-write`, `--reasoning high`, and the
bundled `candidate-report.schema.json`. Override only when the brief calls for a
narrower sandbox, lighter reasoning, or a different parse contract.

6. Monitor with the printed `monitor.sh` or poll `--run-dir-file` until the run
   finishes. Do not trust Codex prose without reading artifacts.
7. Inspect candidate output in the workspace Codex actually used:
   - `$run_dir/workspace-baseline.txt`
   - `$run_dir/changed-files.txt`
   - `$run_dir/workspace.diff` and `$run_dir/workspace-diff.stat`
   - `$run_dir/workspace-status.txt`
   - `$run_dir/final.md` (structured JSON by default; empty if Codex exited
     non-zero — read `$run_dir/stderr.log` for the error in that case)
   - `$run_dir/user-prompt.txt` vs `$run_dir/prompt.txt` if you need to confirm
     exactly what brief and scaffolding Codex received
8. Re-run validation yourself in that workspace before presenting the candidate
   to the parent synthesis step. Codex-reported test outcomes are hints, not proof.
9. Leave commit, push, and PR creation to the parent orchestrator unless the
   brief explicitly delegates that to Codex.

## Independence rule

- Give both candidates the same task brief.
- Use separate workspaces (branch or worktree) per candidate.
- Give each candidate its own scratch directory for brief and schema-override
  files, not just its own git worktree — a shared scratch dir lets parallel
  candidates collide on or reuse each other's files.
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

## Parent responsibilities

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
