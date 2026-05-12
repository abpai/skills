# Pi Protocol

Pi is a Claude Code plugin for long-running engineering work.

Use it when a task is large enough to benefit from:

- an explicit spec before coding
- one coherent build pass instead of ad hoc edits
- a real evaluator pass that can force targeted repairs
- optional second-provider critique from Codex, Gemini, or both at phase
  checkpoints

Pi is intentionally Claude-native. Codex and Gemini are supporting CLIs, not
parallel runtimes or install targets.

Four commands:

- `/pi:plan` creates the working brief, rubric, and ordered task slices
- `/pi:execute` runs the generator loop against that brief
- `/pi:review` runs final QA and presents the scorecard
- `/pi:debate` runs a structured propose -> critique -> synthesize loop for
  architecture, product workflow, or UI layout decisions

## Core Design

1. Keep the coordinator simple. The main thread owns orchestration, writes state,
   and avoids turning hooks into hidden control flow.
2. Use task slices as checkpoints, not hard sprint walls. They keep the build
   coherent, but the generator owns the whole spec.
3. Before each build or repair pass, write a contract for the active slice so
   "done" is explicit before code changes start.
4. Use Codex at every phase checkpoint: research during planning, plan critique
   before approval, diff review after each build pass, and final review before
   signoff. Behavior when Codex is not available is governed by
   `execution_policy` in `rubric.json`.
5. Prefer one strong evaluator pass plus focused repair loops over mandatory
   grading after every slice.
6. Resume from files instead of restarting from scratch.

## State Convention

Pi uses `.agents/work/` as a namespace root and stores each run under its own
state root. This namespace is intentionally frontend-agnostic — other CLIs (a
forked omx, a Codex-native wrapper, etc.) can target the same schema.

- namespace root: `.agents/work/`
- active run pointer: `.agents/work/current.json`
- default run root: `.agents/work/runs/<slug>/`

See [STATE.md](STATE.md) for the full state convention, recommended layout,
`state.json` schema, and `task_progress` transition points.

## Artifact Templates

When producing the core artifacts, start from the templates in this module's
`templates/` directory rather than hallucinating structure:

- `internal/protocol/templates/brief.md` — shape for `${state_root}/brief.md`
- `internal/protocol/templates/rubric.json` — shape for `${state_root}/rubric.json`
- `internal/protocol/templates/task.json` — shape for each file in `${state_root}/tasks/`
- `internal/protocol/templates/contract.md` — shape for each file in `${state_root}/contracts/`
- `internal/protocol/templates/layout-options.html` — starting point for
  `${state_root}/artifacts/layout-options.html` when UI work needs layout
  directions

When a subagent (planner, generator, evaluator) produces one of these artifacts,
the coordinator is responsible for passing the plugin-relative template path in,
such as `internal/protocol/templates/task.json`.

## Agents

See [AGENTS.md](AGENTS.md) for agent descriptions and roles.

## Phase 1: Plan

Goal: turn the user request into a working brief that the generator can execute
without improvising scope mid-run.

The plan phase is a coordinator-driven pipeline. The main thread orchestrates
Phase 0 plus phases A through E. Subagents cannot spawn other subagents, so
the coordinator owns all agent spawning.

### Phase 0: Select or Create a Run (coordinator-driven)

Before spawning the planner, resolve the active run.

1. Read `.agents/work/current.json` if present.
2. List `.agents/work/runs/*/` to discover known runs.
3. If runs already exist, offer:
   - resume the current run
   - switch to another existing run
   - create a new run
   - abort
4. When creating a new run, derive the default slug from the user's request
   and show it to the user. Check for collisions by comparing against the
   existing directories under `.agents/work/runs/`. Ask only if the derived
   slug already exists or the user wants to rename it.
5. Once a slug is selected, treat `state_root` as
   `.agents/work/runs/<slug>/` for the rest of the plan phase. All writes go
   there.

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
- `state.json` also carries `project_slug`, `title`, and
  `state_root: ".agents/work/runs/<slug>"`
- `research/lateral-thinking.md`

The coordinator takes over for Phase B.

When the user approves the plan, write `brief.md`, `rubric.json`, and
`tasks/*.json` in the active `state_root`, update `state.json` in that
`state_root` with `phase: "execute"`, and refresh `.agents/work/current.json`
so `/pi:execute` and `/pi:review` resolve the same run.

### Phase B: Research Fanout (coordinator-driven)

The coordinator reads the primitives from state files, then spawns parallel
researchers. The planner cannot spawn subagents — this is a coordinator
responsibility.

