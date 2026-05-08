# pi

A Claude-native harness for long-running engineering work.

## In Simple Terms

Pi is a way to keep a big AI coding task from turning into a messy stream of
ad hoc edits.

It does three simple things:

1. turns the request into a clear brief
2. makes the generator work against an explicit contract instead of vague intent
3. forces a real evaluator pass before calling the work done

If helpful, Pi can also ask Codex for a second opinion. But Claude stays in
charge of the workflow.

Pi keeps the control loop simple:

1. The **coordinator** (main thread) orchestrates everything — spawns agents,
   routes artifacts, maintains state.
2. `planner` turns the request into a brief, rubric, and ordered task slices.
3. The coordinator drafts a contract for the current slice, then spawns
   `generator` to execute it as one coherent pass.
4. `evaluator` runs per-task verification, incorporates external reviews (Codex, Gemini, or both), grades
   the build, and drives narrow repairs.

By default, Codex is the second-provider critic at every phase checkpoint:

- parallel research fanout during planning (Claude + Codex per primitive)
- iterative plan critique before approval (up to 3 passes)
- diff review after each build/repair pass
- final independent read before signoff

Behavior when Codex is not available is governed by
`execution_policy` in `rubric.json`.

Pi is intentionally a Claude plugin only. It uses the `codex` CLI as a
supporting tool, but it is not meant to be installed as a Codex plugin. The
structured debate workflow also lives here as `/pi:debate`, because it uses the
same Claude-primary plus Codex-critic shape.

## Mental Model

Think of Pi like this:

- the **coordinator** (main thread) orchestrates agents and routes artifacts
- `planner` decides what we are building (interactive, foreground)
- `generator` tries to build it
- `evaluator` decides whether it actually clears the bar
- Codex is the default outside critic at each phase checkpoint

## Flow Diagram

```text
user
  |
  +--> /pi:plan (coordinator pipeline, Phases A-E)
  |      |
  |      +--> Phase A: planner (foreground)
  |      |      posture, clarify, lateral thinking, distill
  |      |
  |      +--> Phase B: coordinator spawns parallel researchers
  |      |      claude-researcher + codex-researcher per primitive
  |      |      builds consensus matrix, user resolves tiebreaks
  |      |
  |      +--> Phase C: planner (foreground, fresh spawn)
  |      |      proposes task slices from resolved tech decisions
  |      |
  |      +--> Phase D: codex-reviewer (up to 3 iterative passes)
  |      |
  |      \--> Phase E: human approval → write brief, rubric, tasks
  |
  +--> /pi:execute (coordinator pipeline, Phases A-E)
  |      |
  |      +--> Phase A: load brief, resume from task_progress
  |      |
  |      +--> Phase B: coordinator drafts contract
  |      |      evaluator pressure-tests it, generator builds
  |      |
  |      +--> Phase C: codex-reviewer → evaluator scores
  |      |      per-task verification + rubric + consensus matrix
  |      |
  |      +--> Phase D: pass? ─ yes ─→ next task or Phase E
  |      |                  └─ no ──→ task-scoped repair (loop)
  |      |
  |      \--> Phase E: finalize, transition to review
  |
  +--> /pi:review (coordinator pipeline, Phases A-D)
  |      |
  |      +--> Phase A: load prerequisites
  |      +--> Phase B: full suite + per-task verification
  |      +--> Phase C: codex-reviewer + evaluator final pass
  |      \--> Phase D: scorecard + learnings → human review
  |
  \--> /pi:debate (standalone debate module)
         |
         +--> Claude proposes
         +--> Codex critiques
         \--> Claude synthesizes a final ADR
```

## Commands

