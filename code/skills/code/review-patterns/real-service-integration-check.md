# Real-Service Integration Check

Role: Decide whether mock-only evidence is too weak for the changed boundary,
then collect the smallest safe proof against the real service.

## Goal

Catch failures that mocks hide: a stubbed DB, API, or webhook passes while the
real one rejects the call, drops the row, or returns a different status. Done
means one of two recorded outcomes in gate-decisions.md: a sanitized trace of
the real path succeeding, or an explicit skip with the residual risk named.

## Use When

Auth, billing, webhooks, persistence, migrations, cache/proxy behavior,
external APIs, queues/jobs, permissions, or deletion/export flows changed, or
any boundary where a test double can diverge from the live contract.

## Success Criteria

- The mock-risk decision (run / skip) is written to gate-decisions.md.
- A non-production target is confirmed before any call runs.
- The real path is exercised, or the skip carries a stated residual risk.
- Captured evidence is sanitized of secrets and customer data.
- Data touched is isolated or cleaned up, and that is shown.

## Constraints

- Never run against production unless the user asked and the target is clearly
  safe.
- Sanitize secrets and customer data in every captured artifact.
- A mock run is a lower-confidence probe, never real-service proof; label it so.
- Do not build a test harness; collect the smallest sufficient proof.

## Quick Pass

1. Name the changed boundary and the contract it must honor (status codes,
   persisted shape, side effects).
2. Score mock risk = production blast radius x odds the mock diverges. Run the
   real path when either is high; skip only when both are low.
3. Confirm a safe target: sandbox keys, test URLs, reversible data, no
   destructive live endpoint.
4. Pick the smallest real path: transaction-rolled-back DB test, sandbox API
   call, sample webhook delivery, or migration dry run.
5. Run it and capture sanitized evidence.
6. Show isolation or cleanup of any data touched.
7. Compare against the mocked test and record run / skip in
   gate-decisions.md.

## Deep Escalation

Escalate when auth, billing, webhooks, or data-loss paths changed. Add an
isolated fixture, a replayable request, structured logs of the call, and a
teardown step that proves the data was reverted.

## Evidence

- Exact command or request, and the status code or test result it returned.
- Sanitized response or log snippet showing the contract held.
- The fixture or sandbox source and how isolation/cleanup was guaranteed.
- For a skip: the residual-risk line as written to gate-decisions.md.
- For a block: the unsafe-to-run rationale (production-only target, no safe
  credentials).

## Skip Or Stop Rules

Skip docs-only or pure-computation changes, low-risk helpers, and cases where
no safe sandbox/test credentials exist or the only target is production. Skip
when setup cost is out of proportion to the scored risk. A forced skip records
the residual risk rather than claiming a pass.

## Output

Return the gate decision: `run`, `skip`, `deep`, `override`, or `blocked`, each with its
evidence or residual-risk note recorded in gate-decisions.md.
