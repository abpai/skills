---
name: pi-protocol
description: >
  Claude-native harness for long-running engineering work. Defines the planner
  -> generator -> evaluator loop, checkpoint files, and mandatory Codex critique
  points used by the /pi: commands.
metadata:
  author: Andy Pai
  version: "0.3"
---

# Pi Protocol

Pi is a Claude Code plugin for long-running engineering work.

Use it when a task is large enough to benefit from:

- an explicit spec before coding
- one coherent build pass instead of ad hoc edits
- a real evaluator pass that can force targeted repairs
- mandatory second-provider critique from Codex at every phase checkpoint

Pi is intentionally Claude-native. Codex is a supporting CLI, not a parallel
runtime or install target.

Three commands:

- `/pi:plan` creates the working brief, rubric, and ordered task slices
- `/pi:execute` runs the generator loop against that brief
- `/pi:review` runs final QA and presents the scorecard

## Core Design

1. Keep the coordinator simple. The main thread owns orchestration, writes state,
   and avoids turning hooks into hidden control flow.
2. Use task slices as checkpoints, not hard sprint walls. They keep the build
   coherent, but the generator owns the whole spec.
3. Before each build or repair pass, write a contract for the active slice so
   "done" is explicit before code changes start.
4. Use Codex at every phase checkpoint: research during planning, plan critique
   before approval, diff review after each build pass, and final review before
   signoff. Skip only when the Codex CLI is unavailable.
5. Prefer one strong evaluator pass plus focused repair loops over mandatory
   grading after every slice.
6. Resume from files instead of restarting from scratch.

## State Convention

Default state root: `.agents/pi/`

See [STATE.md](STATE.md) for the full state convention, recommended layout,
`state.json` schema, and `task_progress` transition points.

## Agents

See [AGENTS.md](AGENTS.md) for agent descriptions and roles.

## Phase 1: Plan

Goal: turn the user request into a working brief that the generator can execute
without improvising scope mid-run.

The plan phase is a coordinator-driven pipeline. The main thread orchestrates
multiple agents across five phases (A through E). Subagents cannot spawn other
subagents, so the coordinator owns all agent spawning.

### Phase A: Interactive Planning (planner, foreground)

The coordinator spawns the `planner` as a foreground subagent for steps 1-4.
The planner follows the lateral-thinking and distill workflows described in
steps 3 and 4 below, and can interact with the user via AskUserQuestion.

#### 1. Posture Check

Before planning, ask the user which posture to optimize for:

- `expand`: explore the full design space
- `selective`: ship something real without over-cutting
- `reduce`: smallest thing that credibly works

Echo back your understanding in one paragraph and wait for confirmation.

#### 2. Clarify and Reframe

Ask only the questions that materially change the build.

Rules:

- Batch questions into one numbered list.
- For `expand` and `selective`, challenge the framing when the request sounds
  narrower than the real product need.
- Stop once the goal, constraints, and acceptance bar fit in one tight
  paragraph.

#### 3. Lateral Thinking

Run a cross-domain pattern raid (lateral-thinking workflow):

1. State the problem skeleton — strip away jargon, restate the raw mechanics
   in 2-3 sentences.
2. Decompose into primitives using lenses: information flow, timing, incentives,
   structural constraints, feedback loops, resource flows.
3. Run a cross-domain raid — search for the same mechanism in distant fields
   (biology, control systems, economics, information theory, etc.).
4. Present 3-5 transferable patterns with the mechanism that transfers, not
   surface-level metaphors.
5. Let the user pick which patterns resonate.

Save the results to `research/lateral-thinking.md`.

Surviving patterns inform the distillation step. Drop patterns the user does
not find useful.

#### 4. Distill the Build

Compress the request into 3 to 5 essential primitives, incorporating surviving
patterns from lateral thinking when they sharpen the primitive boundaries.

Follow the distill approach:

- Each primitive must be independently buildable and testable.
- Use short noun phrases.
- Separate product primitives from implementation details.
- Propose, invite pushback, refine.

Present the primitives to the user before proceeding.

The planner writes its results to state files:

- `state.json` updated with `current_step: "research_fanout"` and the
  primitives list
- `research/lateral-thinking.md`

The coordinator takes over for Phase B.

### Phase B: Research Fanout (coordinator-driven)

The coordinator reads the primitives from state files, then spawns parallel
researchers. The planner cannot spawn subagents — this is a coordinator
responsibility.

#### 5. Research Fanout

For each primitive, spawn both a `claude-researcher` and a `codex-researcher`
in parallel. All researchers run simultaneously.

