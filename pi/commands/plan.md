---
description: Turn a project request into a brief, rubric, and ordered task slices. Interactive planner phase for long-running engineering work.
argument-hint: "[project goal]"
allowed-tools: >
  Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *)
  Bash(git rev-parse *) Bash(git add *) Bash(git commit *)
  Bash(codex *) Bash(cat .agents/pi/*) Bash(ls .agents/pi/*)
  Read Write Edit Grep Glob
---

## Pi state snapshot

```!
echo "PI_PLAN_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -30
test -f .agents/pi/state.json && cat .agents/pi/state.json || echo "no pi state"
test -d .agents/pi/tasks && ls -1 .agents/pi/tasks 2>/dev/null
timeout 3 codex --version 2>&1 || echo "codex: not installed"
```

The block above runs at skill-load time. Treat its output as ground truth for
working-tree state, existing Pi state under `.agents/pi/`, and Codex CLI
availability. The Codex availability line feeds directly into the
`codex_policy` branch in Phase D.

Read the pi-protocol skill (`skills/pi-protocol/SKILL.md` in this plugin) and execute **Phase 1: Plan**.

User input: $ARGUMENTS

Default state directory: `.agents/pi/`

## Coordinator Pipeline

You (the main thread) are the coordinator. Subagents cannot spawn other
subagents, so you own all agent orchestration. Execute these phases in order.

**SendMessage rule:** When relaying information to a running subagent via
`SendMessage`, always include the `summary` field (5-10 word preview). The
tool requires it when `message` is a string. Example:
`SendMessage({ to: "planner", summary: "User chose selective posture", message: "..." })`

### Phase A — Interactive Planning (foreground planner)

1. Spawn `planner` as a **foreground** subagent with the user's request and
   repo context. The planner runs steps 1-4: posture check, clarify, lateral
   thinking, and distill.
2. The planner may return early with questions for the user. When this
   happens, relay the question via `AskUserQuestion`, then send the answer
   back to the planner via `SendMessage` (with `summary`). Repeat until the
   planner completes all four steps. If the planner has fully terminated,
   spawn a fresh planner with the accumulated context instead.
3. When the planner is done, read the primitives from state files:
   `state.json`, `research/lateral-thinking.md`.

### Phase B — Parallel Research (coordinator-driven)

4. Update `state.json`: `current_step` = `"research_fanout"`.
5. For each primitive, spawn **both** `claude-researcher` and
   `codex-researcher` in parallel. All researchers run simultaneously.
   - Pass each researcher: the primitive name/description, brief context,
     posture, repo state, and the output file path under `research/fanout/`.
6. When all researchers complete, read all result files from `research/fanout/`.
7. Update `state.json`: `current_step` = `"verify_tech"`.
8. Build a **consensus matrix**: compare Claude vs Codex recommendations per
   primitive. Where they agree, adopt the recommendation. Where they disagree,
   present the disagreement as a tiebreak for the user to resolve.
9. Present the matrix to the user and collect tiebreak decisions.
10. Write `research/consensus-matrix.md`.

### Phase C — Task Proposal (foreground planner)

11. Update `state.json`: `current_step` = `"propose_tasks"`.
12. Spawn a **fresh** `planner` (foreground) with the primitives and resolved
    tech decisions as context. The planner proposes ordered task slices with
    specific test criteria.
13. The planner presents tasks to the user for confirmation.

### Phase D — Iterative Codex Review (coordinator-driven)

14. Update `state.json`: `current_step` = `"codex_review"`.
15. Spawn `codex-reviewer` pass 1: review brief + tasks for gaps, risks, and
    test adequacy. Save to `reviews/codex-plan-pass-1.json`.
    - Incorporate `must_address` items into the plan.
    - Note `nice_to_have` items.
16. If pass 1 found issues: spawn `codex-reviewer` pass 2 on the updated plan.
    Save to `reviews/codex-plan-pass-2.json`.
    - If clean (`changed: false`), skip pass 3.
17. If pass 2 found issues: spawn `codex-reviewer` pass 3. Remaining issues
    become noted risks. Save to `reviews/codex-plan-pass-3.json`.

If the Codex CLI is not available, check `execution_policy` from
`rubric.json`. If `codex_policy` is `skip`, skip Phase D silently. If
`codex_policy` is `required`, halt and inform the user. If `codex_policy` is
`optional`, apply `degraded_mode`: `warn_and_continue` — warn the user and
skip to Phase E; `block` — halt and inform the user.

### Phase E — Finalize

18. Update `state.json`: `current_step` = `"finalize"`.
19. Present the final plan to the user: brief summary, consensus matrix,
    codex review results, ordered tasks, noted risks.
20. On approval, write: `brief.md`, `rubric.json`, `tasks/*.json`, and
    update `state.json` with `"phase": "execute"`.

Follow the protocol exactly. Do not skip the human checkpoints.
