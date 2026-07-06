# Harness interface contracts

Design-only (roadmap Phase 0 deliverable — no runtime consumer yet). Two
machine-readable contracts that later phases depend on, fixed early so all three
sides build to the same shape:

- **Proof-row format** — a constrained shape for `docs/SPEC_CONTRACT.md` proof-menu
  rows so **harness-doctor** (Phase 4) can statically verify them and downstream
  software factories (Phase 5) can seed eval cases from them.
- **`autonomous-ready` onboard manifest** — what the **harness** emits (Phase 5)
  and a downstream software factory consumes to accept a repo for unattended work.

This routes work; it does not gate it. The manifest schema was informed by an
internal software-factory pilot, but the contract below is intentionally generic:
re-verify against any concrete consumer before implementing a reader.

## 1. Machine-readable proof-row format

### Problem

Today the proof menu (`harness/skills/harness/docs.md`, `docs/SPEC_CONTRACT.md`) is
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
| API surface | full | `pnpm test:contract` | passing run + response trace | auto |
| Dashboard UI | full | `pnpm test:e2e` | screenshot pair | human-gate |
| Any change | fast | `pnpm lint` `pnpm typecheck` | passing run output | auto |
```

Rules that make it parseable:

- **`Validation command`** holds one or more commands, **each wrapped in
  backticks**, and nothing else. Non-command prose ("+ screenshot diff") is
  banned from this cell — it belongs in `Proof artifact`. A row's commands are
  exactly the backtick spans in this cell.
- **`Lane`** ∈ `fast | full`. "Done" binds to full-lane green (never fast-lane).
- **`Sufficiency`** ∈ `auto | human-gate`. A missing marker is a false-green risk.
- **`Change type`** and **`Proof artifact`** are free human text.

### Extracted shape

```ts
interface ProofRow {
  changeType: string;                 // human label
  lane: "fast" | "full";
  commands: string[];                 // backtick spans from the command cell
  proofArtifact: string;              // human description of the artifact
  sufficiency: "auto" | "human-gate";
}
```

### Verification rules (harness-doctor, Phase 4)

- Parse the proof-menu table into `ProofRow[]`. A malformed table (missing a
  required column, a command cell with un-backticked prose, an out-of-enum Lane
  or Sufficiency) is itself a finding — the row is unverifiable.
- For each `command`, resolve it against the discovered **signals menu** (package
  scripts, CI jobs, Make/just targets). A command that resolves to nothing is a
  stale-proof-menu finding (Critical — it silently breaks the intake→execution
  pipeline). **Existence only; execution stays in the skill workflow.**
- Every major change type in the signals menu with no matching row is a
  coverage gap (intake will produce specs this repo cannot verify).

### Alignment with factory eval seeding

These five fields are the minimum an eval case needs to be seeded from a proof
row: `changeType` → case purpose/target, `commands` → the validation the runner
executes and records, `proofArtifact` → expected evidence/artifacts,
`sufficiency` → whether a passing grader is enough or a human gate is required,
`lane` → deterministic-vs-live grading tier.

## 2. `autonomous-ready` onboard manifest

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
