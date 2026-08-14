# Proposed factory handoffs

Status: design proposal. Harness can emit these shapes as provisional data, but
no concrete downstream reader or compatibility policy exists. Re-verify the
schema with the intended consumer before implementing either side.

The current repository artifact schemas live in `./INTERFACES.md`.

## Eval seed proposal

`harness evals` can project each `ProofRow` into a candidate eval seed. The five
fields are copied one-to-one; the factory decides how to compile and grade them.

```ts
interface EvalSeed {
  changeType: string;
  commands: string[];
  proofArtifact: string;
  sufficiency: "auto" | "human-gate";
  lane: "fast" | "full";
}
```

This is seed data, not a portable executable eval. Keep structural validation,
portable behavioral evals, and real Claude/Codex dogfood as separate proof
surfaces.

## Autonomous-ready manifest proposal

The manifest projects Harness audit evidence into data a future software
factory could use when deciding whether unattended dispatch is allowed.

```ts
interface AutonomousReadyManifest {
  schemaVersion: string | null;
  kind: "autonomous-ready";
  generatedBy: { tool: "harness"; skillVersion: string; at: string };

  repo: {
    provider: string;
    owner: string;
    name: string;
    defaultBaseRef: string;
    allowedRefs: string[] | null;
  };

  verdict:
    | "autonomous-ready"
    | "supervised-only"
    | "supervised-only (by-design)"
    | "not-yet";
  readinessScore: number | null;
  auditCompleteness: {
    status: "complete" | "provisional";
    reviewedWeight: number | null;
  };
  dimensions: {
    D1: number | null;
    D2: number | null;
    D3: number | null;
    D4: number | null;
    D5: number | null;
    D6: number | null;
    D7: number | null;
  };

  bootstrap: { commands: string[] | null; healthSmoke: string | null };
  validation: {
    fastLane: string[] | null;
    fullLane: string[] | null;
    liveLane: string[] | null;
  };
  proofMenu: ProofRow[] | null;
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

  humanGates: string[] | null;
  escalation: string[] | null;
  mergePolicy: "human-review-default" | "auto-merge-eligible" | null;
  safety: {
    secretsExposedToAgent: boolean | null;
    writeScopeBounded: boolean | null;
    sandboxed: boolean | null;
    productionDataReach: "none" | "read" | "write" | "unknown";
  };
  parallelSafety: {
    freshWorktreeSafe: boolean | null;
    sharedPortCollisions: boolean | null;
    sharedDbCollisions: boolean | null;
  };
  reversibility: "by-construction" | "documented" | "none" | "unknown";

  evalSeeds?: EvalSeed[];
  gaps: {
    dimension: string;
    severity: "critical" | "high" | "medium";
    promotionPath: string;
  }[];
}
```

## Field provenance

| Field group | Harness source | Consumer status |
| --- | --- | --- |
| `repo.*` | repository identity and git remote | Common input; exact consumer mapping unverified |
| verdict, score, dimensions, gaps | `doctor.md` audit | Proposed |
| bootstrap and validation | commands doc and signals menu | Proposed |
| proof menu | `docs/SPEC_CONTRACT.md` | Proposed |
| behavior ledger | `docs/BEHAVIOR_LEDGER.md` | Proposed |
| human gates, escalation, merge policy | spec contract and doctor verdict | Proposed |
| safety, parallel safety, reversibility | `doctor.md` semantic gates | Proposed |
| eval seeds | derived from proof rows | Proposed |

## Consumer obligations

Before this becomes a supported contract, a factory must provide:

- A versioned reader and compatibility policy.
- A dispatch gate that honors the verdict and human-merge policy.
- Enforcement that exposed secrets or unbounded write scope prevent unattended
  work.
- A concrete mapping from eval seeds to executable cases and graders.
- Contract tests owned by both producer and consumer.

Use `null` or `unknown` only when the audit did not establish a value, and add a
corresponding gap. Use an empty array only when the audit established that the
set is empty. Never translate missing evidence into `false`, `none`, an empty
string, an empty array, or another concrete assertion.

Keep `schemaVersion` null until producer and consumer adopt a compatibility
policy. Keep `reviewedWeight` null when no audit dimensions were reviewed.

## Unresolved design decisions

- Output location: ephemeral stdout/file or committed durable state.
- Schema versioning, deprecation, and timestamp semantics.
- Consumer-specific identity and allowed-ref rules.
- Whether one manifest should describe readiness or only link to authoritative
  audit receipts.
