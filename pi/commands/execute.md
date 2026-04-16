---
description: Execute the approved Pi brief. Runs the generator loop, optional simplification, evaluation, and focused repair passes until the build clears the bar or repair budget is exhausted.
argument-hint: "[optional task id or filter]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *)
  Bash(git rev-parse *) Bash(git add *) Bash(git commit *)
  Bash(codex *) Bash(gemini *) Bash(cat .agents/work/*) Bash(cat .agents/work/runs/*/*)
  Bash(cat .agents/work/runs/*/*/*) Bash(cat .agents/work/runs/*/*/*/*)
  Bash(ls .agents/work/*) Bash(ls .agents/work/runs/*)
  Bash(ls .agents/work/runs/*/*) Bash(ls .agents/work/runs/*/*/*)
  Read Write Edit Grep Glob
---

## Pi state snapshot

```!
echo "PI_EXECUTE_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -30
test -f .agents/work/current.json && cat .agents/work/current.json || echo "no active run"
ls -1 .agents/work/runs 2>/dev/null || echo "no runs"
timeout 3 codex --version 2>&1 || echo "codex: not installed"
timeout 3 gemini --version 2>&1 || echo "gemini: not installed"
```

The block above runs at skill-load time. Use its output as a fast sanity
check on run discovery and which `codex_policy` branch to take. Do **not**
skip re-reading the resolved run's `state.json`: preflight is a snapshot and
may be stale (for example, if a prior run stopped mid-handoff). Always read
`state.json` and `checkpoints/` in Phase 0/A before deciding the next step.

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 2: Execute**.

User input: $ARGUMENTS

Active state root: `.agents/work/runs/<slug>/` via `.agents/work/current.json`

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration.

### Phase A — Load and Resume

0. Resolve the active run:
   - Read `.agents/work/current.json` if present and use its slug.
   - If `current.json` is missing and exactly one run exists under
     `.agents/work/runs/`, auto-select it and continue.
   - Otherwise stop and tell the user to run `/pi:plan` to select or create
     a run.
1. Read `brief.md`, `rubric.json`, `tasks/*.json`, `state.json`,
   `research/consensus-matrix.md` from the resolved `state_root`.
   If any prerequisite is missing, tell the user to run `/pi:plan` first.
   On the first state write of this phase, set
   `state.json.orchestrator.last_command_cli = "claude"` with
   `orchestrator.updated_at` = current ISO-8601 time.
2. Read `task_progress` from `state.json`. Skip any task with status `complete`
   or `blocked`.
3. Find the first non-complete, non-blocked task. If resuming a failed task, read its
   `action_on_resume` field from `task_progress` — it pre-computes the next
   step so the coordinator does not need to chase evaluation files. If
   `action_on_resume` is absent, read the prior evaluation from `evaluations/`.
   - If there are no tasks, or all remaining tasks are `complete` or `blocked`,
     skip directly to Phase E (finalize). Do not enter the build loop.
4. **Resume handoff check.** If `current_step ∈ {"awaiting_review",
   "awaiting_evaluator"}` for the active task, look for
   `checkpoints/build-pass-<build_pass>-<task-id>.json`. If present, the
   generator already finished this pass — skip Phase B and enter Phase C at
   the stage implied by `current_step` (`awaiting_review` → spawn
   `codex-reviewer`; `awaiting_evaluator` → spawn `evaluator` directly).
   If `current_step` indicates a handoff but no checkpoint exists, treat
   the prior pass as lost and fall through to the normal Phase B flow
   below.
5. Update `state.json`: `current_step` = `"build"`, the active task ->
   `"in_progress"` in `task_progress`.

### Phase B — Contract and Build

6. Draft or refresh `contracts/<task-id>.md` for the active task slice.
   Include: scope, files likely to change, concrete verification steps, risks.
7. Spawn `evaluator` (foreground) to pressure-test the contract.
   If "done" is still fuzzy, fix the contract before building.
