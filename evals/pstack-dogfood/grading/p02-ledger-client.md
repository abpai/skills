# p02-ledger-client — plan an internal API migration (handoff case b) + `--plan` routing

- Mode: plan via the `--plan` prefix. Language: TypeScript (bun). Fixture: `fixtures/p02-ledger-client`.
- Invocation: `pstack --plan Move every caller off legacyRequest onto fetchJson and delete legacyRequest. src/lib/http.ts is internal to this package; nothing outside src/ imports it.`

## Ground truth (hidden)

- 7 `legacyRequest` call sites in 4 files: `src/accounts.ts` (2), `src/transactions.ts` (2),
  `src/payees.ts` (2), `src/sync.ts` (1). `src/reports.ts` already uses `fetchJson`.
- Behavior that must survive: `getAccount`/`getPayee` return `null` on 404;
  `createTransaction` rejects with `ValidationError(fields)` on 422; other
  non-2xx reject. `fetchJson` throws `HttpError(status, body)` on any non-2xx,
  so callers must catch `HttpError` and branch on `.status`. Option name changes:
  `json` → `body`; query typing widens.
- `pullChanges` callback recursion becomes a simple loop.
- `tests/accounts.test.ts` and `tests/sync.test.ts` spy on `legacyRequest`
  and assert its call arguments; they must be rewritten to use the existing
  `fakeTransport`/`setTransport` helpers (behavioral), not re-pointed to spy on
  `fetchJson`. The other test files already work through the transport and
  should keep passing unchanged.
- Final state: `legacyRequest`, `LegacyRequestOptions`, `LegacyCallback`
  removed from `src/lib/http.ts`; `grep -r legacyRequest src tests` empty;
  `bun test` green.

## PASS (all required)

1. Routing: `--plan` is accepted as the plan mode and produces a plan (not a
   usage message, not an error, not implementation).
2. Plan migrates all callers and deletes `legacyRequest` (and its types) in the
   same change; no adapter, shim, deprecated alias, or `legacyRequest`
   re-implemented on top of `fetchJson`.
3. Plan calls out preserving 404→null and 422→`ValidationError` semantics
   (status-dependent branches) when moving from callback `status` to thrown `HttpError`.
4. Plan says the spy-on-`legacyRequest` tests must be rewritten against the
   transport fake (or otherwise through observable behavior), not merely
   re-targeted.
5. Success check named: grep for leftover references + `bun test`.
6. Concise; implementation left flexible; run-dir unchanged.

## FAIL (any)

- Keeps `legacyRequest` (deprecated or wrapper) or adds a compatibility layer
  "for safety"/staged removal in a later PR.
- Misses the 404/422 behavior difference entirely.
- Writes the code or edits files.
- ≥ 2 padding principles.

## Principles

- Should select: **Migrate callers, then delete legacy APIs**, Test behavior, not implementation.
- Neutral: Outcome-oriented execution, Sequence verifiable units, Laziness protocol,
  Subtract before you add, Script bulk operations (only 7 sites — a codemod
  framework would be padding; a grep check is fine), Minimize reader load
  (callback→async flattening). The scenario's `target_principles` also list
  Outcome-oriented execution and Sequence verifiable units: selecting them is
  fine, omitting them is not a fail.
- Padding: Exhaust the design space, Prioritize usability, Separate before
  serializing shared state, Make operations idempotent, Explain the number,
  Attack the premise, Fix root causes, Encode lessons in structure, Redesign
  from first principles.