Update `state.json` in `state_root`: `current_step` = `"research_fanout"`.

#### 5. Research Fanout

Always spawn `claude-researcher` per primitive. Additionally, for each
provider in `research_policy.providers` (selected in Phase A step 1), spawn
its researcher:

- `codex` in providers → spawn `codex-researcher`
- `gemini` in providers → spawn `gemini-researcher`

All researchers run in parallel. Each evaluates three implementation layers:

- **Boring/Proven** — most battle-tested option
- **Trending** — current popular option in the ecosystem
- **First Principles** — from-scratch design tailored to exact requirements

Each returns a structured recommendation. Results are saved under
`research/fanout/<primitive>-<provider>.json` in `state_root`.

If a selected CLI is not available, check `execution_policy` in `rubric.json`.
For Codex, `codex_policy` governs the fallback. Reuse the same semantics for
Gemini. If empty providers (Claude-only), skip external researchers.

Update `state.json` in `state_root`: `current_step` = `"verify_tech"`.

#### 6. Verify Tech — Consensus Matrix

The coordinator builds a comparison matrix: primitive × researcher.

- Where all researchers agree: adopt the recommendation.
- Where any disagree: surface the disagreement as a tiebreak for the user
  to resolve.
- If only `claude-researcher` ran (providers empty or all selected CLIs
  unavailable), there is nothing to cross-check against — record Claude's
  recommendations directly without a tiebreak pass.

Present the matrix and wait for user decisions on all tiebreaks.

Save the resolved matrix to `research/consensus-matrix.md` in `state_root`.

### Phase C: Task Proposal (planner, foreground)

Update `state.json` in `state_root`: `current_step` = `"propose_tasks"`.

The coordinator spawns a fresh `planner` with the primitives and resolved
tech decisions as context.

#### 7. Propose Tasks

Propose ordered task slices with specific test criteria. This is a distinct
user-facing checkpoint — the user reviews tasks before external review.

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

**Non-UI work:** leave `rubric.json.criteria.visual_design.applicable` at the
template default of `false`, present the task slices, and wait for user
confirmation before proceeding.

**UI work:** do not request task confirmation yet. First complete 7.5 to choose
a layout direction and fold it into the brief and task slices, then present the
layout-adjusted task slices and wait for confirmation.

#### 7.5. Explore UI Layout Options (UI work only)

When any primitive or task includes a user interface, create a visual planning
artifact before the task-confirmation checkpoint in 7:

- `artifacts/layout-options.html` — a self-contained HTML gallery with 2-3
  concrete layout directions
- `research/ui-layout-decision.md` — the chosen direction, rationale, rejected
  alternatives, and visual verification notes

Each layout direction must show the information hierarchy, main workflow,
responsive behavior, empty/loading/error states where relevant, tradeoffs, and
risks. Use `templates/layout-options.html` as the starting point for the visual
style: ivory background, restrained clay/green accents, simple inline SVG
wireframes, and a gallery that lets the human compare options at a glance.

Present `artifacts/layout-options.html` to the user and wait for a chosen
direction. Then write `research/ui-layout-decision.md`, set
`rubric.json.criteria.visual_design.applicable` to `true`, and fold the chosen
direction into `brief.md` and the affected task `verification` arrays — before
presenting the task slices for confirmation in 7, so the user confirms the
layout-adjusted slices, not a pre-layout draft.

### Phase D: External Review — Multi-Pass (coordinator-driven)

Update `state.json` in `state_root`: `current_step` = `"codex_review"`
(name preserved for state compatibility; the step runs whichever critics are
in `research_policy.providers`).

For each provider in `research_policy.providers`, the coordinator runs up to
3 iterative review passes against the brief and task slices. When both
providers are active, pass 1 runs them in parallel and merges
`must_address` items before pass 2.

#### 8. External Review

**Pass 1**: Review for gaps, risks, and test adequacy.
- Incorporate `must_address` items from any provider directly into the plan.
- Note `nice_to_have` items.
- For UI work, include `artifacts/layout-options.html` and
  `research/ui-layout-decision.md` in the review context. Ask reviewers to
  flag visual hierarchy gaps, missing responsive states, and weak visual QA.

**Pass 2**: Re-run on the updated plan for every provider that flagged issues.
- If a provider returns `changed: false`, skip pass 3 for that provider.

**Pass 3** (if needed): Final check.
- Remaining issues become noted risks, not blockers.

Maximum 3 passes per provider with early exit on any clean pass.

