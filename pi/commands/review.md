---
description: Run final Pi review. Executes the full verification suite, performs holistic evaluation, and presents the scorecard with any remaining repair guidance.
argument-hint: "[optional task id or filter]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *)
  Bash(git rev-parse *) Bash(git add *) Bash(git commit *)
  Bash(codex *) Bash(cat .agents/pi/*) Bash(cat .agents/pi/runs/*/*)
  Bash(cat .agents/pi/runs/*/*/*) Bash(cat .agents/pi/runs/*/*/*/*)
  Bash(ls .agents/pi/*) Bash(ls .agents/pi/runs/*)
  Bash(ls .agents/pi/runs/*/*) Bash(ls .agents/pi/runs/*/*/*)
  Read Write Edit Grep Glob
---

## Pi state snapshot

```!
echo "PI_REVIEW_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -30
test -f .agents/pi/current.json && cat .agents/pi/current.json || echo "no active run"
ls -1 .agents/pi/runs 2>/dev/null || echo "no runs"
test -f .agents/pi/state.json && echo "legacy top-level pi state present" || true
timeout 3 codex --version 2>&1 || echo "codex: not installed"
```

The block above runs at skill-load time. Use its output to confirm the brief
and tasks exist for the selected run before starting the full verification
suite, and to gate the final Codex review on CLI availability. The
coordinator must still resolve the run and re-read its `state.json` before
acting.

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 3: Review**.

User input: $ARGUMENTS

Active state root: `.agents/pi/runs/<slug>/` via `.agents/pi/current.json`

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration.

### Phase A — Load and Verify Prerequisites

0. Resolve the active run:
   - Read `.agents/pi/current.json` if present and use its slug.
   - If `current.json` is missing and exactly one run exists under
     `.agents/pi/runs/`, auto-select it and continue.
   - Otherwise stop and tell the user to run `/pi:plan` to select or create
     a run.
1. Read `state.json` from the resolved `state_root`. If phase is not `execute`
   or later (`review`, `done`),
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
   If Codex CLI is not available, check `execution_policy` from
   `rubric.json`. If `codex_policy` is `skip`, proceed without Codex review.
   If `codex_policy` is `required`, halt and warn the user. If `codex_policy`
   is `optional`, apply `degraded_mode`: `warn_and_continue` — note the
   absence in the scorecard and proceed; `block` — halt and warn the user.
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
