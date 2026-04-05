---
description: Execute the approved Pi brief. Runs the generator loop, optional simplification, evaluation, and focused repair passes until the build clears the bar or repair budget is exhausted.
---

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 2: Execute**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

Backward compatibility:
- If `.agents/pi/` does not exist but `.agents/plan/` does, continue in `.agents/plan/`.

Prerequisites:
- The active state root must contain a completed plan phase with `brief.md`, `tasks/`, and `rubric.json`. If missing, tell the user to run `/pi:plan` first.

Primary agents:
- `generator`
- `evaluator`

Companion tools:
- `code-simplifier` only when cleanup would materially help
- `codex-reviewer` only at high-leverage checkpoints

Before each build or repair pass:
- draft or refresh the active contract under `contracts/`
- let the evaluator tighten the contract until "done" is testable

This phase runs mostly autonomously. Build coherently first, then repair
narrowly based on evaluator evidence.
