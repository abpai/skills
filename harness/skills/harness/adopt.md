# Adopt a repository

Prepare an existing repository for reliable agent-driven development. Preserve
working project conventions; add only the knowledge and enforcement the repo is
missing.

## Outcome

Adoption establishes:

- a human-ratified map of important current behavior and its proof;
- a small agent entry point with routes to durable repository knowledge;
- canonical bootstrap, fast-feedback, full-validation, and live/human proof
  paths where the project needs them;
- deterministic enforcement for repository invariants and dependency hygiene;
- an exact-revision Doctor result containing facts, unknowns, and blockers.

## Workflow

Use `adopt assess` for a read-only gap analysis. Run the Inspect phase and a
full Doctor audit, report the adoption plan, and stop before creating baseline,
documentation, dependency, or enforcement artifacts. Without `assess`, execute
the full workflow below.

### 1. Inspect

Record the revision and working-tree state. Find the existing agent guidance,
architecture docs, commands, tests, CI, dependency policy, and safety
boundaries. Reuse credible surfaces instead of creating parallel ones.

Run `./doctor.md` in full scope to establish the starting facts. A missing
scanner, command, service, credential, or human proof becomes an unknown or
blocker, never an assumed pass.

### 2. Baseline behavior

Load `./baseline.md`. Inventory externally observable, high-risk behavior and
connect it to existing proof. Stop for human ratification before capturing
unproven behavior. Add characterization proof only for confirmed scope.

Skip new baseline files when the repository already has an equally reviewable,
human-owned behavior map joined to runnable evidence. Record the equivalent
surface in the final report.

### 3. Make the repo navigable

Load `./docs.md`. Keep the root agent guide short. Route agents to the actual
architecture, commands, testing, proof menu, and project-specific gotchas. Move
repeated rules into tests, lint, scripts, or CI when a deterministic check can
express them.

### 4. Make execution reproducible

Load `./secure-dependencies.md` and its ecosystem reference when applicable.
Confirm a fresh worktree can install and run the canonical checks with pinned
tooling and lockfiles. Check secret boundaries, production access, shared
ports/databases, and irreversible operations. Add enforcement only for
observed risks. Treat reproducible locked installs and bounded lifecycle scripts
as readiness conditions. Report update bots, cooldowns, and commit-pinned CI
actions as recommended hardening unless repository policy makes them mandatory.

### 5. Verify and hand off

Run `./doctor.md` again. Execute every safe changed or newly documented command
under Doctor's execution policy. The final Doctor result is the handoff: do not
create a second onboarding manifest or translate missing evidence into a
positive assertion.

## Completion

Adoption is complete when the baseline's human gate is resolved, repository
routes and proof rows point to real surfaces, deterministic checks are wired
into the normal workflow, required safe proofs ran on the final candidate, and
Doctor reports every remaining unknown or blocker with a concrete next action.

Lead the final report with what a software factory can now rely on, what still
needs supervision, and the exact commands and revision that were verified.
