# State Convention

Default state root: `.agents/pi/`

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
    "T02": {
      "status": "failed",
      "updated_at": "ISO-8601",
      "failure_reason": "code_quality below threshold: unhandled error in auth.ts:42",
      "blocked_by": null,
      "action_on_resume": "read evaluations/build-pass-1.json, start repair pass 2"
    },
    "T03": {
      "status": "blocked",
      "updated_at": "ISO-8601",
      "blocked_by": "T02",
      "blocked_kind": "failed",
      "failure_reason": "dependency T02 failed"
    }
  },
  "started_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

The `task_progress` map tracks per-task status during the execute phase. Each
entry uses one of five statuses: `not_started`, `in_progress`, `complete`,
`failed`, or `blocked`.

**Optional fields on task_progress entries:**

- `failure_reason` (string) — short natural-language description of why the task
  failed. Written when the evaluator fails a task or when repair budget is
  exhausted. Max ~100 characters.
- `blocked_by` (task ID or null) — which task is directly blocking this one.
  Populated by dependency propagation when a dependency fails or is itself
  blocked (see transition points 6-7 below). Null for tasks that are not blocked.
- `blocked_kind` (`"failed"` or `"blocked"`) — why the blocking task caused this
  block. `"failed"` means the direct dependency itself failed. `"blocked"` means
  the direct dependency was transitively blocked by an earlier failure.
- `action_on_resume` (string) — prescriptive one-liner that pre-computes the
  coordinator's next step. Written alongside `failure_reason`. On cold resume,
  the coordinator reads this field to know what to do next without re-reading
  evaluation files.

**Transition points:**

1. Task starts its first build pass -> `in_progress`
2. Build pass completes and evaluator passes the task -> `complete`
3. Evaluator fails the task -> `failed`; write `failure_reason` and
   `action_on_resume`
4. Repair pass starts on a failed task -> `in_progress`
5. Phase transition (execute -> review) — all non-failed, non-blocked tasks
   should be `complete`
6. Dependency of a failed task (repair budget exhausted) -> `blocked` (only
   when `execution_policy.dependency_failure` is `block_downstream`); write
   `blocked_by` (the failed task ID), `blocked_kind: "failed"`, and
   `failure_reason`. When `skip_downstream`, leave as `not_started` and skip
   in the current run.
7. Dependency of a blocked task -> `blocked` (transitive, only when
   `block_downstream`); write `blocked_by` (the blocked task ID),
   `blocked_kind: "blocked"`, and `failure_reason`

Update `state.json` whenever the phase or step changes, or a build / repair /
review pass completes.

## Rubric Convention

`rubric.json` contains three top-level sections:

- `criteria` — rubric scoring dimensions with thresholds
- `execution_policy` — runtime behavior policy
- `max_repair_passes` — hard cap on repair iterations

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
  "execution_policy": {
    "codex_policy": "optional",
    "degraded_mode": "warn_and_continue",
    "dependency_failure": "block_downstream"
  },
  "max_repair_passes": 2
}
```

### `execution_policy` fields

- `codex_policy`: `required` | `optional` (default) | `skip` — controls whether
  Codex CLI critique is attempted at each checkpoint. `required` blocks
  progression if Codex is not available. `optional` defers to `degraded_mode`
  when Codex is not available. `skip` does not attempt Codex at all.
- `degraded_mode`: `warn_and_continue` (default) | `block` — applies only when
  `codex_policy` is `optional` and Codex is not available. `warn_and_continue`
  notes the absence and proceeds. `block` halts until the dependency is
  available. Ignored when `codex_policy` is `required` (always blocks) or
  `skip` (never attempts).
- `dependency_failure`: `block_downstream` (default) | `skip_downstream` —
  what happens to tasks that depend on a failed task. `block_downstream` sets
  their status to `blocked`. `skip_downstream` leaves them as `not_started`
  but skips them in the current run.

The coordinator reads `execution_policy` at load time and uses its values for
branching decisions (Codex availability, degraded mode, dependency failure
handling) instead of interpreting prose rules.
