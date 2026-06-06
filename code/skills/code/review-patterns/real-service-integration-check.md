# Real-Service Integration Check

Decide whether mock-only evidence is too weak for the changed boundary, collect the smallest safe proof against the real DB/API/webhook, and name the residual risk when you skip.

## When this gate applies

- Diff touches auth, billing/payments, webhooks, persistence, migrations, cache/proxy behavior, queues/jobs, permissions, or deletion/export flows.
- New or changed test under `**/integration/**`, `**/e2e/**`, `**/*test*db*`, `**/*factory*`, `**/*harness*`, or a diff that adds `vi.mock(`/`jest.mock(` on a critical-path module.
- Any boundary where a test double can diverge from the live contract (status codes, persisted shape, FK/cascade, signature verification).

## Gotchas

1. **Every mock is a lie about how the system works — it passes when reality fails.** The more critical the path (billing, auth, data deletion), the more dangerous the mock. Hunt these specific mock→bug pairings:
   - `vi.mock("@/lib/db/client")` → hides connection-pool exhaustion, query timeout, **FK/cascade + unique-constraint violations, N+1 queries**.
   - `mockStripe.subscriptions.cancel.mockResolvedValue({})` → hides rate limiting, network errors, invalid-subscription state, and **missing-field access** on the real (complex) response object.
   - `findMany.mockResolvedValue([{status:"active"}])` → hides **schema drift** (renamed column / changed type) and real `null` returns → null-pointer in prod.
   - `vi.mock("@/lib/services/subscription")` → hides cascade deletion and grace-period edge cases.
   - `vi.mock("@/lib/email/sender")` → hides template-render errors, DNS failures, rate limits.
   Concrete divergences that ship bugs: mocked `onDelete:"cascade"` **doesn't cascade; the real DB does**; mock allows status transitions the real business logic forbids; real webhook payloads carry fields the mock omits; mocked email templates never render so template errors go undetected.

2. **Mock Risk Assessment Matrix — score before deciding.** `Score = Production Impact (1-5, revenue/data) × Mock Divergence Risk (1-5, how often the mock lies)`. **Score ≥ 8 = MUST be mock-free. Score ≥ 4 = SHOULD be mock-free. Score < 4 = mock is acceptable** (low-risk helper functions). The thresholds are the decision — never hand-wave "high risk" without the 8/4 cutoffs.

3. **Inverted-pyramid smell.** Most projects have many mocked unit tests and few integration tests — flip it for critical paths. A diff that adds many mocked unit tests and no integration test for a billing/auth/data path is structurally pointed the wrong way. Mocks are acceptable **ONLY for pure functions** (no I/O, no DB, no network).

4. **Transaction rollback silently fails to isolate unless the harness uses a SINGLE connection.** Requires `postgres(url, { prepare:false, max:1, idle_timeout:0 })` with `BEGIN` + `SAVEPOINT` in `beforeEach` and `ROLLBACK TO SAVEPOINT` + `ROLLBACK` in `afterEach`. A normal pool breaks rollback isolation — `max:1` is the non-obvious footgun. Done right this gives zero-cleanup, zero-shared-state tests.

5. **Rollback does NOT isolate for:** COMMIT-behavior tests; DDL (`CREATE TABLE` auto-commits in PG); connection-pool tests; replication; cross-service tests. The first four need an isolated DB (`CREATE DATABASE <name> TEMPLATE <base>`); cross-service needs a cleanup registry. Reject a rollback-based proof offered for any of these — it doesn't actually isolate.

6. **Cross-service cleanup must delete in LIFO (reverse) order** to respect FK constraints; naive forward cleanup hits constraint errors. Track `{type,id}` and `entries.reverse()` before deleting.

7. **Production-safety blocklist with specific indicators.** Block any env value containing `sk_live_`, `pk_live_`, or `production`; require `sk_test_*`/`pk_test_*`, sandbox PayPal (`PAYPAL_ENV=sandbox`), `NODE_ENV != production`, and a hard-coded prod-URL denylist before any call runs. "Stripe key is `sk_test_*` not `sk_live_*`" is greppable; "safe target" is not.

8. **Stripe test mode = real API, fake money.** Test cards: `4242424242424242` (success), `4000000000000002` (decline), `4000000000003220` (3DS), `4000000000009995` (insufficient funds). Sessions match `/^cs_test_/`. Drive webhooks with `stripe trigger <event>` / `stripe listen --forward-to`, or build a signed `stripe-signature: t=…,v1=…` HMAC-SHA256 header over `${timestamp}.${body}` to hit the real signature-verification path. A test that never exercises the real signature/decline path is a happy-path stub.

