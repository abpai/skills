# State Convention

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
│   ├── lateral-thinking.md
│   ├── fanout/
│   │   ├── <primitive>-claude.json
│   │   ├── <primitive>-codex.json
│   │   └── ...
│   └── consensus-matrix.md
├── reviews/
│   ├── codex-plan-pass-1.json
│   ├── codex-plan-pass-2.json
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
  "current_step": "posture|clarify|lateral_thinking|distill|research_fanout|verify_tech|propose_tasks|codex_review|finalize|build|repair|review",
  "state_root": ".agents/pi",
  "build_pass": 0,
  "repair_pass": 0,
  "codex_review_pass": 0,
  "research_fanout": {
    "primitives_total": 0,
    "primitives_complete": 0,
    "tiebreaks_pending": 0
  },
  "task_progress": {
    "T01": { "status": "not_started", "updated_at": "ISO-8601" },
    "T02": { "status": "not_started", "updated_at": "ISO-8601" }
  },
  "started_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

The `task_progress` map tracks per-task status during the execute phase. Each
entry uses one of four statuses: `not_started`, `in_progress`, `complete`, or
`failed`.

**Transition points:**

1. Task starts its first build pass -> `in_progress`
2. Build pass completes and evaluator passes the task -> `complete`
3. Evaluator fails the task -> `failed`
4. Repair pass starts on a failed task -> `in_progress`
5. Phase transition (execute -> review) — all non-failed tasks should be `complete`

Update `state.json` whenever the phase or step changes, or a build / repair /
review pass completes.
