---
name: setup
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
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

1. Read the setup module: `../composer/setup.md` when installed as this command
   wrapper, or `composer/skills/composer/setup.md` in the repo.
2. Run the setup doctor, using `CURSOR_ENV_FILE` when the key lives outside the current worktree.
3. Report Cursor, Composer model, and Codex readiness without printing secrets.

User input: $ARGUMENTS
