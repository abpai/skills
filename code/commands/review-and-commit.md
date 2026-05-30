---
description: Review working-tree changes, perform targeted QA, fix worthwhile issues, and prepare safe atomic commits.
argument-hint: "[scope or message hint]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *)
  Bash(git add *) Bash(git commit *) Bash(git branch *)
  Bash(git rev-parse *) Bash(git restore --staged *)
  Bash(codex *) Bash(curl *) Bash(npm *) Bash(yarn *)
  Bash(pnpm *) Bash(bun *) Bash(npx *) Bash(pytest *)
  Bash(go test *) Bash(cargo test *)
  mcp__chrome-devtools__* mcp__playwright__* mcp__browser__*
  Read Write Edit Grep Glob
---

# /code:review-and-commit

Use the `review-and-commit` module.

1. Read `skills/code/review-and-commit.md`.
2. Review the current working-tree changes for correctness, security, architecture, tests, manual QA coverage, and maintainability.
3. Apply safe fixes, run relevant automated checks and targeted QA, then propose atomic commit boundaries.
4. Ask for approval before staging or committing.

User input: $ARGUMENTS
