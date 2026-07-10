# Harness Capture

Characterize a repo's **current** behavior before an agent changes it. This is
the harness's first job on legacy or under-tested code: an agent asked to modify
code with no verification net cannot tell a fix from a regression, so first pin
what the system does today, then change it against that net.

Use this workflow when the user is about to have an agent modify legacy,
undocumented, or under-tested code; asks to "capture behavior," "add a safety
net," "characterize this before we touch it," or lock current behavior before a
refactor or migration.

If the request is repo-scale rather than one behavior surface — for example
"capture baseline", "baseline this repo", "capture all existing behavior", or
"prepare this production repo for agents" — route to `baseline.md` instead of
continuing here. This module owns scoped capture; `baseline.md` owns inventory,
human ratification, and the repo-wide capture loop.

For fleet-scale repo adoption, `baseline.md` is the orchestrator and this module
is the primitive. In row mode, `baseline.md` passes one ratified `BehaviorRow`
and this module returns one `LedgerRow`.

Before writing characterization tests or snapshots, load
`./references/characterization-rules.md` and follow it. If that file is
unavailable, continue with the Boundary, Snapshot hygiene, Determinism,
Assertion budget, Failure semantics, and Source edits rules described below, and
report that the shared reference could not be read.

## The one rule that matters

**Capture what the code *does*, not what it *should* do.** Characterization tests
are change-detectors, not correctness oracles — they encode current behavior,
bugs included. Do not "fix" behavior while capturing it, and do not assert the
behavior you wish were true. If you find behavior that looks like a bug, capture
it as-is so the net is faithful, and record it separately in the coverage-gap
report as a suspected bug for a human to rule on — never silently encode a
guess about intended behavior. A characterization suite that lies about current
behavior is worse than none: it green-lights a regression as correct.

## Standalone process

### 1. Scope the behavior surface at risk

Identify the code the upcoming change will touch and the observable behavior that
must not silently change: public functions, API endpoints, CLI output, rendered
UI, emitted events, persisted shapes. Read the code and its callers to find the
real boundary — capture at the seams a consumer depends on, not every private
helper. Out-of-scope code is not captured; note it.

### 2. Choose the capture level per behavior

Match the test level to where the behavior is observable, preferring the
cheapest level that actually pins it:

- **Pure logic** → unit characterization tests: feed representative + edge inputs,
  record the actual outputs as the expectations.
- **I/O, integration, serialized shapes** → integration tests or golden/snapshot
  files (recorded responses, fixture DB state, serialized output).
- **Rendered UI** → snapshot or screenshot baseline for the current render.

Seed inputs from real usage where you can (existing fixtures, logs, sample data),
not invented cases — the net should cover what users actually exercise.

### 3. Capture against the current code and confirm green

Write the tests/snapshots, then run them against the **unchanged** code. They
must pass now — a characterization test that fails against current behavior was
written wrong (you asserted a wish, not the behavior). Record what ran. These
tests then live as the enforcement surface (per `docs.md`'s enforcement
hierarchy) that catches regressions when the agent makes its change.

### 4. Report the capture report and coverage gaps

- **Capture report** — a table of `behavior | capture level | test/snapshot
  file | seed source`, listing exactly what is now pinned. Standalone capture
  does not write `docs/BEHAVIOR_LEDGER.md`; that machine-readable file is owned
  by `baseline.md` row mode and requires stable behavior IDs.
- **Coverage-gap report** — behavior in scope that you could *not* pin and why
  (non-deterministic without a seam, needs a live external service, timing-
  dependent), plus suspected bugs captured as-is. These gaps are where an agent's
  change is still unguarded — name them so the human knows the net has holes,
  and route durable ones to `docs/todos` or the enforcement hierarchy.

## Completion

Capture is done when: the behavior surface at risk is scoped; characterization
tests/snapshots exist at the right level and **pass against the current code**
(run, not assumed); the capture report and coverage-gap report are written; and
suspected bugs are flagged separately rather than encoded as intended behavior.
Not done because tests were written — done when they run green against today's
code and the gaps are named.

## Row mode for `baseline.md`

Use row mode only when invoked by `baseline.md` with a ratified behavior row.
Input shape is defined in `./INTERFACES.md`:

- `BehaviorRow.id`
- `BehaviorRow.area`
- `BehaviorRow.behavior`
- `BehaviorRow.entryPoints`
- `BehaviorRow.existingProof`
- `BehaviorRow.missingProof`
- `BehaviorRow.confidence`
- `BehaviorRow.risk`
- `BehaviorRow.status`
- `BehaviorRow.priority`
- `BehaviorRow.notes`

Process:

1. Confirm the row status is `confirmed` or `corrected` and priority is in the
   requested capture scope (`P0`/`P1` by default). Otherwise return no ledger
   entry and explain why it was skipped.
2. Read the entry-point files and existing proof named by the row. If the entry
   point is gone, return `stale`.
3. Choose the cheapest capture type that tests the observable boundary:
   `unit`, `integration`, `golden`, `snapshot`, `screenshot`, or `contract`.
4. Add or extend tests using existing repo conventions. Do not modify product
   source unless the user explicitly authorizes a separate repair task.
5. Run the proof command against unchanged code. Run two or three times when
   practical to catch flakes.
6. Return a `LedgerRow` with status:
   - `captured` when proof passed.
   - `bug-pinned` when current behavior appears wrong but was pinned as
     observed.
   - `gap` when safe capture is blocked by environment, credentials,
     nondeterminism, missing harness, or no stable boundary.
   - `failed` when a capture attempt was abandoned with a reason.
   - `stale` when the inventory row no longer maps to current code.

Row mode is complete only when the returned ledger row names the test paths and
run command for proof-backed statuses, or names the blocker for gap/failed/stale
statuses.
