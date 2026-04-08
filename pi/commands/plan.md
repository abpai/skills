---
description: Turn a project request into a brief, rubric, and ordered task slices. Interactive planner phase for long-running engineering work.
---

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 1: Plan**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

Backward compatibility:
- If `.agents/pi/` does not exist but `.agents/plan/` does, continue in `.agents/plan/` or migrate it once before writing new files.

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration. Execute these phases in order:

### Phase A — Interactive Planning (foreground planner)

1. Spawn `planner` as a **foreground** subagent with the user's request and
   repo context. The planner runs steps 1-4: posture check, clarify, lateral
   thinking, and distill.
2. The planner interacts with the user directly (foreground mode) and writes
   results to state files: `state.json`, `research/lateral-thinking.md`.
3. When the planner returns, read the primitives from state files.

### Phase B — Parallel Research (coordinator-driven)

4. Update `state.json`: `current_step` = `"research_fanout"`.
5. For each primitive, spawn **both** `claude-researcher` and
   `codex-researcher` in parallel. All researchers run simultaneously.
   - Pass each researcher: the primitive name/description, brief context,
     posture, repo state, and the output file path under `research/fanout/`.
6. When all researchers complete, read all result files from `research/fanout/`.
7. Update `state.json`: `current_step` = `"verify_tech"`.
8. Build a **consensus matrix**: compare Claude vs Codex recommendations per
   primitive. Where they agree, adopt the recommendation. Where they disagree,
   present the disagreement as a tiebreak for the user to resolve.
9. Present the matrix to the user and collect tiebreak decisions.
10. Write `research/consensus-matrix.md`.

### Phase C — Task Proposal (foreground planner)

11. Update `state.json`: `current_step` = `"propose_tasks"`.
12. Spawn a **fresh** `planner` (foreground) with the primitives and resolved
    tech decisions as context. The planner proposes ordered task slices with
    specific test criteria.
13. The planner presents tasks to the user for confirmation.

### Phase D — Iterative Codex Review (coordinator-driven)

14. Update `state.json`: `current_step` = `"codex_review"`.
15. Spawn `codex-reviewer` pass 1: review brief + tasks for gaps, risks, and
    test adequacy. Save to `reviews/codex-plan-pass-1.json`.
    - Incorporate `must_address` items into the plan.
    - Note `nice_to_have` items.
16. If pass 1 found issues: spawn `codex-reviewer` pass 2 on the updated plan.
    Save to `reviews/codex-plan-pass-2.json`.
    - If clean (`changed: false`), skip pass 3.
17. If pass 2 found issues: spawn `codex-reviewer` pass 3. Remaining issues
    become noted risks. Save to `reviews/codex-plan-pass-3.json`.

If the Codex CLI is unavailable, warn the user and skip to Phase E.

### Phase E — Finalize

18. Update `state.json`: `current_step` = `"finalize"`.
19. Present the final plan to the user: brief summary, consensus matrix,
    codex review results, ordered tasks, noted risks.
20. On approval, write: `brief.md`, `rubric.json`, `tasks/*.json`, and
    update `state.json` with `"phase": "execute"`.

Follow the protocol exactly. Do not skip the human checkpoints.
