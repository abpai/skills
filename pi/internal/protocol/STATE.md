# State Convention

Pi uses `.agents/work/` as a namespace root. The namespace is intentionally
frontend-agnostic: other CLIs (a forked omx, a Codex-native wrapper, etc.)
can target the same schema.

- Active run pointer: `.agents/work/current.json`
- Default run state root: `.agents/work/runs/<slug>/`

Recommended layout:

```text
.agents/work/
├── current.json
└── runs/
    └── <slug>/
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
        ├── artifacts/
        │   └── layout-options.html
        ├── checkpoints/
        │   └── build-pass-<N>-<task-id>.json
        └── LEARNINGS.md
```

`checkpoints/` holds a short-lived handoff record written when a generator
finishes and deleted when the matching `evaluations/build-pass-<N>.json`
lands. It exists so a coordinator that stops mid-handoff can resume into
review/evaluation instead of re-running the generator. See the handoff
lifecycle notes below.

`artifacts/` holds durable human-facing planning or review artifacts. For UI
work, `/pi:plan` writes `artifacts/layout-options.html`; the selected direction
is recorded in `research/ui-layout-decision.md`.

`current.json` is a checkout-local pointer to the active run, for example:

```json
{
  "slug": "durable-handoffs",
  "updated_at": "ISO-8601"
}
```

Minimal `state.json`:

```json
{
  "phase": "plan|execute|review|done",
  "posture": "expand|selective|reduce",
  "current_step": "posture|clarify|lateral_thinking|distill|research_fanout|verify_tech|propose_tasks|codex_review|finalize|build|awaiting_review|awaiting_evaluator|repair|review",
  "state_root": ".agents/work/runs/durable-handoffs",
  "project_slug": "durable-handoffs",
  "title": "Durable handoffs",
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
  "updated_at": "ISO-8601",
  "orchestrator": {
    "last_command_cli": "claude",
    "updated_at": "ISO-8601"
  }
}
```

The optional `orchestrator` block records which frontend most recently wrote
state. `last_command_cli` is `"claude"`, `"codex"`, or `"other"`. The
coordinator refreshes it on every state write. Other frontends (e.g. a forked
omx) should do the same when they adopt the schema. The field is advisory
(telemetry / debugging); nothing in the pi protocol branches on it.

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

Selection rules:

- `/pi:plan` may create a new run or switch the active run before planning.
- `/pi:execute` and `/pi:review` resolve the run from `.agents/work/current.json`.
- If `current.json` is missing but exactly one run exists, auto-select it.
- If multiple runs exist and no active run is set, fail fast and tell the user
  to run `/pi:plan`.

## Handoff Lifecycle (execute phase)

The execute pipeline has a durability gap between "generator finished" and
"evaluation persisted" that resume must close. `current_step` walks through
finer values around that gap, paired with a `checkpoints/` artifact.

Transitions within a single build pass:

1. `build` — set before spawning generator.
2. `awaiting_review` — set **immediately after** the generator returns, before
   spawning `codex-reviewer`. `build_pass` is incremented at this transition
   (not after review/evaluation). The coordinator writes
   `checkpoints/build-pass-<N>-<task-id>.json` at the same time.
3. `awaiting_evaluator` — set after `codex-reviewer` writes its output, before
   spawning the evaluator.
4. Evaluator writes `evaluations/build-pass-<N>.json`. The coordinator deletes
   the matching checkpoint. `current_step` advances based on the pass/repair
   decision.

Checkpoint file shape:

```json
{
  "task_id": "T02",
  "build_pass": 4,
  "stage": "awaiting_review",
  "generator_summary": {
    "files_touched": ["path/to/file.ts"],
    "notes": "short description of what the generator did"
  },
  "timestamp": "ISO-8601"
}
```

Resume decision (Phase A of `/pi:execute`):

| `current_step`        | checkpoint present? | action                                          |
| --------------------- | ------------------- | ----------------------------------------------- |
| `build`               | n/a                 | enter Phase B from contract step                |
| `awaiting_review`     | yes                 | skip Phase B; enter Phase C at codex-reviewer   |
| `awaiting_review`     | no                  | treat pass as lost; re-enter Phase B            |
| `awaiting_evaluator`  | yes                 | skip Phase B; enter Phase C at evaluator spawn  |
| `awaiting_evaluator`  | no                  | treat pass as lost; re-enter Phase B            |
| `repair`              | n/a                 | enter Phase B with repair guidance              |
| `review`              | n/a                 | Phase E / transition to review phase            |

`action_on_resume` remains failure-oriented — it is written only when a task
is marked `failed`. Success-path resume is driven by `current_step` and the
checkpoint, not by `action_on_resume`.

## Rubric Convention

`rubric.json` contains three top-level sections:

- `criteria` — rubric scoring dimensions with thresholds
- `execution_policy` — runtime behavior policy
- `max_repair_passes` — hard cap on repair iterations

Default rubric shape: see [`templates/rubric.json`](templates/rubric.json)
for the canonical default. The file in this module's `templates/` directory
is the single source of truth; do not redefine it here.

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
- `primary_executor`: `claude` (default) | `codex` — who writes the code
  during `/pi:execute` Phase B. `claude` spawns the `generator` agent.
  `codex` spawns the `codex-executor` agent, which shells to `codex exec`
  with the active contract. All downstream checkpoints (diff review,
  evaluator scoring, repair loop, checkpoint persistence) are identical in
  both modes — only the builder changes. **Executor availability is a hard
  block:** if the selected executor's CLI is not installed, the coordinator
  halts. `codex_policy` governs critics only; it does not permit silent
  fallback to a different builder.

### `research_policy` fields

- `providers`: array of external critics that pi consults during research,
  plan review, build review, and final review. Valid entries are `codex` and
  `gemini`. Default `["codex"]` (today's behavior). Empty array means
  Claude-only: no external critics are spawned. `["gemini"]` runs Gemini in
  place of Codex. `["codex", "gemini"]` runs both in parallel; tiebreaks
  surface when they disagree.

The coordinator reads `execution_policy` and `research_policy` at load time
and branches on their values (Codex availability, degraded mode, dependency
failure handling, which builder to spawn, which critics to consult) instead
of interpreting prose rules.