8. Read `execution_policy.primary_executor` from `rubric.json` (default
   `claude`). Spawn the chosen builder (foreground) with:
   - the brief
   - the ordered task slices
   - the active contract
   - the consensus matrix (as architectural constraints)
   - per-task verification arrays (the `verification` array from each task JSON)
   - the current build/repair pass number
   - any prior evaluator feedback (if repair pass)

   When `primary_executor` is `claude`, spawn `generator`. When `codex`,
   spawn `codex-executor` instead. All downstream steps (9 onward) are
   identical regardless of which builder ran — the checkpoint shape is the
   same, the reviewer and evaluator consume it the same way.

   **Executor availability is a hard block.** When `primary_executor` is
   `codex` and the Codex CLI is not available (the preflight `codex --version`
   failed), halt and tell the user. Do NOT fall back to `generator` and do
   NOT honor `execution_policy.codex_policy` here — that field governs
   *critic* availability, not executor availability. The user explicitly
   chose Codex as the builder, so missing-Codex must be fixed before the
   build proceeds. Same rule applies in reverse: if a future executor is
   added and selected, its CLI must be present.
9. **Persist the handoff.** As soon as the generator returns, before spawning
   any reviewer or evaluator:
   - Increment `build_pass` in `state.json` and set `current_step` =
     `"awaiting_review"`.
   - Write `checkpoints/build-pass-<N>-<task-id>.json` with:
     `{ "task_id", "build_pass": N, "stage": "awaiting_review",
        "generator_summary": { "files_touched": [...], "notes": "..." },
        "timestamp": "ISO-8601" }`.
   The checkpoint is what makes resume safe until the evaluator writes its
   file in Phase C.

### Phase C — Review and Evaluate

10. Read `research_policy.providers` from `rubric.json`. For each provider
    in the list, spawn the matching reviewer against the latest changes:
    - `codex` → spawn `codex-reviewer`, save to `reviews/codex-build-<N>.json`
    - `gemini` → spawn `gemini-reviewer`, save to `reviews/gemini-build-<N>.json`

    Pass each reviewer the list of files modified in this pass so the review
    is scoped to the current increment, not the entire worktree. When both
    providers are active, spawn them in parallel.

    If a selected CLI is not available, check `execution_policy.codex_policy`
    (same policy applies to Gemini in this phase). If `required`, halt and
    warn the user. If `skip`, proceed without that provider's review. If
    `optional`, apply `execution_policy.degraded_mode`: `warn_and_continue`
    — note the absence and continue; `block` — halt until the CLI is
    available.

    If `research_policy.providers` is empty, skip this step entirely.
11. Update `state.json`: `current_step` = `"awaiting_evaluator"`. Then spawn
    `evaluator` (foreground) with:
    - the brief, active contract, rubric
    - the build/repair summary from the checkpoint (regardless of whether
      `generator` or `codex-executor` produced it)
    - per-task verification arrays
    - the consensus matrix
    - the review output from every active provider (Codex, Gemini, or both)
    - the current pass number
12. Write evaluation to `evaluations/build-pass-<N>.json`, then delete the
    matching `checkpoints/build-pass-<N>-<task-id>.json` — the evaluation
    supersedes it as the durable record of this pass.
13. Update `state.json`: active task -> `"complete"` or `"failed"` in
    `task_progress` based on evaluation. When marking `"failed"`, also write
    `failure_reason` (short summary from evaluator) and `action_on_resume`
    (prescriptive next step for the coordinator on cold resume).

### Phase D — Repair or Advance

14. If all rubric criteria pass: reset `repair_pass` to 0, then advance to the
    next task (back to Phase B) or to Phase E if all tasks are complete.
15. If any criterion fails:
    - Increment `repair_pass`
    - Update `state.json`: `current_step` = `"build"`, active task ->
      `"in_progress"` (repair) in `task_progress`
    - Send only failing evidence, contract deltas, and task-scoped repair
      guidance back to Phase B step 8
    - Do NOT reopen the whole plan unless the evaluator proved the brief is wrong
16. Stop repair after `max_repair_passes` (from `rubric.json`). If budget is
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

17. Update `state.json`: `phase` -> `"review"`, `current_step` -> `"review"`.
18. Present build summary to user: tasks completed, repair passes used, known
    gaps.

Simplify only when it helps — run `code-simplifier` only if the generator
introduced duplication or code got harder to follow than necessary.

This phase runs mostly autonomously. Build coherently first, then repair
narrowly based on evaluator evidence.
