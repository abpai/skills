# p01-tenant-reports — plan a small bug fix (handoff case a) + Attack the premise

- Mode: plan. Language: TypeScript (bun). Fixture: `fixtures/p01-tenant-reports`.
- Invocation: `pstack plan The "writes one report per tenant" test in tests/reports.test.ts fails on CI every few runs. We already bumped its timeout to 10s, wrapped it in a 3-attempt retry, and added a 50ms delay after each write in writeTenantReports so the filesystem can flush. It still flakes. Plan a proper fix.`

## Ground truth (hidden)

- The failures are deterministic given the random input: `fileNameFor()`
  (`src/reports.ts`) maps distinct tenant names to the same file name
  (`"Acme Globex"`, `"Acme-Globex"`, `"Acme & Globex"`, `"Acme.Globex"` →
  `acme_globex.csv`), so a later tenant overwrites an earlier tenant's CSV.
  The test's random names collide in ~60% of attempts; with 3 retries the
  suite fails ~25-40% of runs (measured 9/30, re-measured 11/30 in audit).
- This is a production defect, not just a test defect: `data/tenants.json`
  already contains `Acme Corp` and `Acme-Corp`; `bun src/cli.ts data/tenants.json out/`
  prints "wrote 5 reports" but writes 4 files, and README says files are synced
  to each tenant's download area by file name, so one tenant receives
  another's usage report.
- The shared premise of the three failed fixes is "it is a timing / filesystem
  flush problem". Nothing is concurrent (writes are sequential and awaited).
- Smallest root-cause fix: make the file name unique per tenant (e.g. derive it
  from `tenant.id`, or id + slug), then remove the 50ms delay, the retry
  wrapper, and the timeout bump; make the test deterministic with fixed
  inputs that include names differing only by punctuation.

## PASS (all required)

1. Plan explicitly names the timing/flush assumption shared by the earlier
   fixes and says how to test it (e.g. run with fixed or logged inputs, compare
   file count with tenant count, loop the test with a seed), before or instead
   of another timing fix.
2. Plan identifies file-name collision in `fileNameFor` / `src/reports.ts` as
   the cause (or, if the agent did not get there, states a concrete next
   investigation that would reveal it — this downgrades to friction, not FAIL,
   only if no timing workaround is proposed).
3. Fix is placed at the source (file naming), not in the test alone.
4. Plan removes (or says to remove) the `delay(50)` workaround and the
   retry/timeout workarounds once the cause is fixed.
5. Plan says the regression test should use concrete colliding names
   (deterministic), checking observable output (one file per tenant / content
   belongs to the right tenant), not randomness or internals.
6. Plan mentions the production impact (reports overwritten / wrong tenant) or
   the duplicate-looking names in `data/tenants.json` — at least one.
7. Short: outcome sentence + ≤ ~7 pointers; no implementation listing.
8. Run-dir unchanged.

## FAIL (any)

- Proposes another timing-based mitigation (longer delay, fsync, more retries,
  `test.serial`, larger timeout) as the fix.
- Treats it as a concurrency/locking problem and plans locks or serialization.
- Plan edits files or writes the implementation.
- Selects ≥ 2 padding principles.

## Principles

- Should select: **Attack the premise**, **Fix root causes**,
  Subtract before you add (remove delay/retry/timeout), Test behavior, not implementation.
- Neutral: Laziness protocol (smallest fix), Prove it works, Sequence verifiable units.
- Padding: Separate before serializing shared state (no concurrency here),
  Make operations idempotent, Explain the number, Exhaust the design space,
  Prioritize usability, Migrate callers then delete legacy APIs,
  Outcome-oriented execution, Redesign from first principles, Type system
  discipline, Script bulk operations, Encode lessons in structure.

## Evidence to record

Whether the agent ran the test repeatedly or reproduced the collision; whether
it ran the CLI on `data/tenants.json`; selected principles list.
