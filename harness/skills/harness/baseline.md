# Behavior baseline

Capture what an existing repository does before agents begin changing it at
scale. The baseline separates human-owned intent from machine-owned evidence:

- `docs/BEHAVIOR_INVENTORY.md` is the human-ratified behavior map.
- `docs/BEHAVIOR_LEDGER.md` records runnable proof for those behaviors.

Use an equivalent repo-owned surface when it already provides the same stable
join between behavior, human intent, and proof.

## Routing

- `baseline status` — summarize artifacts and the next action.
- `baseline scout` — inspect behavior and existing proof without editing.
- `baseline inventory [--refresh]` — draft or refresh the inventory, then stop
  for human ratification.
- `baseline capture` — capture confirmed/corrected rows into the ledger.
- no stage — resume from the first unfinished phase on disk.

Files, not chat memory, define progress.

## 1. Check the toolchain

Record the revision and working tree. Discover bootstrap, build, test, and
validation commands from repository-owned configuration and docs. Inspect
command bodies before running them under `./doctor.md`'s execution policy.

Classify the result:

- `toolchain-ready-green` — safe commands run and pass.
- `tests-runnable-red` — the runner works but existing tests fail.
- `no-test-harness` — no executable validation exists.
- `toolchain-broken` — local tooling cannot execute.
- `env-blocked` — required safe services or credentials are unavailable.

Continue only where new proof can run safely against unchanged code. Record the
classification and command evidence above the inventory table.

## 2. Scout observable behavior

Inspect public APIs, routes, CLI commands, UI flows, persisted shapes, jobs,
permissions, money movement, external integrations, and existing tests or
fixtures. Describe consumer-visible behavior, not private implementation.

Use concrete entry-point and proof paths. Rank by risk and centrality. Keep the
ratification set small enough for a human to review; defer the long tail rather
than manufacturing exhaustive low-value rows.

## 3. Draft the inventory

Use `./templates/BEHAVIOR_INVENTORY.md` and the `BehaviorRow` contract in
`./INTERFACES.md`.

- Preserve stable IDs during refresh.
- Draft rows as `proposed`; only a human sets `confirmed`, `corrected`, `skip`,
  or `deferred`.
- Mark a row `stale` when its entry point disappeared and no replacement was
  found.
- Name specific existing proof or the exact missing proof.

Stop after writing the inventory. Ask the human to review status, priority, and
notes. Do not begin repo-scale capture without this gate.

## 4. Capture ratified behavior

For confirmed/corrected P0 and P1 rows without terminal ledger outcomes, load
`./capture.md` in row mode. Capture current behavior, including suspected bugs,
against unchanged production code. Use existing test conventions and the
cheapest level that observes the consumer boundary.

One failed row does not abort the pass. Record `gap`, `failed`, or `stale` with
the blocker and continue. Never use live production data, paid APIs, or
irreversible actions to make a characterization test pass.

## 5. Update the ledger

Use `./templates/BEHAVIOR_LEDGER.md` and the `LedgerRow` contract in
`./INTERFACES.md`. Proof-backed rows name real test paths, the exact command,
the result, and the candidate revision. A missing ledger row means capture is
still pending; do not invent a `pending` ledger status.

## Status and completion

Report the toolchain state; inventory totals by human status; ledger totals by
outcome; high-risk gaps; last verified revision; and one next action.

Baseline is complete when every confirmed/corrected P0/P1 row has a terminal
ledger outcome, proof-backed rows ran against unchanged code, and Doctor has
checked the final artifacts. Gaps may remain, but they must be explicit.
