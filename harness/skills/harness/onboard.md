# Harness Onboard

Turn an audited repo into a machine-readable **`autonomous-ready` manifest** that
a downstream software factory can consume to decide whether it may point an
unsupervised loop at the repo. This is the handoff step after the repo has been
made ergonomic (`docs`) and audited (`doctor`): it projects the audit's prose
verdict into the data contract another system reads.

Use this workflow when the user wants to onboard a repo into an autonomous
runner, emit an `autonomous-ready` manifest, or check what a repo still needs
before it can be driven unattended.

The manifest schema and its field provenance are defined in `./INTERFACES.md`.
This module emits that contract; the consumer that reads it is built on the
factory side — do not assume a reader exists yet.

## Process

### 1. Audit first

Run `doctor.md` as a full audit (no `--diff`). You need its outputs as manifest
inputs: the weighted D1-D7 score, the loop-readiness verdict, per-dimension
scores, and the tiered gaps. Do not hand-derive these — onboard consumes the
audit, it does not replace it.

### 2. Derive the manifest fields

Populate the `AutonomousReadyManifest` from real repo evidence (never invent a
field to look ready):

- **Identity** — provider/owner/name, default and allowed refs (from the repo).
- **Verdict + score + dimensions + gaps** — straight from the `doctor.md` audit.
- **bootstrap** — the one-command bring-up + health smoke from
  `docs/engineering/commands.md`; if none exists, this is a gap, not a guess.
- **validation lanes** — fast/full/live command lists from
  `docs/engineering/commands.md` and the signals menu (the proof-menu `Lane`
  column only distinguishes `fast`|`full`; a `live` lane, if any, comes from the
  commands doc, not the proof menu).
- **proofMenu** — the rows in the machine-readable proof-row format
  (`./INTERFACES.md`); if the menu is free-form, fix its shape first. Resolve
  command IDs through the signals menu before presenting executable shell
  commands to a runner.
- **behaviorLedger** — when `docs/BEHAVIOR_LEDGER.md` exists, include its path,
  captured/bug-pinned/gap counts, high-risk gap count, and last verified SHA from
  the `doctor.md` audit. If the ledger is malformed or absent, list that as a
  gap rather than inventing readiness.
- **humanGates / escalation / mergePolicy** — human-gate-by-design change types
  and escalation boundaries from the spec contract and the loop-readiness verdict.
- **safety (D7)** — secrets-exposed, write-scope-bounded, sandboxed,
  production-data-reach, from the D7 assessment.
- **parallelSafety / reversibility** — from the `doctor.md` semantic gates.

Any field you cannot fill from evidence is a gap entry, not a fabricated value.

### 3. Apply the verdict gate

The manifest's `verdict` governs how a runner may use the repo:

- **autonomous-ready** — only when every deterministic precursor is met, every
  semantic gate passes, and there is no material D7 blast-radius gap (per the
  `doctor.md` safety cap). Assert this only when earned.
- **supervised-only (by-design)** — dispatch allowed, human clears the merge;
  name the human-gate change types.
- **supervised-only / not-yet** — emit the manifest with `verdict` set and the
  `gaps` populated; the repo is not yet consumable unattended.

### 4. Emit the manifest and an onboarding checklist

Emit the manifest as data (prefer stdout/ephemeral file — the harness re-derives
it, so it never goes stale; do not commit it as durable repo state). Alongside
it, produce a short **onboarding checklist**: the ordered gaps that would promote
the repo to `autonomous-ready`, each pointing at the surface that fixes it
(usually a `docs`/enforcement change or a missing bootstrap/proof).

## Completion

Onboard is done when: a `doctor.md` audit ran; a manifest is emitted with every
required field populated from evidence or explicitly listed as a gap; the verdict
gate is applied honestly (no unearned `autonomous-ready`); and the onboarding
checklist names the promotion path. Emitting a manifest that claims readiness the
audit did not support is the failure this step exists to prevent.
