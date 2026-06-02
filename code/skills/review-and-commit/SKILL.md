---
name: review-and-commit
disable-model-invocation: true
description: Quickly review local changes, run targeted checks, and create an approved commit without the full PR-prep lane.
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
2. Inspect the working tree, staged changes, and untracked files.
3. Review the diff, apply scoped fixes, and run targeted validation.
4. Propose the exact files and commit message.
5. Ask for approval before staging or committing.
6. Do not run the full finish lane or draft PR text unless the user asks for PR readiness.

User input: $ARGUMENTS
