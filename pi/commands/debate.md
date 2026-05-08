---
description: Run a structured architecture debate with an independent Codex critique and final ADR.
argument-hint: "[question or decision]"
allowed-tools: >
  Bash(codex *) Bash(git status *) Bash(git log *) Bash(git diff *)
  Bash(git branch *) Bash(git rev-parse *) Read Grep Glob
---

# /pi:debate

Use Pi's debate module for a structured propose -> critique -> synthesize pass.

1. Read `skills/debate/SKILL.md`.
2. Follow its process exactly, including the repo snapshot and Codex critique
   fallback behavior.
3. Treat `$ARGUMENTS` as the architecture question, tradeoff, or technical
   decision to debate.

User input: $ARGUMENTS