Each researcher evaluates three implementation layers:

- **Boring/Proven** — most battle-tested option
- **Trending** — current popular option in the ecosystem
- **First Principles** — from-scratch design tailored to exact requirements

Each returns a structured recommendation. Results are saved under
`research/fanout/<primitive>-claude.json` and
`research/fanout/<primitive>-codex.json`.

If the Codex CLI is unavailable, note it and proceed with Claude-only research.

#### 6. Verify Tech — Consensus Matrix

The coordinator builds a comparison matrix: primitive x researcher
(Claude vs Codex).

- Where both agree: adopt the recommendation.
- Where they disagree: surface the disagreement as a tiebreak for the user
  to resolve.

Present the matrix and wait for user decisions on all tiebreaks.

Save the resolved matrix to `research/consensus-matrix.md`.

### Phase C: Task Proposal (planner, foreground)

The coordinator spawns a fresh `planner` with the primitives and resolved
tech decisions as context.

#### 7. Propose Tasks

Propose ordered task slices with specific test criteria. This is a distinct
user-facing checkpoint — the user reviews tasks before Codex review.

Each task file should look like:

```json
{
  "id": "T01",
  "title": "Short slice title",
  "primitive": "Primitive served",
  "description": "What good looks like",
  "verification": [
    "Specific check 1",
    "Specific check 2"
  ],
  "depends_on": [],
  "risk_level": "low|medium|high"
}
```

Wait for user confirmation before proceeding.

### Phase D: Codex Review — Multi-Pass (coordinator-driven)

The coordinator runs iterative `codex-reviewer` passes against the brief and
task slices.

#### 8. Codex Review

**Pass 1**: Review for gaps, risks, and test adequacy.
- Incorporate `must_address` items directly into the plan.
- Note `nice_to_have` items.

**Pass 2**: Re-run on the updated plan.
- If clean (`changed: false`), skip pass 3.

**Pass 3** (if needed): Final check.
- Remaining issues become noted risks, not blockers.

Maximum 3 passes with early exit on any clean pass.

Save each pass result to `reviews/codex-plan-pass-<N>.json`.

If the Codex CLI is unavailable, warn the user that the plan has not been
independently reviewed.

### Phase E: Finalize

#### 9. Finalize With the User

Always pause for review before execution. Present:

- the final brief summary
- the consensus matrix results
- the codex review results and any noted risks
- the ordered task slices

On approval, write:

- `brief.md`
- `rubric.json`
- `tasks/*.json`
- updated `state.json` with `"phase": "execute"`

Default rubric shape:

```json
{
  "criteria": {
    "functionality": {
      "threshold": 7,
      "description": "Does the build work as specified?"
    },
    "code_quality": {
      "threshold": 7,
      "description": "Is the code correct, readable, and maintainable?"
    },
    "product_depth": {
      "threshold": 6,
      "description": "Does the build cover the important real-world cases?"
    },
    "visual_design": {
      "threshold": 6,
      "applicable": true,
      "description": "Is the interface polished and intentional?"
    }
  },
  "max_repair_passes": 2
}
```

Set `visual_design.applicable` to `false` for non-UI work.

## Phase 2: Execute

Goal: build the spec coherently, then repair only what evaluation proves is
missing. The execute phase is a coordinator-driven pipeline with five phases
(A through E) and loop re-entry via state counters.

### 1. Load and Resume

Read:

- `brief.md`
- `rubric.json`
- `tasks/*.json`
- `state.json`
- `research/consensus-matrix.md`

Read `task_progress` from `state.json`. Skip any task with status `complete`.
Find the first non-complete task. If resuming a failed task, read the prior
evaluation.

Update `state.json`: `current_step` = `"build"`, active task ->
`"in_progress"` in `task_progress`.

### 2. Draft and Tighten the Active Contract

Before the generator writes code, create or refresh `contracts/<task-id>.md` for
the active slice.

Each contract should include:

- the scope for this pass
- the files or interfaces likely to change
- the concrete verification steps
- the risks or assumptions that could invalidate the pass

Then have `evaluator` pressure-test the contract. If "done" is still fuzzy, fix
the contract before coding.

### 3. Build Coherently

Spawn the `generator` subagent with:

- the brief
- the ordered task slices
- the active contract
- the consensus matrix (as architectural constraints, not suggestions)
- per-task verification arrays from the task slices
- the current repository state
- the current build / repair pass number
- any prior evaluator feedback (if repair pass)

Generator rules:

