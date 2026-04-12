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
4. `evaluator` runs per-task verification, incorporates Codex review, grades
   the build, and drives narrow repairs.

By default, Codex is the second-provider critic at every phase checkpoint:

- parallel research fanout during planning (Claude + Codex per primitive)
- iterative plan critique before approval (up to 3 passes)
- diff review after each build/repair pass
- final independent read before signoff

Behavior when Codex is not available is governed by
`execution_policy` in `rubric.json`.

Pi is intentionally a Claude plugin only. It uses the `codex` CLI as a
supporting tool, but it is not meant to be installed as a Codex plugin.

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
  \--> /pi:review (coordinator pipeline, Phases A-D)
         |
         +--> Phase A: load prerequisites
         +--> Phase B: full suite + per-task verification
         +--> Phase C: codex-reviewer + evaluator final pass
         \--> Phase D: scorecard + learnings → human review
```

## Commands

| Command | Phase | What it does |
| --- | --- | --- |
| `/pi:plan` | Plan | Posture -> clarify -> lateral thinking -> distill -> parallel research fanout -> consensus matrix -> task slices -> iterative Codex critique |
| `/pi:execute` | Execute | Per-task: draft contract -> build -> Codex review -> evaluate with per-task verification -> task-scoped repair |
| `/pi:review` | Review | Full suite + per-task verification -> Codex final read -> scorecard with consensus matrix cross-reference |

## Agents

| Agent | Role |
| --- | --- |
| `planner` | Claude primary. Interactive planning (foreground subagent). Spawned twice: once for posture/clarify/lateral-thinking/distill, once for task proposal. |
| `claude-researcher` | Claude primary. 3-layer research per primitive (boring/trending/first-principles). |
| `generator` | Claude primary. Coherent implementation against the active contract. |
| `evaluator` | Claude primary. Per-task verification, rubric scoring, incorporates Codex review from coordinator. |
| `codex-researcher` | Codex secondary. Parallel 3-layer research per primitive via Codex CLI. |
| `codex-reviewer` | Codex secondary. Mandatory plan critique (up to 3 passes), build review, and final review. |

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

Pi writes state under `.agents/pi/` by default:

```text
.agents/pi/
├── state.json
├── brief.md
├── rubric.json
├── tasks/
├── contracts/
├── research/
├── reviews/
├── evaluations/
└── LEARNINGS.md
```

## File Diagram

This is the artifact flow Pi tries to maintain:

```text
/pi:plan
  |
  +--> .agents/pi/state.json
  +--> .agents/pi/brief.md
  +--> .agents/pi/rubric.json
  +--> .agents/pi/tasks/T01.json ...
  +--> .agents/pi/research/lateral-thinking.md
  +--> .agents/pi/research/fanout/*-claude.json, *-codex.json
  +--> .agents/pi/research/consensus-matrix.md
  \--> .agents/pi/reviews/codex-plan-pass-{1,2,3}.json

/pi:execute
  |
  +--> .agents/pi/contracts/T01.md ...
  +--> code changes in the target repo
  +--> .agents/pi/reviews/codex-build-{N}.json
  +--> .agents/pi/evaluations/build-pass-{N}.json
  \--> .agents/pi/state.json (task_progress updated per task)

/pi:review
  |
  +--> .agents/pi/evaluations/suite-results.json
  +--> .agents/pi/reviews/codex-final.json
  +--> .agents/pi/evaluations/review.json
  |
  +--> if passing:
  |      +--> .agents/pi/LEARNINGS.md
  |      \--> .agents/pi/state.json => done
  \--> if failing:
         \--> .agents/pi/state.json => execute (repair cycle)
```

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
# Create the brief interactively
/pi:plan Build a real-time collaboration engine for our editor

# Run the main generation and repair loop
/pi:execute

# Run final review and score the result
/pi:review
```

Each phase reads `state.json` on entry and resumes instead of restarting by
default.
