---
description: Turn a project request into a brief, rubric, and ordered task slices. Interactive planner phase for long-running engineering work.
---

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 1: Plan**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

Backward compatibility:
- If `.agents/pi/` does not exist but `.agents/plan/` does, continue in `.agents/plan/` or migrate it once before writing new files.

Primary agent: `planner`

Use Codex only for high-leverage research or plan critique, not as mandatory fanout for every primitive.

Follow the protocol exactly. Do not skip the human checkpoints.