Save each pass result to `reviews/<provider>-plan-pass-<N>.json` in
`state_root` (e.g. `codex-plan-pass-1.json`, `gemini-plan-pass-1.json`).

If `research_policy.providers` is empty, skip Phase D entirely.

If a selected CLI is not available, check `execution_policy`. `codex_policy`
governs Codex availability; reuse the same semantics for Gemini. If `skip`,
proceed silently. If `required`, halt until the CLI is available. If
`optional`, apply `degraded_mode`: `warn_and_continue` — warn the user that
the plan has not been independently reviewed and continue; `block` — halt.

### Phase E: Finalize

Update `state.json` in `state_root`: `current_step` = `"finalize"`.

#### 9. Finalize With the User

Always pause for review before execution. Present:

- the final brief summary
- the consensus matrix results
- the external review results from each active provider (Codex, Gemini, or
  both) and any noted risks
- the ordered task slices
- the validation plan, including commands and browser/screenshot checks
- for UI work, the selected layout direction and the path to
  `artifacts/layout-options.html`
- the selected `research_policy.providers` and `primary_executor` (so the
  user sees which critics and which builder will run during execute)

On approval, write:

- `brief.md` in `state_root`
- `rubric.json` in `state_root`
- `tasks/*.json` in `state_root`
- updated `state.json` in `state_root` with `phase: "execute"`,
  `project_slug`, `title`, and `state_root`
- refreshed `.agents/work/current.json`

See [STATE.md](STATE.md) for the default rubric shape, `execution_policy`
field definitions, and enum values. Set `visual_design.applicable` to `false`
for non-UI work. For UI work, keep it `true` and ensure task verification
includes screenshot/browser evidence for the selected layout direction.

## Phase 2: Execute

Goal: build the spec coherently, then repair only what evaluation proves is
missing. The execute phase is a coordinator-driven pipeline with five phases
(A through E) and loop re-entry via state counters.

Before Phase A, resolve the active run from `.agents/work/current.json`.

- If `current.json` exists, use its slug.
- If `current.json` is missing and exactly one run exists under
  `.agents/work/runs/`, auto-select it and continue.
- Otherwise fail fast and tell the user to run `/pi:plan` to select or create
  a run.

All execute-phase reads and writes use the resolved `state_root`.

### 1. Load and Resume

Read:

- `brief.md` in `state_root`
- `rubric.json` in `state_root`
- `tasks/*.json` in `state_root`
- `state.json` in `state_root`
- `research/consensus-matrix.md` in `state_root`

Read `task_progress` from `state.json` in `state_root`. Skip any task with
status `complete` or `blocked`. Find the first non-complete, non-blocked task.
If resuming a failed task, read its
`action_on_resume` field first — it pre-computes the next step so the
coordinator does not need to re-read evaluation files to reconstruct context.
If `action_on_resume` is absent, fall back to reading the prior evaluation.

If there are no tasks, or all remaining tasks are `complete` or `blocked`, skip
directly to the finalize step. Do not enter the build loop.

**Handoff resume.** If `current_step` is `awaiting_review` or
`awaiting_evaluator` and a matching
`checkpoints/build-pass-<N>-<task-id>.json` exists, skip the build step and
enter review/evaluation directly — the generator already finished this pass.
See STATE.md for the full resume decision table. If the checkpoint is
missing, treat the pass as lost and re-enter the build.

Update `state.json` in `state_root`: `current_step` = `"build"`, active task
-> `"in_progress"` in `task_progress`.

### 2. Draft and Tighten the Active Contract

Before the generator writes code, create or refresh
`contracts/<task-id>.md` in `state_root` for the active slice.

Each contract should include:

- the scope for this pass
- the files or interfaces likely to change
- the concrete verification steps
- the risks or assumptions that could invalidate the pass

Then have `evaluator` pressure-test the contract. If "done" is still fuzzy, fix
the contract before coding.

### 3. Build Coherently

Read `execution_policy.primary_executor` from `rubric.json` (default
`claude`). Spawn the corresponding builder subagent:

- `claude` → spawn `generator` (Claude-native).
- `codex` → spawn `codex-executor` (thin wrapper that shells to `codex exec`).

**Executor availability is a hard block.** When the selected executor's CLI
is not available, halt and surface the missing dependency to the user. Do
not fall back to a different builder and do not apply `codex_policy` here —
that policy governs *critics* only. The user chose the builder explicitly,
so the missing dependency must be resolved before the build can proceed.

