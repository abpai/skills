# Harness interface contracts

Design-only (roadmap Phase 0 deliverable — no runtime consumer yet). Two
machine-readable contracts that later phases depend on, fixed early so all three
sides build to the same shape:

- **Proof-row format** — a constrained shape for `docs/SPEC_CONTRACT.md` proof-menu
  rows so **harness-doctor** (Phase 4) can statically verify them and downstream
  software factories (Phase 5) can seed eval cases from them.
- **Behavior inventory and ledger rows** — the durable artifacts emitted by
  `harness baseline`: a human-ratified inventory and a machine-maintained proof
  ledger keyed by stable behavior IDs.
- **`autonomous-ready` onboard manifest** — what the **harness** emits (Phase 5)
  and a downstream software factory consumes to accept a repo for unattended work.

This routes work; it does not gate it. The manifest schema was informed by an
internal software-factory pilot, but the contract below is intentionally generic:
re-verify against any concrete consumer before implementing a reader.

## 1. Machine-readable proof-row format

### Problem

Today the proof menu (the harness `docs.md` module, `docs/SPEC_CONTRACT.md`) is
a free-form Markdown table with compound cells like `` `<command>` + screenshot
diff ``. A scanner cannot reliably extract "the command this row asserts," so
Phase 4's "statically verify every proof-menu row references a command that
exists" is impossible without a parseable shape first. Downstream eval seeders
hit the same wall: they need change-type, command, artifact, sufficiency, and
expected evidence as data, not prose.

### The constrained table (single source, human- and machine-readable)

Keep one Markdown table — no parallel JSON to drift — but constrain it so the
columns parse deterministically. Required columns, fixed order:

```md
| Change type | Lane | Validation command | Proof artifact | Sufficiency |
| --- | --- | --- | --- | --- |
| API surface | full | `test:contract` | passing run + response trace | auto |
| Dashboard UI | full | `test:e2e` | screenshot pair | human-gate |
| Any change | fast | `lint` `typecheck` | passing run output | auto |
```

Rules that make it parseable:

- **`Validation command`** holds one or more command identifiers, **each wrapped
  in backticks**, and nothing else. Non-command prose ("+ screenshot diff") is
  banned from this cell — it belongs in `Proof artifact`. A row's command IDs
  are exactly the backtick spans in this cell.
- For package-manager scripts, use the script ID from `package.json`
  (`test`, `lint`, `ui:build`), not the shell invocation (`bun test`,
  `pnpm test`, `npm run test`). Harness Doctor resolves these IDs through the
  discovered signals menu before the workflow executes them. Make targets and
  just recipes use their target/recipe ID; CI-only commands use the exact signal
  emitted by the scanner.
- **`Lane`** ∈ `fast | full`. "Done" binds to full-lane green (never fast-lane).
- **`Sufficiency`** ∈ `auto | human-gate`. A missing marker is a false-green risk.
- **`Change type`** and **`Proof artifact`** are free human text.

### Extracted shape

```ts
interface ProofRow {
  changeType: string;                 // human label
  lane: "fast" | "full";
  commands: string[];                 // command IDs from the command cell
  proofArtifact: string;              // human description of the artifact
  sufficiency: "auto" | "human-gate";
}
```

### Verification rules (harness-doctor, Phase 4)

- Parse the proof-menu table into `ProofRow[]`. A malformed table (missing a
  required column, a command cell with un-backticked prose, an out-of-enum Lane
  or Sufficiency) is itself a finding — the row is unverifiable.
- For each `command`, resolve it against the discovered **signals menu** (package
  script IDs, CI jobs, Make/just targets). A command that resolves to nothing is
  a stale-proof-menu finding (Critical — it silently breaks the intake→execution
  pipeline). **Existence only; execution stays in the skill workflow.**
- Every major change type in the signals menu with no matching row is a
  coverage gap (intake will produce specs this repo cannot verify).

### Alignment with factory eval seeding

These five fields are the minimum an eval case needs to be seeded from a proof
row: `changeType` → case purpose/target, `commands` → the validation the runner
executes and records, `proofArtifact` → expected evidence/artifacts,
`sufficiency` → whether a passing grader is enough or a human gate is required,
`lane` → deterministic-vs-live grading tier.

An eval seed is exactly those five fields carried over from the proof row:

```ts
interface EvalSeed {
  changeType: string;                 // ProofRow.changeType — capability the eval exercises
  commands: string[];                 // ProofRow.commands — command IDs the runner resolves and records
  proofArtifact: string;              // ProofRow.proofArtifact — expected evidence the grader checks
  sufficiency: "auto" | "human-gate"; // grader gate: auto passes on grader success; human-gate needs sign-off
  lane: "fast" | "full";              // grading tier
}
```

`AutonomousReadyManifest.evalSeeds` (§2) is `EvalSeed[]`, derived one-to-one from
`proofMenu` rows.

## 2. Behavior baseline artifacts

`harness baseline` creates two durable repo files:

- `docs/BEHAVIOR_INVENTORY.md` — human-ratified behavior map.
- `docs/BEHAVIOR_LEDGER.md` — machine-maintained proof ledger.

Both are human-readable Markdown, but their tables are constrained so
`harness-doctor` and downstream tooling can parse them. Stable IDs join the two
files and must not be renumbered casually. Absence of a ledger row for an
inventory ID means the behavior is pending capture; do not add a `pending`
ledger status.

### Inventory table

Required columns, fixed order:

```md
| ID | Area | Behavior | Entry points | Existing proof | Missing proof | Confidence | Risk | Status | Priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | Auth | Google login | `src/auth/google.ts:42` | none | no e2e proof | high | high | confirmed | P0 |  |
```

Rules:

- `ID` matches `B-\d{3,}` and is unique.
- `Entry points` contains one or more concrete repo paths, preferably
  `file:line`.
- `Confidence` is `high | medium | low`.
- `Risk` is `high | medium | low`.
- `Status` is `proposed | confirmed | corrected | skip | deferred | stale`.
- `Priority` is `P0 | P1 | P2`.

Extracted shape:

```ts
interface BehaviorRow {
  id: string;                         // stable B-001 style ID
  area: string;
  behavior: string;                   // observable behavior, user-facing when possible
  entryPoints: string[];              // file or file:line references
  existingProof: string[];            // test files/cases/commands, empty when none found
  missingProof: string;
  confidence: "high" | "medium" | "low";
  risk: "high" | "medium" | "low";
  status: "proposed" | "confirmed" | "corrected" | "skip" | "deferred" | "stale";
  priority: "P0" | "P1" | "P2";
  notes: string;
}
```

### Ledger table

Required columns, fixed order:

```md
| ID | Status | Capture type | Test paths | Run command | Run evidence | Confidence | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | captured | integration | `tests/auth/google.test.ts` | `pnpm test tests/auth/google.test.ts` | 3/3 green at abc123 | high |  |
```

Rules:

- `ID` references an inventory row.
- `Status` is `captured | bug-pinned | gap | failed | stale`.
- `Capture type` is `unit | integration | golden | snapshot | screenshot |
  contract | none`.
- `Test paths` for `captured` and `bug-pinned` rows names one or more files
  that exist.
- `Run command` for proof-backed rows names the command that was run.
- `Run evidence` records the result and repo snapshot, such as
  `3/3 green at <sha>`.
- `Confidence` is `high | medium | low`.

Extracted shape:

```ts
interface LedgerRow {
  id: string;                         // references BehaviorRow.id
  status: "captured" | "bug-pinned" | "gap" | "failed" | "stale";
  captureType: "unit" | "integration" | "golden" | "snapshot" | "screenshot" | "contract" | "none";
  testPaths: string[];
  runCommand: string;
  runEvidence: string;
  confidence: "high" | "medium" | "low";
  remainingGap: string;
}
```

### Baseline report

`harness baseline status` should be derivable from the two tables plus the
current repo snapshot:

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

### Scanner verification rules

`harness-doctor` owns deterministic checks:

- Required headers are present.
- IDs are unique and valid.
- enum cells use the values above.
- ledger rows reference inventory IDs.
- confirmed/corrected P0/P1 inventory rows have terminal ledger rows.
- captured/bug-pinned ledger rows reference existing test files.

The skill owns semantic judgment: whether rows describe meaningful observable
behavior, whether existing proof really exercises the entry point, and whether
remaining gaps block the target readiness tier.

## 3. `autonomous-ready` onboard manifest

### Why it is needed

The internal pilot has **no** autonomous-ready manifest today. Repo onboarding is
identity + permission gating plus team routing. Whether a repo is *safe and ready
to run an agent unattended* — bootstrap, lanes, proof menu, sufficiency,
escalation, secret posture, parallel-safety — exists only as docs/policy, never
as machine-readable target-repo data. The manifest is that missing bridge: the
machine-readable projection of what the harness already authors in `docs.md` and
audits in `doctor.md`.