| Command | Phase | What it does |
| --- | --- | --- |
| `/pi:plan` | Plan | Posture -> clarify -> lateral thinking -> distill -> provider selection (None / Codex / Gemini / both) -> parallel research fanout -> consensus matrix -> task slices -> iterative external critique |
| `/pi:execute` | Execute | Per-task: draft contract -> build (Claude `generator` or Codex `codex-executor` per `primary_executor`) -> external review (gated by `research_policy.providers`) -> evaluate with per-task verification -> task-scoped repair |
| `/pi:review` | Review | Full suite + per-task verification -> external final reads (per provider) -> scorecard with consensus matrix cross-reference |
| `/pi:debate` | Debate | Standalone propose -> Codex critique -> synthesize loop for architecture decisions and tradeoffs, ending in an ADR |

## Agents

| Agent | Role |
| --- | --- |
| `planner` | Claude primary. Interactive planning (foreground subagent). Spawned twice: once for posture/clarify/lateral-thinking/distill, once for task proposal. |
| `claude-researcher` | Claude primary. 3-layer research per primitive (boring/trending/first-principles). |
| `generator` | Claude primary builder. Coherent implementation against the active contract. Spawned when `execution_policy.primary_executor` is `claude` (default). |
| `codex-executor` | Codex primary builder. Thin wrapper that shells `codex exec` against the active contract. Spawned when `execution_policy.primary_executor` is `codex`. |
| `evaluator` | Claude primary. Per-task verification, rubric scoring, incorporates external reviews (Codex, Gemini, or both) from coordinator. |
| `codex-researcher` | Codex secondary. 3-layer research per primitive via Codex CLI. Enabled when `research_policy.providers` includes `codex`. |
| `codex-reviewer` | Codex secondary. Plan critique (up to 3 passes), build review, final review. Enabled when `research_policy.providers` includes `codex`. |
| `gemini-researcher` | Gemini secondary. 3-layer research per primitive via Gemini CLI. Enabled when `research_policy.providers` includes `gemini`. |
| `gemini-reviewer` | Gemini secondary. Same review schema as `codex-reviewer`, wraps `gemini -p`. Enabled when `research_policy.providers` includes `gemini`. |

## Claude Plugin Constraints

Pi ships its helpers as plugin agents under `agents/`, so they follow Claude's
plugin-agent rules:

- plugin agents are lower priority than project or user `.claude/agents/`
- plugin agents must not rely on `hooks`, `mcpServers`, or `permissionMode`
- if you need those features, copy the agent into `.claude/agents/` or
  `~/.claude/agents/` and extend it there

Pi intentionally does not ship hook-based orchestration. If you add local plugin
hooks while developing, put them in `hooks/hooks.json` and use
`${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_DATA}` for bundled scripts and
persistent state.

## State

Pi uses `.agents/work/` as a namespace root and stores each run under its own
state root:

```text
.agents/work/
├── current.json
└── runs/
    └── <slug>/
        ├── state.json
        ├── brief.md
        ├── rubric.json
        ├── tasks/
        ├── contracts/
        ├── research/
        ├── reviews/
        ├── evaluations/
        ├── checkpoints/
        └── LEARNINGS.md
```

`current.json` is a checkout-local pointer to the active run. `/pi:plan` can
resume, switch, or create runs. `/pi:execute` and `/pi:review` resolve the
active run from `current.json`, and if the pointer is missing but there is
exactly one run, they auto-select it.

`checkpoints/` holds short-lived handoff files written when a generator
finishes a pass and deleted once the evaluator scores it. They let
`/pi:execute` resume into review/evaluation after a mid-handoff stop
instead of re-running the generator. See `pi-protocol/STATE.md` for the
full resume decision table.

## File Diagram

This is the artifact flow Pi tries to maintain:

