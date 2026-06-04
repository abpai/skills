---
name: prepare-pr
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Prepare working-tree changes for a PR with finish-lane QA, cleanup, validation, visual status, PR text, and optional commits.
argument-hint: "[scope or message hint]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *)
  Bash(git add *) Bash(git commit *) Bash(git branch *)
  Bash(git push *) Bash(git rev-parse *) Bash(git restore --staged *)
  Bash(codex *) Bash(curl *) Bash(npm *) Bash(yarn *)
  Bash(pnpm *) Bash(bun *) Bash(npx *) Bash(pytest *)
  Bash(go test *) Bash(cargo test *) Bash(gh *)
  mcp__chrome-devtools__* mcp__playwright__* mcp__browser__*
  Read Write Edit Grep Glob
---

# /code:prepare-pr

Use the `prepare-pr` module.

1. Read `skills/code/prepare-pr.md`.
2. Run the finish-lane helper to create QA, cleanup, validation, gate-decision, HTML visual status, and PR-prep artifacts.
3. Review the current working-tree changes for correctness, security, architecture, tests, manual QA coverage, and maintainability.
4. Accept, override, or add quality gates in the gate-decision ledger; load only the selected bundled review-pattern playbooks.
5. Apply safe fixes, run exact targeted QA, and draft or update PR text from evidence.
6. Ask for approval before staging, committing, pushing, or editing a live PR.

User input: $ARGUMENTS
