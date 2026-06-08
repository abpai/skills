---
name: review
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Run strict read-only Cursor Composer review on a diff or PR.
argument-hint: "[diff scope, PR URL/number, or model hint]"
allowed-tools: >
  Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh *)
  Bash(composer/skills/composer/scripts/composer-run.sh *)
  Bash(cursor-agent *) Bash(git status *) Bash(git diff *)
  Bash(git fetch *) Bash(git log *) Bash(git branch *)
  Bash(git worktree *) Bash(git add *) Bash(git commit *)
  Bash(git push *) Bash(gh pr view *) Bash(gh pr diff *)
  Bash(gh pr edit *) Bash(gh pr checks *) Bash(gh pr merge *)
  Bash(mktemp *) Bash(rm *) Bash(mkdir *)
  Read Write Edit Grep Glob
---

# /composer:review

Use the `review` module.

1. Read the review module: `../composer/review.md` when installed as this
   command wrapper, or `composer/skills/composer/review.md` in the repo.
2. Resolve the review target and prepare a strict read-only review prompt.
3. Run Composer review, verify findings, and return a findings-first verdict.
4. If the user also asked to improve, update, or merge, do those steps yourself
   after review; refresh against the current base and verify mergeability first.

User input: $ARGUMENTS
