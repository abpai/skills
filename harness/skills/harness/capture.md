# Harness Capture

Characterize a repo's **current** behavior before an agent changes it. This is
the harness's first job on legacy or under-tested code: an agent asked to modify
code with no verification net cannot tell a fix from a regression, so first pin
what the system does today, then change it against that net.

Use this workflow when the user is about to have an agent modify legacy,
undocumented, or under-tested code; asks to "capture behavior," "add a safety
net," "characterize this before we touch it," or lock current behavior before a
refactor or migration.

## The one rule that matters

**Capture what the code *does*, not what it *should* do.** Characterization tests
are change-detectors, not correctness oracles — they encode current behavior,
bugs included. Do not "fix" behavior while capturing it, and do not assert the
behavior you wish were true. If you find behavior that looks like a bug, capture
it as-is so the net is faithful, and record it separately in the coverage-gap
report as a suspected bug for a human to rule on — never silently encode a
guess about intended behavior. A characterization suite that lies about current
behavior is worse than none: it green-lights a regression as correct.

## Process

### 1. Scope the behavior surface at risk

Identify the code the upcoming change will touch and the observable behavior that
must not silently change: public functions, API endpoints, CLI output, rendered
UI, emitted events, persisted shapes. Read the code and its callers to find the
real boundary — capture at the seams a consumer depends on, not every private
helper. Out-of-scope code is not captured; note it.

### 2. Choose the capture level per behavior

Match the test level to where the behavior is observable, preferring the
cheapest level that actually pins it:

- **Pure logic** → unit characterization tests: feed representative + edge inputs,
  record the actual outputs as the expectations.
- **I/O, integration, serialized shapes** → integration tests or golden/snapshot
  files (recorded responses, fixture DB state, serialized output).
- **Rendered UI** → snapshot or screenshot baseline for the current render.

Seed inputs from real usage where you can (existing fixtures, logs, sample data),
not invented cases — the net should cover what users actually exercise.

### 3. Capture against the current code and confirm green

Write the tests/snapshots, then run them against the **unchanged** code. They
must pass now — a characterization test that fails against current behavior was
written wrong (you asserted a wish, not the behavior). Record what ran. These
tests then live as the enforcement surface (per `docs.md`'s enforcement
hierarchy) that catches regressions when the agent makes its change.

### 4. Report the behavior ledger and coverage gaps

- **Behavior ledger** — a table of `behavior | capture level | test/snapshot file
  | seed source`, listing exactly what is now pinned.
- **Coverage-gap report** — behavior in scope that you could *not* pin and why
  (non-deterministic without a seam, needs a live external service, timing-
  dependent), plus suspected bugs captured as-is. These gaps are where an agent's
  change is still unguarded — name them so the human knows the net has holes,
  and route durable ones to `docs/todos` or the enforcement hierarchy.

## Completion

Capture is done when: the behavior surface at risk is scoped; characterization
tests/snapshots exist at the right level and **pass against the current code**
(run, not assumed); the behavior ledger and coverage-gap report are written; and
suspected bugs are flagged separately rather than encoded as intended behavior.
Not done because tests were written — done when they run green against today's
code and the gaps are named.
