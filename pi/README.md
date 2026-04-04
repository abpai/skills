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

1. `planner` turns the request into a brief, rubric, and ordered task slices.
2. `generator` drafts a contract for the current slice, then executes it as one
   coherent generation pass.
3. `evaluator` tightens that contract, runs verification, grades the build, and
   drives narrow repairs.

Codex is optional second-provider input at two points only:

- plan-time research or architecture critique
- independent review of the latest diff before signoff

Pi is intentionally a Claude plugin only. It uses the `codex` CLI as a
supporting tool, but it is not meant to be installed as a Codex plugin.

## Mental Model

Think of Pi like this:

- `planner` decides what we are building
- `generator` tries to build it
- `evaluator` decides whether it actually clears the bar
- Codex is an optional outside critic, not a co-pilot in the control loop

## Flow Diagram

```text
user
  |
  +--> /pi:plan
  |      |
  |      +--> planner
  |      |      writes brief + rubric + task slices
  |      |
  |      +--> optional codex-researcher / codex-reviewer
  |      |
  |      \--> human approval
  |
  +--> /pi:execute
  |      |
  |      +--> generator drafts contract for current slice
  |      |
  |      +--> evaluator tightens the contract
  |      |
  |      +--> generator builds
  |      |
  |      +--> optional code-simplifier
  |      +--> optional codex-reviewer
  |      |
  |      +--> evaluator verifies + scores
  |      |
  |      +--> pass? ---- yes ---> next slice / review
  |                 |
  |                 \---- no ---> narrow repair pass
  |
  \--> /pi:review
         |
         +--> full verification
         +--> evaluator final scorecard
         +--> optional final Codex read
         \--> human review
```

## Commands

| Command | Phase | What it does |
| --- | --- | --- |
| `/pi:plan` | Plan | Clarify -> distill -> write brief -> create rubric and task slices -> optional Codex critique |
| `/pi:execute` | Execute | Run the generator loop -> optional cleanup -> evaluate -> focused repair passes |
| `/pi:review` | Review | Run final verification -> holistic evaluation -> present scorecard and remaining gaps |

## Agents

| Agent | Role |
| --- | --- |
| `planner` | Claude primary planner for the brief, rubric, and task slices |
| `generator` | Claude primary generator for the main implementation run and repair passes |
| `evaluator` | Claude primary QA and rubric grader |
| `codex-researcher` | Optional second-provider research and tie-break agent |
| `codex-reviewer` | Optional second-provider plan or diff critic |

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

Backward compatibility:

- If `.agents/pi/` already exists, keep using it.
- If an older run only has `.agents/plan/`, Pi can continue there or migrate it
  once before new work starts.

## File Diagram

This is the artifact flow Pi tries to maintain:

```text
/pi:plan
  |
  +--> .agents/pi/state.json
  +--> .agents/pi/brief.md
  +--> .agents/pi/rubric.json
  +--> .agents/pi/tasks/T01.json ...
  +--> .agents/pi/research/codex/*        (optional)
  \--> .agents/pi/reviews/codex-plan.json (optional)

/pi:execute
  |
  +--> .agents/pi/contracts/T01.md ...
  +--> code changes in the target repo
  +--> .agents/pi/evaluations/build-pass-1.json
  +--> .agents/pi/evaluations/build-pass-2.json
  \--> .agents/pi/state.json updates after each pass

/pi:review
  |
  +--> .agents/pi/reviews/codex-final.json (optional)
  +--> .agents/pi/evaluations/review.json
  +--> .agents/pi/LEARNINGS.md
  \--> .agents/pi/state.json => done
```

## Why This Shape

This plugin intentionally follows the simplified harness pattern Anthropic
described for long-running application work: planner -> generator -> evaluator,
with repair loops only when evaluation proves they are needed.

Compared with the original Pi draft, this version removes several sources of
drag:

- no mandatory per-task sprint grading
- no required Codex fanout for every primitive
- no automatic code-simplifier pass after every step
- no hook-based orchestration
- no per-attempt commit requirement inside the generator loop

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
