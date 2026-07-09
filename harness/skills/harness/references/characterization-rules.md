# Characterization Rules

Use these rules whenever `capture.md` or `baseline.md` writes tests or snapshots
whose job is to pin current behavior. They prevent a behavior baseline from
becoming a pile of brittle implementation locks.

## Boundary Rule

Test through the behavior's observable entry point: public API, HTTP route, CLI
command, rendered UI, emitted event, persisted shape, or documented package
export. Do not characterize private helpers unless the ratified behavior has no
more stable boundary. If you must use a private seam, record that as a lower
confidence capture in the ledger.

## Snapshot Hygiene

Capture the smallest stable projection that catches the behavior:

- Prefer named fields and observable outputs over whole-object or full-DOM
  snapshots.
- Normalize timestamps, generated IDs, ordering, locale-sensitive values, and
  random data before asserting.
- For UI, prefer interaction-visible state and screenshot pairs with masks over
  full HTML dumps.
- Keep golden files reviewable; if a future reviewer cannot tell what changed,
  the snapshot is too broad.

## Determinism

Baseline tests must run hermetically against local fixtures:

- Freeze clocks and seed random number generators.
- Record/replay network calls with the repo's existing mock style; never hit
  production services during a baseline run.
- Use fixture databases or in-memory stores instead of shared services.
- Run each new characterization proof two or three times before recording it.
  A flaky capture is a gap, not a committed test.

## Assertion Budget

Use a few strong assertions on the observable contract. Avoid deep equality on
incidental internal structures, generated markup, request objects, or framework
metadata unless that structure is itself the behavior being pinned.

## Failure Semantics

Every characterization test should make its purpose obvious:

- Name or tag it as characterization when the repo has a convention
  (`*.characterization.*`, `describe("B-017 characterization", ...)`, or a
  dedicated directory).
- Include a short header/comment when the test framework allows it:
  `Pins observed behavior at <sha> for B-017. If the behavior intentionally
  changes, update the ledger and this test deliberately.`
- For suspected bugs captured as-is, record `bug-pinned` in the ledger and add a
  terse note in the test pointing back to that behavior ID.

## Source Edits

Baseline capture must not fix product behavior. Unless the user explicitly
approves a separate repair task, touch only tests, fixtures, snapshots, mocks,
test configuration, and the behavior inventory/ledger docs. Existing tests may
be extended, but do not delete or weaken them to make a baseline pass.
