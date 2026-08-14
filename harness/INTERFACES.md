# Harness interfaces

Harness has three repo-owned artifacts and one ephemeral readiness result.
Markdown remains the source of truth for repository artifacts; do not create
parallel JSON copies that can drift.

## Artifact ownership

| Artifact | Owner | Purpose |
| --- | --- | --- |
| `docs/BEHAVIOR_INVENTORY.md` | Human, drafted by Harness | Ratified map of important current behavior |
| `docs/BEHAVIOR_LEDGER.md` | Harness | Evidence joined to ratified behavior IDs |
| `docs/SPEC_CONTRACT.md` proof menu | Repository | Validation available for each change type |
| `HarnessReadinessResult` | Doctor, ephemeral | Exact-candidate facts, unknowns, blockers, and proof runs |

The Markdown tables below are constrained so Doctor can inspect them and
future tooling can parse them. They are not cross-system TypeScript APIs.

## Proof row

The proof menu maps a change type to repository-owned validation and the
evidence required to accept it.

```md
| Change type | Lane | Validation command | Proof artifact | Sufficiency |
| --- | --- | --- | --- | --- |
| API surface | full | `test:contract` | passing run and response trace | auto |
| Dashboard UI | full | `test:e2e` | screenshot comparison | human-gate |
```

```ts
interface ProofRow {
  changeType: string;
  lane: "fast" | "full";
  commands: string[];
  proofArtifact: string;
  sufficiency: "auto" | "human-gate";
}
```

Rules:

- Columns use the fixed order above.
- `Lane` is `fast` or `full`; full is the completion gate.
- `Validation command` contains only backtick-wrapped command IDs. Use package
  script, Make target, just recipe, or CI job IDs rather than explanatory prose.
- `Proof artifact` describes retained evidence, not merely the command output.
- `Sufficiency` is `auto` or `human-gate`.
- Every command resolves to a real repository-owned surface.
- Broader lane policy and live/human execution details belong in the
  repository's command documentation.

## Behavior inventory row

The inventory records observable behavior and the human's decision about what
must be protected.

```md
| ID | Area | Behavior | Entry points | Existing proof | Missing proof | Confidence | Risk | Status | Priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | Auth | Google login creates a session | `src/auth/google.ts:42` | none | login contract | high | high | confirmed | P0 |  |
```

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

IDs match `B-\d{3,}`, remain stable across refreshes, and are unique. Entry
points name concrete paths. Agents draft `proposed`; humans own confirmation,
correction, skip, and deferral.

## Behavior ledger row

The ledger records how a ratified behavior is protected.

```md
| ID | Status | Capture type | Test paths | Run command | Run evidence | Confidence | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | captured | integration | `tests/auth/google.test.ts` | `pnpm test tests/auth/google.test.ts` | 3/3 green at abc123 | high |  |
```

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

Every ledger ID references an inventory ID. Proof-backed rows name existing
files and candidate-bound run evidence. A missing row means capture is pending;
there is no `pending` ledger status.

## Readiness result

Doctor emits, but does not commit by default, a result shaped around the same
boundary Garage Band uses for repository readiness: observed facts, unknowns,
blockers, inspected revision, and inspected paths. This is an instruction-level
producer contract; a factory adapter remains responsible for validating and
mapping it into its versioned API schema.

```ts
interface ReadinessItem {
  code: string;
  message: string;
  nextAction: string;
}

interface ProofRun {
  command: string;
  status: "passed" | "failed" | "unverified" | "stale";
  runtimeMs: number | null;
  artifact: string | null;
}

interface HarnessReadinessResult {
  schemaVersion: 1;
  repository: string;
  inspectedRevision: string | null;
  workingTree: {
    dirty: boolean;
    diffSha256: string | null;
  };
  observedFacts: string[];
  unknowns: ReadinessItem[];
  blockers: ReadinessItem[];
  inspectedPaths: {
    path: string;
    sha256: string;
  }[];
  proofRuns: ProofRun[];
}
```

Semantics:

- `observedFacts` contains only file- or command-backed statements.
- `unknowns` names evidence Doctor could not obtain and how to obtain it.
- `blockers` names conditions that make the requested work unsafe or
  unprovable and how to resolve them.
- `null` means not established. Empty arrays mean the audit established that
  no entries exist.
- A dirty tree requires a diff hash. Proof from an earlier candidate is
  `stale`, not current.
- Do not add a numeric readiness score or an `autonomous-ready` assertion. The
  consumer decides what its requested operation requires from these facts.
