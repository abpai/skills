---
description: Delegate a bounded implementation task to Cursor Composer from a planner-written brief.
argument-hint: "[implementation brief, branch/worktree, model, or PR instruction]"
allowed-tools: >
  Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh *)
  Bash(composer/skills/composer/scripts/composer-run.sh *)
  Bash(cursor-agent *) Bash(git status *) Bash(git diff *)
  Bash(git log *) Bash(git branch *) Bash(git worktree *)
  Bash(git add *) Bash(git commit *) Bash(git push *)
  Bash(gh pr create *) Bash(gh pr view *) Bash(gh pr edit *)
  Bash(gh pr checks *) Bash(mkdir *) Bash(rm *) Bash(mktemp *)
  Read Write Edit Grep Glob
---

# /composer:generate

Use the `generate` module.

1. Read `skills/composer/generate.md`.
2. Turn the planner brief into a bounded Composer prompt.
3. Run Composer in the requested branch/worktree.
4. Inspect the diff, validate it, and open a draft PR when requested.

User input: $ARGUMENTS