Either way, pass:

- the brief
- the ordered task slices
- the active contract
- the consensus matrix (as architectural constraints, not suggestions)
- per-task verification arrays from the task slices
- the current repository state
- the current build / repair pass number
- any prior evaluator feedback (if repair pass)
- for UI work, `research/ui-layout-decision.md` and the selected direction
  from `artifacts/layout-options.html`

Builder rules (apply to both `generator` and `codex-executor`):

- Own the whole brief, not just one slice.
- Use task slices as a checklist for coverage and ordering.
- Treat the active contract as the source of truth for the current pass.
- Reference the consensus matrix for architectural decisions.
- Verify continuously while building.
- Do not create a commit after each pass unless the human asked for that.

The downstream pipeline is builder-agnostic: the checkpoint shape, diff
review, evaluator scoring, and repair loop are identical whether Claude or
Codex wrote the code.

As soon as the generator returns, persist the handoff before spawning any
reviewer or evaluator:

- Increment `build_pass` in `state.json` in `state_root` and set
  `current_step` = `"awaiting_review"`.
- Write `checkpoints/build-pass-<N>-<task-id>.json` in `state_root` with the
  generator summary (files touched, notes) so resume can skip straight to
  review.

The checkpoint is deleted once the evaluator writes
`evaluations/build-pass-<N>.json` in `state_root`.

### 4. Simplify Only When It Helps

`code-simplifier` is optional, not mandatory after every pass.

Run it only when:

- the generator introduced duplication
- the code got harder to follow than necessary
- a repair pass created obvious cleanup debt

### 5. External Review

For each provider in `research_policy.providers`, run the matching reviewer
after each build or repair pass, before the evaluator scores:

- `codex` → spawn `codex-reviewer`, save to `reviews/codex-build-<N>.json`
- `gemini` → spawn `gemini-reviewer`, save to `reviews/gemini-build-<N>.json`

Pass each reviewer the list of files modified in this pass so the review is
scoped to the current increment, not the entire worktree. When both
providers are active, run them in parallel. The evaluator incorporates
every provider's output into its assessment.

If `research_policy.providers` is empty, skip this step.

After review(s) complete, update `state.json` in `state_root`: `current_step`
= `"awaiting_evaluator"` before spawning the evaluator.

If a selected CLI is not available, check `execution_policy`. `codex_policy`
governs Codex availability; reuse the same semantics for Gemini. If `skip`,
proceed without that provider's review. If `required`, warn the user. If
`optional`, apply `degraded_mode`: `warn_and_continue` — note the absence
in the evaluation and continue; `block` — halt until the CLI is available.

### 6. Evaluate the Build

Spawn `evaluator` after a coherent build pass, or after a focused repair pass.

The evaluator must:

- run per-task verification: iterate each task slice's `verification` array,
  run each check, and record per-task pass/fail results
- run the verification steps from the contract, task slices, and brief
- run project-appropriate tests
- when visual design applies, run or require browser/screenshot verification
  against `research/ui-layout-decision.md`
- incorporate reviewer output from every active provider (`codex-reviewer`,
  `gemini-reviewer`, or both) into its assessment. The evaluator does not
  spawn external CLIs itself — the coordinator owns all external
  invocations.
- cross-reference the consensus matrix — flag implementations that contradict
  resolved planning decisions
- score the rubric honestly
- write a structured evaluation file with `task_verification` results
- return task-scoped repair guidance when the build misses the threshold
  (e.g., "Fix T02: [guidance]. Fix T05: [guidance].")
- say explicitly when a weak contract contributed to the failure

Write evaluation to `evaluations/build-pass-<N>.json` in `state_root`, then
delete the matching `checkpoints/build-pass-<N>-<task-id>.json` in
`state_root`.

Update `state.json` in `state_root`: active task -> `"complete"` or
`"failed"` in `task_progress` based on evaluation.

### 7. Repair Narrowly

If every applicable rubric criterion passes, reset `repair_pass` to 0, then
advance to the next task (back to step 2) or move to review if all tasks are
complete.

If any criterion fails:

- write the evaluation file
- increment `repair_pass`
- update `task_progress`: active task -> `"in_progress"` (repair)
- send only the failing evidence, contract deltas, and task-scoped repair
  guidance back to the active builder (`generator` or `codex-executor`
  depending on `execution_policy.primary_executor`)
- keep the repair narrow; do not reopen the whole plan unless the evaluator
  proved the brief itself is wrong

Stop after `max_repair_passes` unless the human explicitly asks for another
round. If the repair budget is exhausted:

