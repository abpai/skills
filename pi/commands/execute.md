---
description: Execute the approved Pi brief. Runs the generator loop, optional simplification, evaluation, and focused repair passes until the build clears the bar or repair budget is exhausted.
---

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 2: Execute**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

Backward compatibility:
- If `.agents/pi/` does not exist but `.agents/plan/` does, continue in `.agents/plan/`.

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration.

### Phase A — Load and Resume

1. Read `brief.md`, `rubric.json`, `tasks/*.json`, `state.json`,
   `research/consensus-matrix.md` from the active state root.
   If any prerequisite is missing, tell the user to run `/pi:plan` first.
2. Read `task_progress` from `state.json`. Skip any task with status `complete`.
3. Find the first non-complete task. If resuming a failed task, read the prior
   evaluation from `evaluations/`.
4. Update `state.json`: `current_step` = `"build"`, the active task ->
   `"in_progress"` in `task_progress`.

### Phase B — Contract and Build

5. Draft or refresh `contracts/<task-id>.md` for the active task slice.
   Include: scope, files likely to change, concrete verification steps, risks.
6. Spawn `evaluator` (foreground) to pressure-test the contract.
   If "done" is still fuzzy, fix the contract before building.
7. Spawn `generator` (foreground) with:
   - the brief
   - the ordered task slices
   - the active contract
   - the consensus matrix (as architectural constraints)
   - per-task verification arrays (the `verification` array from each task JSON)
   - the current build/repair pass number
   - any prior evaluator feedback (if repair pass)
8. Update `state.json`: `build_pass` incremented.

### Phase C — Review and Evaluate

9. Spawn `codex-reviewer` to review the latest changes. Save to
   `reviews/codex-build-<N>.json`.
   If Codex CLI is unavailable, note it and continue.
10. Spawn `evaluator` (foreground) with:
    - the brief, active contract, rubric
    - the build/repair summary from the generator
    - per-task verification arrays
    - the consensus matrix
    - the codex review output (if available)
    - the current pass number
11. Write evaluation to `evaluations/build-pass-<N>.json`.
12. Update `state.json`: active task -> `"complete"` or `"failed"` in
    `task_progress` based on evaluation.

### Phase D — Repair or Advance

13. If all rubric criteria pass: advance to the next task (back to Phase B) or
    to Phase E if all tasks are complete.
14. If any criterion fails:
    - Increment `repair_pass`
    - Update `state.json`: active task -> `"in_progress"` (repair) in
      `task_progress`
    - Send only failing evidence, contract deltas, and task-scoped repair
      guidance back to Phase B step 7
    - Do NOT reopen the whole plan unless the evaluator proved the brief is wrong
15. Stop repair after `max_repair_passes` (from `rubric.json`). If budget is
    exhausted, present status to the user.

### Phase E — Finalize

16. Update `state.json`: `phase` -> `"review"`, `current_step` -> `"review"`.
17. Present build summary to user: tasks completed, repair passes used, known
    gaps.

Simplify only when it helps — run `code-simplifier` only if the generator
introduced duplication or code got harder to follow than necessary.

This phase runs mostly autonomously. Build coherently first, then repair
narrowly based on evaluator evidence.
