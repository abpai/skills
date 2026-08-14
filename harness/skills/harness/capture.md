# Capture current behavior

Add a change detector before modifying legacy, undocumented, or under-tested
behavior. Capture what the code does now, not what it should do.

For repository-wide work, load `./baseline.md`. This module owns one behavior
surface or one ratified inventory row.

Before editing, load `./references/characterization-rules.md`.

## Workflow

### 1. Scope the observable boundary

Identify the consumer-visible behavior at risk: public function output, API or
CLI contract, rendered UI, emitted event, or persisted shape. Read its callers
and existing proof. Do not characterize unrelated helpers.

### 2. Choose the cheapest faithful proof

- Pure logic: unit characterization.
- I/O, integration, or serialized shape: integration, golden, snapshot, or
  contract proof.
- Rendered UI: snapshot or screenshot at the stable user-visible boundary.

Use representative existing fixtures or sanitized real cases when available.
Keep assertions narrow enough to explain a failure.

### 3. Prove it against unchanged code

Write only tests, fixtures, snapshots, mocks, or required test configuration
unless the user separately authorizes a product fix. Run the proof against the
unchanged implementation. Repeat it when practical to expose flakes.

A test that fails against current behavior is not characterization evidence.
Correct the test or record a gap. If current behavior appears wrong, pin it as
observed and report the suspected bug separately.

### 4. Report

Return:

- behavior and boundary captured;
- proof type, paths, command, result, and candidate;
- uncovered behavior and why;
- suspected bugs captured without correction.

Standalone capture does not create or update the repository-wide ledger.

## Baseline row mode

When called from `./baseline.md`, accept one ratified `BehaviorRow` from
`./INTERFACES.md` and return one `LedgerRow`:

- `captured` — proof passed;
- `bug-pinned` — suspicious current behavior was faithfully captured;
- `gap` — safe deterministic proof is unavailable;
- `failed` — an attempted capture was abandoned with evidence;
- `stale` — the inventory entry no longer maps to current code.

Skip rows outside the requested priority or without `confirmed`/`corrected`
status. Proof-backed rows must name test paths, the run command, evidence, and
candidate. Other outcomes must name the blocker.

## Completion

Capture is complete only when the new proof passes against unchanged code and
all remaining gaps are explicit. Writing a test without running it is not
completion.
