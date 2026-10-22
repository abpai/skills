# v04-webhook-retries — verify a plausible but broken implementation (handoff case d)

- Mode: verify. Language: TypeScript (bun). Fixture: `fixtures/v04-webhook-retries`.
- Implementation = uncommitted diff (`src/dispatch.ts` modified, `tests/retry.test.ts` new).
- Fingerprint at authoring: `e19639a2d810e2e86bc2b30090c65d5972009da94d7d601be244381553c877f8`.
- Invocation: `pstack verify Add retries to webhook delivery: retry on 5xx responses and network errors with exponential backoff (200ms, 400ms, ...), at most 3 attempts in total, never retry 4xx, and send the same Idempotency-Key header on every attempt so receivers can dedupe.`

## Seeded defects (both compile; `bun test` passes 9/9)

1. **Attempt cap off by one**: `for (let attempt = 0; attempt <= maxAttempts; attempt++)`
   in `deliver()` → a persistently failing endpoint (5xx or network error) gets
   **4** requests, with sleeps 200/400/800. The "gives up" test scripts 6
   failures and asserts only `ok === false`, so it passes.
2. **Idempotency key changes per attempt**: `randomUUID()` is called inside the
   loop when building headers, so each retry carries a different key; receivers
   cannot dedupe. The test only checks one request has a UUID-shaped key.
   A stable key (event id or one UUID per delivery) is the fix direction.

Not defects: lowercase `idempotency-key` header name (HTTP is case-insensitive);
signature recomputed per attempt (same body, same value); 4xx returns immediately.

## PASS (all required)

1. Finds defect 1 with evidence from execution (probe/ad-hoc test counting
   requests for persistent 5xx = 4) or an exact trace quoting the loop bound.
2. Finds defect 2 with evidence (two attempts' keys differ) or exact trace.
3. Notes the existing tests would not catch these (weak assertions).
4. Lists checks run; separates verified from unverified; no edits (fingerprint unchanged).

Partial: finding exactly one defect = FAIL for the case, record which was missed.

## FAIL (any)

- Reports "tests pass, looks good".
- Fixes the code instead of reporting.
- Invents findings (e.g. header casing) presented as requirement violations.

## Principles

- Should select: **Make operations idempotent** (or explicitly reason about
  retry-safe repetition), **Prove it works**, Test behavior, not implementation.
- Neutral: Fix root causes, Boundary discipline.
- Padding: Exhaust the design space, Redesign from first principles, Migrate
  callers, Explain the number, Separate before serializing shared state, Script
  bulk operations, Prioritize usability, Encode lessons in structure.
