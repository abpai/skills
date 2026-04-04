---
name: pi-protocol
description: >
  Claude-native harness for long-running engineering work. Defines the planner
  -> generator -> evaluator loop, checkpoint files, and optional Codex critique
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
- optional second-provider critique from Codex at high-leverage checkpoints

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
4. Use Codex only where it adds lift: ambiguous technical choices, architecture
   critique, or independent code review.
5. Prefer one strong evaluator pass plus focused repair loops over mandatory
   grading after every slice.
6. Resume from files instead of restarting from scratch.

## State Convention

Default state root: `.agents/pi/`

Backward compatibility:

- If `.agents/pi/` exists, keep using it.
- If only `.agents/plan/` exists from an older Pi run, continue there or migrate
  it once before starting new work.

Recommended layout:

```text
.agents/pi/
├── state.json
├── brief.md
├── rubric.json
├── tasks/
│   ├── T01.json
│   ├── T02.json
│   └── ...
├── contracts/
│   ├── T01.md
│   └── ...
├── research/
│   └── codex/
├── reviews/
│   ├── codex-plan.json
│   └── codex-final.json
├── evaluations/
│   ├── build-pass-1.json
│   └── review.json
└── LEARNINGS.md
```

Minimal `state.json`:

```json
{
  "phase": "plan|execute|review|done",
  "posture": "expand|selective|reduce",
  "current_step": "clarify|brief|build|repair|review",
  "state_root": ".agents/pi",
  "build_pass": 0,
  "repair_pass": 0,
  "started_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Update `state.json` whenever the phase changes or a build / repair pass
completes.

## Agents

- `planner`: Claude primary. Builds the spec, rubric, task slices, and risk list.
- `generator`: Claude primary. Executes the brief as one coherent implementation
  run.
- `evaluator`: Claude primary. Runs verification, grades the build, and produces
  repair guidance.
- `codex-researcher`: Codex secondary. Used only when a technical choice is
  ambiguous or recent enough that a second provider is useful.
- `codex-reviewer`: Codex secondary. Used to challenge the plan or review the
  latest diff before signoff.

## Phase 1: Plan

Goal: turn the user request into a working brief that the generator can execute
without improvising scope mid-run.

### 1. Posture Check

Before planning, ask the user which posture to optimize for:

- `expand`: explore the full design space
- `selective`: ship something real without over-cutting
- `reduce`: smallest thing that credibly works

Echo back your understanding in one paragraph and wait for confirmation.

### 2. Clarify and Reframe

Ask only the questions that materially change the build.

Rules:

- Batch questions into one numbered list.
- For `expand` and `selective`, challenge the framing when the request sounds
  narrower than the real product need.
- Stop once the goal, constraints, and acceptance bar fit in one tight
  paragraph.

### 3. Distill the Build

Compress the request into 3 to 5 essential primitives.

Rules:

- Each primitive must be independently buildable and testable.
- Use short noun phrases.
- Separate product primitives from implementation details.

Present the primitives to the user before finalizing the brief.

### 4. Write the Brief

Produce `.agents/pi/brief.md` (or the active state root) with:

- objective
- target users / usage mode
- posture
- constraints
- accepted reframes
- 3 to 5 primitives
- architecture sketch
- risks and unknowns
- ordered task slices
- acceptance criteria

Task slices are planning checkpoints, not mandatory sprint boundaries.
The exact build contract for a slice is written later during execution.

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

### 5. Use Codex Selectively

Do not automatically fan out every primitive.

Invoke `codex-researcher` only when one of these is true:

- the choice is architecturally important
- the technology is recent or uncertain
- the user explicitly wants a second opinion
- Claude sees two plausible approaches with materially different tradeoffs

Save any Codex research under `research/codex/`.

### 6. Challenge the Plan

Run `codex-reviewer` once against the brief and task slices.

Focus:

- missing scope
- risky assumptions
- shallow verification plans
- obvious simplifications

Incorporate `must_address` items, summarize `nice_to_have` items, and then stop.
Avoid open-ended multi-pass thrashing unless the first review reveals a serious
architectural flaw.

### 7. Finalize With the User

Always pause for review before execution.

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
missing.

### 1. Load the Brief

Read:

- `brief.md`
- `rubric.json`
- `tasks/*.json`
- `state.json`

If execution is resuming, continue from the last incomplete build or repair pass.

### 2. Draft And Tighten The Active Contract

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
- the current repository state
- the current build / repair pass number
- any prior evaluator feedback

Generator rules:

- Own the whole brief, not just one slice.
- Use task slices as a checklist for coverage and ordering.
- Treat the active contract as the source of truth for the current pass.
- Verify continuously while building.
- Do not create a commit after each pass unless the human asked for that.

### 4. Simplify Only When It Helps

`code-simplifier` is optional, not mandatory after every pass.

Run it only when:

- the generator introduced duplication
- the code got harder to follow than necessary
- a repair pass created obvious cleanup debt

### 5. Ask Codex at High-Leverage Checkpoints

Use `codex-reviewer` during execution only when:

- the generator appears blocked on an architecture choice
- the task is high-risk and you want an independent diff review before QA
- the evaluator found a bug pattern that benefits from an outside read

Codex should not sit on the critical path for every slice.

### 6. Evaluate the Build

Spawn `evaluator` after a coherent build pass, or after a focused repair pass.

The evaluator must:

- run the verification steps from the contract, task slices, and brief
- run project-appropriate tests
- score the rubric honestly
- write a structured evaluation file
- return concise repair guidance when the build misses the threshold
- say explicitly when a weak contract contributed to the failure

### 7. Repair Narrowly

If every applicable rubric criterion passes, move to review.

If any criterion fails:

- write the evaluation file
- increment `repair_pass`
- send only the failing evidence, contract deltas, and repair guidance back to
  `generator`
- keep the repair narrow; do not reopen the whole plan unless the evaluator
  proved the brief itself is wrong

Stop after `max_repair_passes` unless the human explicitly asks for another round.

When execution clears the bar, update `state.json` to `"phase": "review"`.

## Phase 3: Review

Goal: final QA, final scorecard, and durable learnings.

### 1. Run the Full Suite

Run the complete local verification suite the project supports and record the
results.

### 2. Final Evaluation

Run `evaluator` one final time against the whole build, not just the last repair.

If the latest diff has not yet had an independent second-provider read and Codex
is available, run `codex-reviewer` once before signoff and save the output under
`reviews/codex-final.json`.

### 3. Present the Scorecard

Report:

- rubric scores
- full-suite test results
- known gaps
- repair passes used
- whether Codex was consulted, and where it changed the outcome

If the build still misses the bar, return to execute with a focused repair plan
instead of restarting planning by default.

### 4. Capture Learnings

Append durable project-specific learnings to `LEARNINGS.md`, then update
`state.json` to `"phase": "done"`.

## Resumption

Never restart automatically.

- If phase is `plan`, resume from the last completed planning step.
- If phase is `execute`, resume from the last incomplete build or repair pass.
- If phase is `review`, rerun final QA against the current tree.

Only start over when the human explicitly asks for a reset.