- Own the whole brief, not just one slice.
- Use task slices as a checklist for coverage and ordering.
- Treat the active contract as the source of truth for the current pass.
- Reference the consensus matrix for architectural decisions.
- Verify continuously while building.
- Do not create a commit after each pass unless the human asked for that.

Update `state.json`: `build_pass` incremented.

### 4. Simplify Only When It Helps

`code-simplifier` is optional, not mandatory after every pass.

Run it only when:

- the generator introduced duplication
- the code got harder to follow than necessary
- a repair pass created obvious cleanup debt

### 5. Review via Codex (mandatory)

Run `codex-reviewer` after each build or repair pass, before the evaluator
scores. Save to `reviews/codex-build-<N>.json`. This gives the evaluator an
independent second-provider read to incorporate into its assessment.

If the Codex CLI is unavailable, note it in the evaluation and continue.

### 6. Evaluate the Build

Spawn `evaluator` after a coherent build pass, or after a focused repair pass.

The evaluator must:

- run per-task verification: iterate each task slice's `verification` array,
  run each check, and record per-task pass/fail results
- run the verification steps from the contract, task slices, and brief
- run project-appropriate tests
- incorporate the `codex-reviewer` output from the prior step into its
  assessment (the evaluator does not run Codex itself — the coordinator owns
  all Codex invocations)
- cross-reference the consensus matrix — flag implementations that contradict
  resolved planning decisions
- score the rubric honestly
- write a structured evaluation file with `task_verification` results
- return task-scoped repair guidance when the build misses the threshold
  (e.g., "Fix T02: [guidance]. Fix T05: [guidance].")
- say explicitly when a weak contract contributed to the failure

Write evaluation to `evaluations/build-pass-<N>.json`.

Update `state.json`: active task -> `"complete"` or `"failed"` in
`task_progress` based on evaluation.

### 7. Repair Narrowly

If every applicable rubric criterion passes, advance to the next task (back to
step 2) or move to review if all tasks are complete.

If any criterion fails:

- write the evaluation file
- increment `repair_pass`
- update `task_progress`: active task -> `"in_progress"` (repair)
- send only the failing evidence, contract deltas, and task-scoped repair
  guidance back to `generator`
- keep the repair narrow; do not reopen the whole plan unless the evaluator
  proved the brief itself is wrong

Stop after `max_repair_passes` unless the human explicitly asks for another
round. If the repair budget is exhausted, present status to the user.

When all tasks are complete, update `state.json` to `"phase": "review"`,
`"current_step": "review"`. Present build summary: tasks completed, repair
passes used, known gaps.

## Phase 3: Review

Goal: final QA, final scorecard, and durable learnings.

### 1. Load and Verify Prerequisites

Read `state.json`. If phase is not `execute` or later (`review`, `done`), tell
the user to run `/pi:execute` first.

Read `brief.md`, `rubric.json`, `tasks/*.json`, `research/consensus-matrix.md`,
and all evaluations from `evaluations/`.

### 2. Run the Full Suite

Run the complete local verification suite the project supports and record the
results.

Run per-task verification: iterate each task's `verification` array and record
results. Write suite results to `evaluations/suite-results.json`.

### 3. Final Evaluation

Run `codex-reviewer` for a final independent read of the full build. Save the
output under `reviews/codex-final.json`. If the Codex CLI is unavailable, note
the absence in the scorecard.

Run `evaluator` one final time against the whole build (not just the last
repair), with:

- the brief, rubric, full build
- per-task verification arrays and consensus matrix
- suite results and codex review output
- all prior evaluations for context

The evaluator cross-references the consensus matrix and produces both global
rubric scores and per-task verification results. Write final evaluation to
`evaluations/review.json`.

### 4. Present the Scorecard

Report:

- global rubric scores (functionality, code_quality, product_depth,
  visual_design if applicable)
- per-task verification results (task_id, checks passed/failed)
- consensus matrix cross-reference: flag any implementation that contradicts
  resolved planning decisions
- full-suite test results
- known gaps
- repair passes used during execute
- whether Codex was consulted, and where it changed the outcome

If the build still misses the bar, return to execute with a focused repair plan
instead of restarting planning by default.

### 5. Capture Learnings

Append durable project-specific learnings to `LEARNINGS.md`, then update
`state.json` to `"phase": "done"`.

## Resumption

Never restart automatically.

- If phase is `plan`, resume from the last completed planning step.
- If phase is `execute`, read `task_progress` to find the first task with status
  other than `complete`, and resume from the last incomplete build or repair pass
  for that task.
- If phase is `review`, rerun final QA against the current tree.

Only start over when the human explicitly asks for a reset.
