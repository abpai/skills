---
description: Run final Pi review. Executes the full verification suite, performs holistic evaluation, and presents the scorecard with any remaining repair guidance.
---

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 3: Review**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

Backward compatibility:
- If `.agents/pi/` does not exist but `.agents/plan/` does, continue in `.agents/plan/`.

Prerequisite: the execute phase must have been run. If `state.json` is still in `plan`, tell the user to run `/pi:execute` first.

Primary agent: `evaluator`

Use `codex-reviewer` one final time only when the latest diff has not yet had an independent second-provider read.

Follow the protocol exactly. Present the full scorecard, test results, and any remaining repair guidance to the human.
