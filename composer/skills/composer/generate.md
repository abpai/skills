# Composer Generate

Delegate implementation to Cursor Composer while the parent agent remains the
planner, reviewer, and release coordinator.

## Workflow

1. Confirm there is a concrete implementation brief. If the user gave only a
   vague request, write a short plan first and keep scope narrow.
2. Run the setup check if this session has not already proved Cursor auth:
   `composer/skills/composer/scripts/cursor-agent-doctor.sh`.
3. Create or choose an isolated branch/worktree before handing work to
   Composer. Prefer one coherent task per branch.
4. Write a prompt file that includes the exact task, files/areas in scope,
   validation expectations, commit/PR expectations, and explicit stop rules.
5. Run Composer through the wrapper:

```bash
composer/skills/composer/scripts/composer-run.sh generate \
  --model composer-2.5-fast \
  --prompt-file /path/to/prompt.md \
  --workspace /path/to/worktree
```

Use `--model composer-2.5` for slower/careful execution. Use `--worktree NAME`
and `--worktree-base REF` only when you want Cursor Agent to create its own
worktree under `~/.cursor/worktrees`.

The wrapper uses Cursor's headless CLI, not the TypeScript SDK. Use
`--auth login` only after `cursor-agent-doctor.sh --auth login --smoke` passes;
for unattended automation, prefer `CURSOR_API_KEY`.

6. Inspect Composer's changes yourself in the workspace Composer actually used:
   `git status`, `git diff`, tests, and the repo's existing validation gates.
   If you used `--worktree NAME`, do not inspect only the original checkout;
   Cursor writes under `~/.cursor/worktrees/<repo>/<name>` (or a generated
   sibling when no name was supplied), so run `git -C <cursor-worktree> status`,
   `git -C <cursor-worktree> diff`, and validation there.
7. If Composer left findings or partial work, either repair directly or run a
   focused follow-up Composer prompt in the same branch.
8. Open a draft PR only when the user asked for PR output or the brief calls
   for branch/PR delivery.

## Prompt Contract

Composer implementation prompts should say:

- What to build or fix.
- Why it matters.
- Non-goals and files/areas to avoid.
- Required validation commands.
- Whether to commit, push, or only leave a diff.
- That secrets and `.env` files must not be read aloud, committed, or logged.
- That unrelated cleanup belongs in a follow-up note, not the patch.

## Parent-Agent Responsibilities

- Do not trust Composer's summary without reading the diff.
- Do not merge multiple unrelated Composer branches into one PR.
- Re-run the important checks yourself before opening or merging a PR.
- Keep PR descriptions behavior-led: what changed, why it matters, how it was
  verified.

## Output

Report:

- Branch/worktree used.
- Model used.
- Composer result summary.
- Files changed.
- Validation run and outcomes.
- PR URL when opened.
- Any residual risks or follow-up tasks.