```text
/pi:plan
  |
  +--> .agents/work/current.json
  +--> .agents/work/runs/<slug>/state.json
  +--> .agents/work/runs/<slug>/brief.md
  +--> .agents/work/runs/<slug>/rubric.json
  +--> .agents/work/runs/<slug>/tasks/T01.json ...
  +--> .agents/work/runs/<slug>/research/lateral-thinking.md
  +--> .agents/work/runs/<slug>/research/fanout/*-claude.json, *-codex.json
  +--> .agents/work/runs/<slug>/research/consensus-matrix.md
  \--> .agents/work/runs/<slug>/reviews/codex-plan-pass-{1,2,3}.json

/pi:execute
  |
  +--> .agents/work/runs/<slug>/contracts/T01.md ...
  +--> code changes in the target repo
  +--> .agents/work/runs/<slug>/checkpoints/build-pass-{N}-{task}.json  (transient: written after generator, deleted after evaluator)
  +--> .agents/work/runs/<slug>/reviews/codex-build-{N}.json
  +--> .agents/work/runs/<slug>/evaluations/build-pass-{N}.json
  \--> .agents/work/runs/<slug>/state.json (task_progress updated per task)

/pi:review
  |
  +--> .agents/work/runs/<slug>/evaluations/suite-results.json
  +--> .agents/work/runs/<slug>/reviews/codex-final.json
  +--> .agents/work/runs/<slug>/evaluations/review.json
  |
  +--> if passing:
  |      +--> .agents/work/runs/<slug>/LEARNINGS.md
  |      \--> .agents/work/runs/<slug>/state.json => done
  \--> if failing:
         \--> .agents/work/runs/<slug>/state.json => execute (repair cycle)
```

The `.agents/work/` namespace is intentionally frontend-agnostic. Pi is the
Claude-native frontend, but the schema is stable so other CLIs (a forked
oh-my-codex, a Codex-native wrapper, a script, etc.) can target the same
run artifacts.

## Why This Shape

This plugin intentionally follows the simplified harness pattern Anthropic
described for long-running application work: planner -> generator -> evaluator,
with repair loops only when evaluation proves they are needed.

Compared with the original Pi draft, this version keeps the control loop tight:

- no mandatory per-task rubric grading (rubric stays global, per-task
  verification is a lightweight pre-step)
- no automatic code-simplifier pass after every step
- no hook-based orchestration
- no per-attempt commit requirement inside the generator loop
- Codex is used at phase checkpoints by default, but the coordinator owns all
  invocations — agents never shell out to Codex themselves

## Install

Marketplace install:

```bash
claude plugin install pi@abpai-skills --scope user
```

Local development / testing:

```bash
claude --plugin-dir /path/to/pi
```

## Prerequisites

- Claude Code installed and authenticated
- `codex` CLI installed and authenticated if you want second-provider research
  or review
- Project-appropriate verification tools for the target repo
- `code-simplifier` installed only if you want that optional cleanup pass

## Usage

```bash
# Create or select a run, then build the brief interactively
/pi:plan Build a real-time collaboration engine for our editor

# Run the main generation and repair loop
/pi:execute

# Run final review and score the result
/pi:review
```

Each phase reads `state.json` on entry and resumes instead of restarting by
default.

## Committing Plan Output

This repo now ignores transient Pi runtime files but leaves durable planning
artifacts trackable by default.

Usually worth committing:

- `.agents/work/runs/<slug>/brief.md`
- `.agents/work/runs/<slug>/rubric.json`
- `.agents/work/runs/<slug>/tasks/`
- `.agents/work/runs/<slug>/contracts/`
- `.agents/work/runs/<slug>/research/consensus-matrix.md`
- `.agents/work/runs/<slug>/research/lateral-thinking.md`
- `.agents/work/runs/<slug>/LEARNINGS.md`

Usually keep local:

- `.agents/work/current.json`
- `.agents/work/runs/<slug>/state.json`
- `.agents/work/runs/<slug>/research/fanout/`
- `.agents/work/runs/<slug>/reviews/`
- `.agents/work/runs/<slug>/evaluations/`
- `.agents/work/runs/<slug>/checkpoints/`

If `current.json` is missing but only one run exists, `/pi:execute` and
`/pi:review` will auto-select it. If several runs exist, use `/pi:plan` to
choose the active run first.
