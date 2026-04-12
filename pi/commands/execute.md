---
description: Execute the approved Pi brief. Runs the generator loop, optional simplification, evaluation, and focused repair passes until the build clears the bar or repair budget is exhausted.
argument-hint: "[optional task id or filter]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *)
  Bash(git rev-parse *) Bash(git add *) Bash(git commit *)
  Bash(codex *) Bash(cat .agents/pi/*) Bash(ls .agents/pi/*)
  Read Write Edit Grep Glob
---

## Pi state snapshot

```!
echo "PI_EXECUTE_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -30
test -f .agents/pi/state.json && cat .agents/pi/state.json || echo "no pi state"
test -d .agents/pi/tasks && ls -1 .agents/pi/tasks 2>/dev/null
timeout 3 codex --version 2>&1 || echo "codex: not installed"
```

The block above runs at skill-load time. Use its output to resume from the
current `phase`/`current_step` without re-reading `state.json`, to know which
tasks exist, and to decide the `codex_policy` branch up front.

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
2. Read `task_progress` from `state.json`. Skip any task with status `complete`
   or `blocked`.
3. Find the first non-complete, non-blocked task. If resuming a failed task, read its
   `action_on_resume` field from `task_progress` — it pre-computes the next
   step so the coordinator does not need to chase evaluation files. If
   `action_on_resume` is absent (legacy state), read the prior evaluation from
   `evaluations/`.
   - If there are no tasks, or all remaining tasks are `complete` or `blocked`,
     skip directly to Phase E (finalize). Do not enter the build loop.
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

9. Spawn `codex-reviewer` to review the latest changes. Pass the list of files
   modified in this pass so the review is scoped to the current increment, not
   the entire worktree. Save to `reviews/codex-build-<N>.json`.
   If Codex CLI is not available, check `execution_policy.codex_policy` from
   `rubric.json`. If `required`, halt and warn the user. If `skip`, proceed
   without Codex review. If `optional`, apply `execution_policy.degraded_mode`:
   `warn_and_continue` — note the absence and continue; `block` — halt until
   Codex is available.
10. Spawn `evaluator` (foreground) with:
    - the brief, active contract, rubric
    - the build/repair summary from the generator
    - per-task verification arrays
    - the consensus matrix
    - the codex review output (if available)
    - the current pass number
11. Write evaluation to `evaluations/build-pass-<N>.json`.
12. Update `state.json`: active task -> `"complete"` or `"failed"` in
    `task_progress` based on evaluation. When marking `"failed"`, also write
    `failure_reason` (short summary from evaluator) and `action_on_resume`
    (prescriptive next step for the coordinator on cold resume).

### Phase D — Repair or Advance

13. If all rubric criteria pass: reset `repair_pass` to 0, then advance to the
    next task (back to Phase B) or to Phase E if all tasks are complete.
14. If any criterion fails:
    - Increment `repair_pass`
    - Update `state.json`: active task -> `"in_progress"` (repair) in
      `task_progress`
    - Send only failing evidence, contract deltas, and task-scoped repair
      guidance back to Phase B step 7
    - Do NOT reopen the whole plan unless the evaluator proved the brief is wrong
15. Stop repair after `max_repair_passes` (from `rubric.json`). If budget is
    exhausted:
    - Write `failure_reason` and `action_on_resume` to the task's
      `task_progress` entry.
    - **Propagate dependency failures:** Read `execution_policy.dependency_failure`
      from `rubric.json`. If `block_downstream`: for each task whose `depends_on`
      includes the failed task, set status to `blocked`, write `blocked_by` (the
      failed task ID), `blocked_kind: "failed"`, and `failure_reason`. Then
      propagate transitively — for tasks that depend on newly blocked tasks, set
      `blocked_kind: "blocked"`. If `skip_downstream`: leave dependent tasks as
      `not_started` but skip them in the current run.
    - Present status to the user.

### Phase E — Finalize

16. Update `state.json`: `phase` -> `"review"`, `current_step` -> `"review"`.
17. Present build summary to user: tasks completed, repair passes used, known
    gaps.

Simplify only when it helps — run `code-simplifier` only if the generator
introduced duplication or code got harder to follow than necessary.

This phase runs mostly autonomously. Build coherently first, then repair
narrowly based on evaluator evidence.
