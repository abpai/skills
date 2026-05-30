---
description: Run strict read-only Cursor Composer review on a diff or PR.
argument-hint: "[diff scope, PR URL/number, or model hint]"
allowed-tools: >
  Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh *)
  Bash(composer/skills/composer/scripts/composer-run.sh *)
  Bash(cursor-agent *) Bash(git status *) Bash(git diff *)
  Bash(git log *) Bash(git branch *) Bash(gh pr view *)
  Bash(gh pr diff *) Bash(mktemp *) Bash(rm *)
  Read Write Grep Glob
---

# /composer:review

Use the `review` module.

1. Read `skills/composer/review.md`.
2. Resolve the review target and prepare a strict read-only review prompt.
3. Run Composer review, verify findings, and return a findings-first verdict.

User input: $ARGUMENTS