- write `failure_reason` to the task's `task_progress` entry (short summary
  from the evaluator's repair guidance)
- write `action_on_resume` with the prescriptive next step (e.g.,
  `"read evaluations/build-pass-2.json, resume repair or escalate to user"`)
- propagate `blocked` status to all downstream dependents: for each task whose
  `depends_on` includes the failed task, set status to `blocked`, write
  `blocked_by` (the failed task ID), `blocked_kind: "failed"`, and
  `failure_reason` (e.g., `"dependency T02 failed"`). For tasks that depend on
  a newly blocked task, propagate transitively with `blocked_kind: "blocked"`.
- present status to the user

When all tasks are complete (or complete + blocked), update `state.json` in
`state_root` to `phase: "review"`, `current_step: "review"`. Present build
summary: tasks completed, repair passes used, known gaps.

## Phase 3: Review

Goal: final QA, final scorecard, and durable learnings.

Before Phase A, resolve the active run from `.agents/work/current.json`.

- If `current.json` exists, use its slug.
- If `current.json` is missing and exactly one run exists under
  `.agents/work/runs/`, auto-select it and continue.
- Otherwise fail fast and tell the user to run `/pi:plan` to select or create
  a run.

All review-phase reads and writes use the resolved `state_root`.

### 1. Load and Verify Prerequisites

Read `state.json` in `state_root`. If phase is not `execute` or later
(`review`, `done`), tell the user to run `/pi:execute` first.

Read `brief.md`, `rubric.json`, `tasks/*.json`, and
`research/consensus-matrix.md` in `state_root`, plus all evaluations from
`evaluations/` in `state_root`.

### 2. Run the Full Suite

Run the complete local verification suite the project supports and record the
results.

Run per-task verification: iterate each task's `verification` array and record
results. Write suite results to `evaluations/suite-results.json` in
`state_root`.

When `rubric.json.criteria.visual_design.applicable` is `true`, the full suite
must include browser-backed visual evidence:

- open the implemented UI through Browser, Chrome DevTools, Playwright, or the
  project's existing UI test harness
- capture or reference screenshots at desktop and mobile widths
- check console errors, obvious layout overlap, responsive behavior, and the
  selected layout direction from `research/ui-layout-decision.md`
- record screenshot paths or test artifact paths in `suite-results.json`

If no browser or screenshot path is available, mark visual verification blocked
and do not let the final `visual_design` score pass on prose alone.

### 3. Final Evaluation

For each provider in `research_policy.providers`, run the matching reviewer
for a final independent read of the full build:

- `codex` → spawn `codex-reviewer`, save to `reviews/codex-final.json`
- `gemini` → spawn `gemini-reviewer`, save to `reviews/gemini-final.json`

Run providers in parallel when both are active. If the list is empty, skip
this step. If a selected CLI is not available, check `execution_policy`.
`codex_policy` governs Codex; reuse the same semantics for Gemini. `skip`
proceeds without the review; `required` halts; `optional` applies
`degraded_mode` (`warn_and_continue` notes the absence in the scorecard;
`block` halts).

Run `evaluator` one final time against the whole build (not just the last
repair), with:

- the brief, rubric, full build
- per-task verification arrays and consensus matrix
- suite results and the review output from every active provider
- all prior evaluations for context
- for UI work, `research/ui-layout-decision.md` and screenshot/test artifact
  paths from the suite results

The evaluator cross-references the consensus matrix and produces both global
rubric scores and per-task verification results. Write final evaluation to
`evaluations/review.json` in `state_root`.

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
- which external providers were consulted (Codex, Gemini, both, or neither),
  and where any of them changed the outcome
- which builder ran (`claude` or `codex`)

If the build still misses the bar:

- Update `state.json`: `phase` -> `"execute"` (not `"done"`)
- Present the focused repair plan to the user
- Do NOT write LEARNINGS.md or mark done — the workflow returns to
  `/pi:execute` for another repair cycle

### 5. Capture Learnings (only on pass)

If the build passes, append durable project-specific learnings to
`LEARNINGS.md`, then update `state.json` to `"phase": "done"`.

## Resumption

Never restart automatically.

- If phase is `plan`, resume from the last completed planning step.
- If phase is `execute`, read `task_progress` to find the first task with status
  other than `complete` or `blocked`, and resume from the last incomplete build
  or repair pass for that task.
- If phase is `review`, rerun final QA against the current tree.

Only start over when the human explicitly asks for a reset.
