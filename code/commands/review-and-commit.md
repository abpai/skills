---
description: Review working-tree changes, perform targeted QA, fix worthwhile issues, and prepare safe atomic commits.
argument-hint: "[scope or message hint]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *)
  Bash(git add *) Bash(git commit *) Bash(git branch *)
  Bash(git rev-parse *)
---

# /code:review-and-commit

Use the `review-and-commit` module.

1. Read `skills/code/review-and-commit.md`.
2. Review the current working-tree changes for correctness, security, architecture, tests, manual QA coverage, and maintainability.
3. Apply safe fixes, run relevant automated checks and targeted QA, then propose atomic commit boundaries.
4. Ask for approval before staging or committing.

User input: $ARGUMENTS
