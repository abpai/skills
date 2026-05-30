---
description: Verify Cursor Composer and OpenAI Codex CLI auth for planner/executor workflows.
argument-hint: "[--smoke or env-file hint]"
allowed-tools: >
  Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh)
  Bash(composer/skills/composer/scripts/cursor-agent-doctor.sh *)
  Bash(cursor-agent *) Bash(codex *) Bash(git status *)
  Read
---

# /composer:setup

Use the `setup` module.

1. Read `skills/composer/setup.md`.
2. Run the setup doctor, using `CURSOR_ENV_FILE` when the key lives outside the current worktree.
3. Report Cursor, Composer model, and Codex readiness without printing secrets.

User input: $ARGUMENTS
