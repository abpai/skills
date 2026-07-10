# Isolated Implementation Candidates

Use this optional workflow only when independent worktrees or competing
implementations materially improve the decision. Ordinary implementation uses
`scripts/codex-run.sh run --write` in the current workspace.

## One isolated candidate

1. Resolve paths from the installed skill directory.
2. Create a dedicated branch and worktree with `scripts/codex-workspace.sh
   prepare`.
3. Run the normal write-capable runner against that worktree.
4. Inspect `status.json`, `final.md`, and `workspace.diff`.
5. Run `scripts/codex-workspace.sh finalize` when a separate review bundle is
   useful.
6. Validate and integrate from the parent process. Do not ask the candidate to
   commit from a sandboxed linked worktree.

```bash
skill_dir="/absolute/path/to/codex-exec/skills/codex-exec"
workspace_root="/absolute/path/to/repo"
candidate_root="/absolute/path/to/candidate-worktree"

"$skill_dir/scripts/codex-workspace.sh" prepare \
  --source "$workspace_root" \
  --workspace "$candidate_root" \
  --branch "candidate/approach-a"

"$skill_dir/scripts/codex-run.sh" run \
  --workspace "$candidate_root" \
  --write \
  --reasoning high \
  --prompt-file /absolute/path/to/task.md
```

Choose `--reasoning high`, a custom output schema, or a shorter hard timeout
explicitly when the task needs them. The deprecated `generate` command is an
exact alias for `run --write`; it no longer carries hidden defaults or prompt
rewrites.

## Competing candidates

- Give each candidate the same task brief, base commit, constraints, and proof
  commands.
- Keep worktrees and run directories separate.
- Do not reveal one candidate's output to another before both finish.
- Compare actual diffs and rerun validation; summaries are not proof.
- Prefer the smaller implementation when behavior and evidence are equivalent.

## Parent report

Record the worktree and branch, run directory, exit state, changed files,
validation outcomes, chosen implementation, and residual risks.
