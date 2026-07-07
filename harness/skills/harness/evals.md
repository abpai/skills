# Harness Evals

Seed evaluation cases from a repo's spec-contract proof menu. Evals are the
end-to-end tests for agents (the factory grades a task against them); the proof
menu already enumerates every change type the repo can verify and how, so it is
the natural source of eval seeds — one candidate eval per proof row.

Use this workflow when the user wants to seed eval cases from the spec contract,
bootstrap an eval suite for a repo being onboarded, or turn the proof menu into
gradeable agent tests.

This module produces **seed specs** in the shape the factory's eval system
consumes; it does not run or grade evals — the runner and graders live on the
factory side. The proof-row format and the eval-seed field mapping are defined
in `./INTERFACES.md` in installed skills, mirrored at `../../INTERFACES.md` in
the source checkout.

## Process

### 1. Require a machine-readable proof menu

Read `docs/SPEC_CONTRACT.md`. Its proof menu must be in the constrained proof-row
format (`./INTERFACES.md`): fixed columns, command IDs as backtick spans,
`Lane` ∈ fast/full, `Sufficiency` ∈ auto/human-gate. If it is free-form, fix its
shape (via `docs.md`) before seeding — you cannot seed reliable evals from prose.

### 2. Map each proof row to an eval seed

One seed per row, carrying the five load-bearing fields:

- `changeType` → the eval's purpose/target (what capability it exercises).
- `commands` → command IDs from the proof row; include the resolved shell
  commands when the signals menu makes that mapping available.
- `proofArtifact` → the expected evidence/artifact the grader checks for.
- `sufficiency` → the grader gate: `auto` rows can pass on grader success alone;
  `human-gate` rows require human sign-off and must be seeded as human-gated, not
  auto-pass.
- `lane` → the grading tier (fast/deterministic vs. full/live).

Do not invent evals for capabilities the repo cannot verify — an eval with no
real validation command is untestable theatre. A row missing a sufficiency
marker cannot be seeded correctly; flag it for repair rather than defaulting it
to `auto` (defaulting a human-gate row to auto would let a false green merge).

### 3. Emit the seed specs

Emit the eval seeds as data for the factory to compile into its own eval cases.
Group related change types rather than emitting a seed per micro-variation; keep
the set small and high-signal, mirroring the compact proof menu.

## Completion

Seeding is done when: the proof menu was read in machine-readable form (or its
shape was fixed first); each seedable row produced one eval seed carrying all
five fields; human-gate rows are seeded as human-gated (never silently auto);
and rows that could not be seeded (missing command, missing sufficiency) are
listed with the reason rather than papered over.