9. **Parity run, then delete the mock.** Run the mocked and mock-free tests side-by-side with the SAME assertions. If mock-free fails while the mock passes, the mock was hiding a bug. Then **delete the mocked version — don't keep both** (doubles maintenance, creates false confidence about which is authoritative).

10. **Test data must be realistic and parallel-safe.** Random UUIDs (`randomUUID()`), never hard-coded ids like `"user-1"` (parallel-test collisions); faker-seeded realistic data (`faker.seed(42)` for determinism), not minimal stubs that skip the schema-validation path.

11. **Structured JSON-line logging is mandatory for a real-service test.** One self-contained JSON object per line to stderr: `suite`/`test`/`phase` (`setup|act|assert|teardown`), `db_snapshot` row counts, and per-assertion `{field,expected,actual,match}`. "Assertion failed" alone is undebuggable in CI; the phase + snapshot + assertion shape tells you the DB state and the exact failure.

## Quick pass

1. Name the changed boundary and the contract it must honor (status codes, persisted shape, side effects).
2. Score the Mock Risk Matrix (Impact × Divergence). Real path if ≥ 8; skip only when both factors are low (< 4).
3. Confirm a safe target before any call: `sk_test_*`/sandbox keys, test URL, `NODE_ENV != production` — block on any `sk_live_`/`pk_live_`/prod-URL match (run `scripts/assert-test-mode.ts`).
4. Pick the smallest real path: rollback-isolated DB test (single connection), sandbox API call, signed-webhook delivery, or migration dry run. Use isolated-DB / cleanup-registry where rollback can't isolate.
5. Run it; capture sanitized, secret-free evidence; show isolation (savepoint/rollback) or LIFO cleanup of any data touched.
6. Compare against the mocked test; record `run`/`skip`/`deep`/`override`/`blocked` with the residual-risk line.

## Deep pass

Escalate when auth, billing, webhooks, or data-loss paths changed, or any Score ≥ 8 path. Add: an isolated faker-seeded fixture; transaction-rollback (or isolated-DB) isolation; a signed/replayable webhook request; structured JSON-line logs with `db_snapshot` and per-assertion records; a parity run against the existing mocked test; and a teardown that proves the data reverted (rollback or LIFO cleanup). If a hidden bug surfaces in the parity run, that bug — not a green mock — is the finding.

## Scripts

- [`scripts/audit-riskiest-mocks.sh`](scripts/audit-riskiest-mocks.sh) — rank files by `vi.mock`/`jest.mock` density (Score-≥-8 candidates first): `./scripts/audit-riskiest-mocks.sh tests src`.
- [`scripts/assert-test-mode.ts`](scripts/assert-test-mode.ts) — production-safety blocklist (`sk_live_`/`pk_live_`/`production` + `NODE_ENV` + prod-URL denylist) as a pre-flight gate: `bun review-patterns/scripts/assert-test-mode.ts` (exit 1 = unsafe target).
- [`scripts/real-service-harness.ts`](scripts/real-service-harness.ts) — `withTestTransaction()`/`getTestDb()` (single-connection rollback isolation), `createSignedWebhook(payload, secret)` (HMAC-SHA256 `stripe-signature`), and `CleanupRegistry` (LIFO, FK-safe) reference implementations to adapt into the repo's test utils.

## False positives

- **Pure-function unit test that mocks nothing real.** A test over an I/O-free pure function (Score < 4) is fine mocked — do not force a real-DB harness on it.
- **Docs-only / config-only / pure-computation diff.** No live boundary changed; skip.
- **"It already has a green mocked test."** A passing mock is the rationalization this gate exists to reject for Score ≥ 8 paths — green mock ≠ real-service proof. Run the parity check, don't accept the green.
- **Setup cost out of proportion to scored risk.** A low-score helper does not justify standing up testcontainers — record the skip rationale, don't build a harness.
- **No safe sandbox/test credentials exist and the only target is production.** This is a `blocked`, not a pass — never run against prod to satisfy the gate.

## Evidence to record

When the gate **runs**: the exact command/request and the status code or test result it returned; a sanitized (secret-free, no customer data) response/log snippet showing the contract held; for a real-DB proof, the savepoint/rollback or LIFO-cleanup that guaranteed isolation; the Mock Risk Score; and the parity result vs. the mocked test.

When the gate is **skipped**: the Mock Risk Score (< 4) or the docs/pure-computation rationale, plus the residual-risk line — never claim a pass.

When the gate is **blocked**: the unsafe-to-run rationale (production-only target, no safe credentials) and the residual human-QA needed.

---
Provenance: distilled from jeffery-skills `testing-real-service-e2e-no-mocks` (SKILL.md + references/{TRANSACTION-ISOLATION, PAYMENT-TESTING, FACTORIES, LOGGING-FORMATS, MIGRATION-PLAYBOOK}.md).
