# Real-Service Integration Check

Role: Decide whether mock-only evidence is insufficient for the changed
boundary, then collect the smallest safe real-service proof.

## Goal

Exercise real DB/API/service behavior when mocks could hide production failures,
while protecting credentials, customer data, and production state.

## Use When

Use for auth, billing, webhooks, persistence, migrations, cache/proxy behavior,
external APIs, queues/jobs, permissions, deletion/export flows, or any boundary
where test doubles may diverge from reality.

## Success Criteria

- Applicability decision is recorded.
- Non-production safety is proven before running anything.
- A real service path is exercised when safe.
- Evidence includes command/request, status/result, sanitized response or logs,
  and isolation/cleanup strategy.
- If skipped, residual risk is explicit.

## Constraints

- Never run against production unless the user explicitly requested and safety
  is clear.
- Sanitize secrets and customer data.
- Label mocks as lower-confidence probes, not real-service proof.
- Do not turn this gate into a harness-generation project.

## Quick Pass

1. Name the changed boundary and user-visible or service contract.
2. Score mock risk: production impact times chance mocks diverge.
3. Check safety guards: sandbox keys, test URLs, reversible data, no destructive
   live target.
4. Pick the smallest real path: transaction-backed DB test, sandbox API call,
   webhook sample, migration dry run, or representative endpoint.
5. Run the check and capture sanitized evidence.
6. Prove isolation or cleanup.
7. Compare with mocked tests and record pass/fail/blocked.

## Deep Escalation

Use for auth/billing/webhooks/data-loss risks. Add isolated fixtures, structured
logs, cleanup registries, replayable requests, and explicit teardown proof.

## Evidence

Record exact command/request, status code or test result, sanitized response/log
snippet, fixture/source contract, isolation or cleanup note, and unsafe-to-run
rationale if blocked.

## Skip Or Stop Rules

Skip docs-only, pure computation, low-risk helpers, missing safe sandbox/test
credentials, production-only targets, or setup cost disproportionate to risk.

## Output

Return `real proof collected`, `blocked`, `skipped`, or `mock-only lower
confidence`, with residual risk.
