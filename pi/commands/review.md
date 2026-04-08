---
description: Run final Pi review. Executes the full verification suite, performs holistic evaluation, and presents the scorecard with any remaining repair guidance.
---

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 3: Review**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

Backward compatibility:
- If `.agents/pi/` does not exist but `.agents/plan/` does, continue in `.agents/plan/`.

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration.

### Phase A — Load and Verify Prerequisites

1. Read `state.json`. If phase is not `execute` or later (`review`, `done`),
   tell the user to run `/pi:execute` first.
2. Read `brief.md`, `rubric.json`, `tasks/*.json`,
   `research/consensus-matrix.md` from the active state root.
3. Read all evaluations from `evaluations/`.

### Phase B — Full Verification Suite

4. Run the complete local verification suite the project supports.
5. Run per-task verification: iterate each task's `verification` array and
   record results.
6. Write suite results to `evaluations/suite-results.json`.

### Phase C — Final Evaluation with Codex

7. Spawn `codex-reviewer` for a final independent read of the full build.
   Save to `reviews/codex-final.json`.
   If Codex CLI is unavailable, note it in the scorecard.
8. Spawn `evaluator` (foreground) with:
   - the brief, rubric, full build (not just last repair)
   - per-task verification arrays and consensus matrix
   - suite results and codex review output
   - all prior evaluations for context
9. Write final evaluation to `evaluations/review.json`.

### Phase D — Scorecard and Learnings

10. Present the full scorecard:
    - Global rubric scores (functionality, code_quality, product_depth,
      visual_design if applicable)
    - Per-task verification results (task_id, checks passed/failed)
    - Consensus matrix cross-reference: flag any implementation that
      contradicts resolved planning decisions
    - Full-suite test results
    - Known gaps
    - Repair passes used during execute
    - Whether Codex was consulted, and where it changed the outcome
11. If the build still misses the bar:
    - Update `state.json`: `phase` -> `"execute"` (not `"done"`)
    - Present the focused repair plan to the user
    - Do NOT write LEARNINGS.md or mark done — the workflow returns to
      `/pi:execute` for another repair cycle
12. If the build passes:
    - Append durable project-specific learnings to `LEARNINGS.md`
    - Update `state.json`: `phase` -> `"done"`

Follow the protocol exactly. Present the full scorecard, test results, and any
remaining repair guidance to the human.