### Schema (v0 draft)

```ts
interface AutonomousReadyManifest {
  schemaVersion: string;                 // e.g. "0.1"
  kind: "autonomous-ready";
  generatedBy: { tool: "harness"; skillVersion: string; at: string };

  repo: {                                // identity — common factory catalog inputs
    provider: string;
    owner: string;
    name: string;
    defaultBaseRef: string;
    allowedRefs: string[];
  };

  verdict: "autonomous-ready" | "supervised-only"
         | "supervised-only (by-design)" | "not-yet";   // doctor.md loop-readiness
  readinessScore: number;                                // weighted D1-D7
  dimensions: { D1: number|null; D2: number|null; D3: number|null;
                D4: number|null; D5: number|null; D6: number|null; D7: number|null };

  bootstrap: { commands: string[]; healthSmoke: string };   // one-command bring-up + smoke
  validation: { fastLane: string[]; fullLane: string[]; liveLane: string[] };
  proofMenu: ProofRow[];                                     // §1
  behaviorLedger?: {
    path: string;
    coverage: {
      inventoryRows: number;
      capturedRows: number;
      bugPinnedRows: number;
      gapRows: number;
      highRiskGapRows: number;
    };
    lastVerifiedSha: string | null;
  };

  humanGates: string[];                  // change types that are human-gate-by-design
  escalation: string[];                  // irreversible / scope-conflict / reserved-for-human
  mergePolicy: "human-review-default" | "auto-merge-eligible";

  safety: {                              // D7 blast-radius posture
    secretsExposedToAgent: boolean;      // false means refs-only or equivalent
    writeScopeBounded: boolean;
    sandboxed: boolean;
    productionDataReach: "none" | "read" | "write";
  };
  parallelSafety: {
    freshWorktreeSafe: boolean;
    sharedPortCollisions: boolean;
    sharedDbCollisions: boolean;
  };
  reversibility: "by-construction" | "documented" | "none";

  evalSeeds?: EvalSeed[];                // derived from proofMenu (§1 alignment)
  gaps: { dimension: string; severity: "critical"|"high"|"medium"; promotionPath: string }[];
}
```

### Field provenance

| Field group | Harness surface that emits it | Downstream consumer status |
| --- | --- | --- |
| `repo.*` identity | `AGENTS.md` / git remote | already-consumed (catalog) |
| `verdict`, `readinessScore`, `dimensions` | `doctor.md` audit | new |
| `bootstrap`, `validation` lanes | `docs/engineering/commands.md` + signals menu | new (docs today) |
| `proofMenu` | `docs/SPEC_CONTRACT.md` (§1 shape) | new |
| `behaviorLedger` | `docs/BEHAVIOR_LEDGER.md` + `doctor.md` audit | new |
| `humanGates`, `escalation`, `mergePolicy` | spec-contract escalation + doctor verdict | new (policy today) |
| `safety` (D7) | `doctor.md` D7 | new |
| `parallelSafety`, `reversibility` | `doctor.md` semantic gates | new |
| `evalSeeds` | derived from `proofMenu` | new |
| `gaps` | `doctor.md` findings promotion path | new |

Everything under "new" exists as prose/policy in the harness or pilot factory
docs today; the manifest's job is to promote it to machine-readable data both
sides agree on. The identity block is the only part the pilot already ingests.

### What a factory must build to consume it

- A manifest reader alongside the `GitHubRepository` catalog that gates
  autonomous dispatch on `verdict === "autonomous-ready"` (and honors
  `supervised-only (by-design)` as "dispatch allowed, merge stays human").
- A path from `proofMenu` → `evalSeeds` → `defineEvalCase`
  or the factory's equivalent eval-case registration API.
- Enforcement that `safety.secretsExposedToAgent === false` before unattended
  runs.

## Open questions

- **Where does the manifest live?** Options: emitted to stdout by
  `harness onboard` (ephemeral, re-derived each run) vs. committed as
  `harness.config.ts`-adjacent data (durable, can drift). Leaning ephemeral —
  the harness re-derives it, so it can never be stale, matching the
  "scanner output stays temporary" rule.
- **Manifest vs. harness.config.ts.** `harness.config.ts` configures the scanner;
  the manifest describes readiness. Keep them separate — one is input to the
  audit, the other is its output.
- **Timestamp/versioning.** `generatedBy.at` and `schemaVersion` need a real
  clock and a deprecation policy when fields change (the same public-contract
  concern as retiring harness-doctor's penalty `score`).
