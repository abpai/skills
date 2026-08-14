# Harness artifact schemas

This file defines the structured Markdown artifacts that Harness workflows
produce and read inside a repository. It is an instruction-level schema catalog,
not a TypeScript API: the interfaces below document extracted shapes, and the
Markdown tables remain the source of truth.

Cross-system proposals for a software-factory consumer live in
`./FACTORY_HANDOFFS.md`. Do not treat those proposals as implemented contracts.

## Status catalog

| Artifact | Producer | Reader | Persistence | Enforcement |
| --- | --- | --- | --- | --- |
| `ProofRow` | `docs.md` | `doctor.md`, `evals.md`, `onboard.md` | `docs/SPEC_CONTRACT.md` | Harness workflow inspection; released scanner support is planned |
| `BehaviorRow` | `baseline.md` | `capture.md`, `doctor.md` | `docs/BEHAVIOR_INVENTORY.md` | Harness workflow inspection; released scanner support is planned |
| `LedgerRow` | `capture.md` | `baseline.md`, `doctor.md`, `onboard.md` | `docs/BEHAVIOR_LEDGER.md` | Harness workflow inspection; released scanner support is planned |
| `BaselineReport` | `baseline status` | human/operator | ephemeral output | Derived by the Harness workflow |

The schemas make agent output deterministic and reviewable today. They become
runtime contracts only when a concrete parser and consumer enforce them.

## Proof menu row

The proof menu in `docs/SPEC_CONTRACT.md` maps each change type to the evidence
required to accept it. Keep one human- and machine-readable Markdown table; do
not add parallel JSON that can drift.

Required columns, in this order:

```md
| Change type | Lane | Validation command | Proof artifact | Sufficiency |
| --- | --- | --- | --- | --- |
| API surface | full | `test:contract` | passing run + response trace | auto |
| Dashboard UI | full | `test:e2e` | screenshot pair | human-gate |
| Any change | fast | `lint` `typecheck` | passing run output | auto |
```

Rules:

- `Validation command` contains only command identifiers wrapped in backticks.
  Put evidence descriptions in `Proof artifact`.
- Use package-script IDs such as `test`, `lint`, or `ui:build`, not shell
  invocations. Use target or recipe IDs for Make and just. Use the exact signal
  name reported by the scanner for CI-only commands.
- `Lane` is `fast` or `full`. Completion binds to the full lane.
- `Sufficiency` is `auto` or `human-gate`. Never infer a missing value.
- `Change type` and `Proof artifact` are free human text.

Extracted shape:

```ts
interface ProofRow {
  changeType: string;
  lane: "fast" | "full";
  commands: string[];
  proofArtifact: string;
  sufficiency: "auto" | "human-gate";
}
```

Workflow checks:

- Reject missing or reordered required columns, prose in the command cell, and
  invalid lane or sufficiency values as unverifiable.
- Resolve every command ID through the discovered signals menu. A missing ID is
  a stale-proof-menu finding. Resolution proves existence, not successful
  execution.
- Report major change types in the signals menu that have no proof row.

## Behavior inventory row

`harness baseline` writes the human-ratified behavior map to
`docs/BEHAVIOR_INVENTORY.md`.

Required columns, in this order:

```md
| ID | Area | Behavior | Entry points | Existing proof | Missing proof | Confidence | Risk | Status | Priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | Auth | Google login | `src/auth/google.ts:42` | none | no e2e proof | high | high | confirmed | P0 |  |
```

Rules:

- `ID` matches `B-\d{3,}`, is unique, and stays stable across refreshes.
- `Entry points` contains concrete repo paths, preferably `file:line`.
- `Confidence` and `Risk` are `high`, `medium`, or `low`.
- `Status` is `proposed`, `confirmed`, `corrected`, `skip`, `deferred`, or
  `stale`.
- `Priority` is `P0`, `P1`, or `P2`.

Extracted shape:

```ts
interface BehaviorRow {
  id: string;
  area: string;
  behavior: string;
  entryPoints: string[];
  existingProof: string[];
  missingProof: string;
  confidence: "high" | "medium" | "low";
  risk: "high" | "medium" | "low";
  status: "proposed" | "confirmed" | "corrected" | "skip" | "deferred" | "stale";
  priority: "P0" | "P1" | "P2";
  notes: string;
}
```

## Behavior ledger row

`harness capture` writes proof outcomes to `docs/BEHAVIOR_LEDGER.md`. Stable IDs
join ledger rows to the inventory. A missing ledger row means capture is pending;
do not create a `pending` ledger status.

Required columns, in this order:

```md
| ID | Status | Capture type | Test paths | Run command | Run evidence | Confidence | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | captured | integration | `tests/auth/google.test.ts` | `pnpm test tests/auth/google.test.ts` | 3/3 green at abc123 | high |  |
```

Rules:

- `ID` references an inventory row.
- `Status` is `captured`, `bug-pinned`, `gap`, `failed`, or `stale`.
- `Capture type` is `unit`, `integration`, `golden`, `snapshot`, `screenshot`,
  `contract`, or `none`.
- `Test paths` for `captured` and `bug-pinned` rows name files that exist.
- `Run command` names the command that produced proof.
- `Run evidence` records the result and repository snapshot.
- `Confidence` is `high`, `medium`, or `low`.

Extracted shape:

```ts
interface LedgerRow {
  id: string;
  status: "captured" | "bug-pinned" | "gap" | "failed" | "stale";
  captureType: "unit" | "integration" | "golden" | "snapshot" | "screenshot" | "contract" | "none";
  testPaths: string[];
  runCommand: string;
  runEvidence: string;
  confidence: "high" | "medium" | "low";
  remainingGap: string;
}
```

Inventory and ledger checks:

- Require the exact headers above.
- Require valid, unique inventory IDs and valid enum values.
- Require every ledger ID to reference an inventory ID.
- Require terminal ledger outcomes for confirmed or corrected P0/P1 rows.
- Require existing test files for captured and bug-pinned rows.

Harness owns the semantic judgment: whether a row describes observable behavior,
whether the proof exercises that behavior, and whether remaining gaps block the
target readiness tier.

## Baseline status report

`harness baseline status` derives this ephemeral report from the two tables and
the current repository snapshot:

```ts
interface BaselineReport {
  gate0:
    | "toolchain-ready-green"
    | "tests-runnable-red"
    | "no-test-harness"
    | "toolchain-broken"
    | "env-blocked"
    | "unknown";
  inventory: {
    path: "docs/BEHAVIOR_INVENTORY.md";
    totalRows: number;
    confirmedRows: number;
    correctedRows: number;
    pendingRows: number;
    deferredRows: number;
    highRiskRows: number;
  };
  ledger: {
    path: "docs/BEHAVIOR_LEDGER.md";
    capturedRows: number;
    bugPinnedRows: number;
    gapRows: number;
    failedRows: number;
    staleRows: number;
    highRiskGapRows: number;
    lastVerifiedSha: string | null;
  };
  nextAction: string;
}
```
