---
description: Turn a project request into a brief, rubric, and ordered task slices. Interactive planner phase for long-running engineering work.
argument-hint: "[project goal]"
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
echo "PI_PLAN_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -30
test -f .agents/work/current.json && cat .agents/work/current.json || echo "no active run"
ls -1 .agents/work/runs 2>/dev/null || echo "no runs"
timeout 3 codex --version 2>&1 || echo "codex: not installed"
timeout 3 gemini --version 2>&1 || echo "gemini: not installed"
```

The block above runs at skill-load time. Treat its output as ground truth for
working-tree state, active-run discovery under `.agents/work/`, and Codex CLI
availability. The coordinator must still re-read the chosen run's
`state.json` before acting; the preflight is advisory. The Codex availability
line feeds directly into the `codex_policy` branch in Phase D.

Read the Pi protocol module (`internal/protocol/README.md` in this plugin) and execute **Phase 1: Plan**.

User input: $ARGUMENTS

Active state root: `.agents/work/runs/<slug>/` via `.agents/work/current.json`

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration. Execute these phases in order.

**SendMessage rule:** When relaying information to a running subagent via
`SendMessage`, always include the `summary` field (5-10 word preview). The
tool requires it when `message` is a string. Example:
`SendMessage({ to: "planner", summary: "User chose selective posture", message: "..." })`

### Phase 0 — Select or Create a Run

1. Read `.agents/work/current.json` if present.
2. List `.agents/work/runs/*/` to discover known runs.
3. If runs already exist, ask whether to resume the active run, switch to an
   existing run, create a new run, or abort.
4. When creating a new run, derive the default slug from the user's request
   and show it to the user. Check for collisions by comparing against the
   existing directories under `.agents/work/runs/`. Do not force a slug
   question if `.agents/work/runs/<derived-slug>/` does not already exist and
   the user does not want to rename it.
5. Once a slug is selected, set `state_root = .agents/work/runs/<slug>/` and
   use that root for every read/write below. Refresh `.agents/work/current.json`
   whenever the active run changes.

### Phase A — Interactive Planning (foreground planner)

1. **Select critics for this run.** Use `AskUserQuestion` with four options:
   - `None` — Claude-only. No Codex, no Gemini.
   - `Codex only` — default. Codex researches and reviews; Gemini skipped.
   - `Gemini only` — Gemini researches and reviews; Codex skipped.
   - `Codex + Gemini` — both run in parallel during research and review.
     Tiebreaks surface when they disagree.

   Default to `Codex only` if the preflight showed Gemini is not installed.
   Persist the choice in memory for this phase; it is written into
   `rubric.json.research_policy.providers` during Phase E finalize. The
   coordinator gates Phase B researchers, Phase D plan reviewers, the
   Phase 2 build reviewer, and the Phase 3 final reviewer on this field.
2. Spawn `planner` as a **foreground** subagent with the user's request and
   repo context. The planner runs steps 1-4: posture check, clarify, lateral
   thinking, and distill.
3. The planner may return early with questions for the user. When this
   happens, relay the question via `AskUserQuestion`, then send the answer
   back to the planner via `SendMessage` (with `summary`). Repeat until the
   planner completes all four steps. If the planner has fully terminated,
   spawn a fresh planner with the accumulated context instead.
4. When the planner is done, read the primitives from files in `state_root`:
   `state.json`, `research/lateral-thinking.md`.

### Phase B — Parallel Research (coordinator-driven)

5. Update `state.json` in `state_root`: `current_step` = `"research_fanout"`.
6. For each primitive, spawn researchers in parallel. Always spawn
   `claude-researcher`. Additionally, for each provider in
   `research_policy.providers`:
   - `codex` → spawn `codex-researcher`, output path
     `research/fanout/<primitive>-codex.json`
   - `gemini` → spawn `gemini-researcher`, output path
     `research/fanout/<primitive>-gemini.json`

   Pass each researcher: the primitive name/description, brief context,
   posture, repo state, and the output file path under `research/fanout/`
   in `state_root`. If the providers list is empty (Claude-only), spawn
   only `claude-researcher`.
7. When all researchers complete, read all result files from
   `research/fanout/` in `state_root`.
8. Update `state.json` in `state_root`: `current_step` = `"verify_tech"`.
9. Build a **consensus matrix**: compare recommendations per primitive across
   every researcher that ran. Where they agree, adopt the recommendation.
   Where they disagree, present the disagreement as a tiebreak for the user
   to resolve. If only `claude-researcher` ran, there is nothing to compare
   against — skip the tiebreak UI and record the Claude recommendations
   directly.
10. Present the matrix to the user and collect tiebreak decisions.
11. Write `research/consensus-matrix.md` in `state_root`.

### Phase C — Task Proposal (foreground planner)

12. Update `state.json` in `state_root`: `current_step` = `"propose_tasks"`.
13. Spawn a **fresh** `planner` (foreground) with the primitives and resolved
    tech decisions as context. The planner proposes ordered task slices with
    specific test criteria.
14. The planner presents tasks to the user for confirmation.

### Phase D — Iterative External Review (coordinator-driven)

15. Update `state.json` in `state_root`: `current_step` = `"codex_review"`
    (name preserved for state compatibility; the step runs whichever critics
    are in `research_policy.providers`).
16. For each provider in the selection, run up to 3 iterative review passes
    against the brief + tasks. Save each pass as
    `reviews/<provider>-plan-pass-<N>.json` in `state_root` (e.g.
    `codex-plan-pass-1.json`, `gemini-plan-pass-1.json`).
    - Pass 1: review for gaps, risks, and test adequacy. Incorporate
      `must_address` items directly into the plan; note `nice_to_have`.
    - Pass 2: re-run on the updated plan. If clean (`changed: false`), skip
      pass 3.
    - Pass 3 (if needed): remaining issues become noted risks, not blockers.
    When the providers list contains both `codex` and `gemini`, run them in
    parallel per pass and merge their `must_address` items before re-running.
17. If no providers are selected (`providers: []`), skip Phase D entirely.

If a selected CLI is not available, check `execution_policy` from
`rubric.json`. For Codex, `codex_policy` governs the fallback as before. For
Gemini, reuse the same policy semantics (warn and continue on optional;
block on required). Record the absence in the noted risks for Phase E.

### Phase E — Finalize

18. Update `state.json` in `state_root`: `current_step` = `"finalize"`.
19. Present the final plan to the user: brief summary, consensus matrix,
    review results from each selected provider, ordered tasks, noted risks.
20. On approval, write `brief.md`, `rubric.json`, and `tasks/*.json` in
    `state_root`. Set `rubric.json.research_policy.providers` from Phase A
    step 1. Update `state.json` in `state_root` with `phase: "execute"`,
    `project_slug`, `title`, the resolved `state_root`, and refresh the
    `orchestrator.last_command_cli` field. Then refresh
    `.agents/work/current.json`.

Follow the protocol exactly. Do not skip the human checkpoints.
