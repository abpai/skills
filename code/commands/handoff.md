---
description: Create a focused continuation prompt for a fresh coding session.
argument-hint: "[next goal, follow-up task, or empty to continue current work]"
---

# /code:handoff

Use the `handoff` module.

1. Read `skills/code/handoff.md`.
2. Inspect the recent conversation and live repo state needed to make the handoff accurate.
3. Produce a focused continuation prompt with file refs, current state, decisions, next steps, and verification.
4. Do not start implementing the follow-up task unless the user explicitly asks.

User input: $ARGUMENTS
