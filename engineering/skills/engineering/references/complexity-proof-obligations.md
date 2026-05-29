# Complexity Proof Obligations

Use these as required checks before promoting a finding to fix-ready or before
calling a patch verified.

## Repeated Lookups

- Preserve first-match, last-match, all-match, or duplicate-error behavior.
- Preserve key normalization, case sensitivity, locale, and null handling.
- Preserve output ordering.
- Confirm key equality is stable enough for `Map`, `Set`, dict, or grouping.

## Membership Checks

- Confirm the membership collection is not mutated during iteration.
- Preserve object identity semantics in JavaScript and hashability semantics in
  Python.
- Do not collapse distinct records that merely share a display label.

## Sorting

- Confirm intermediate sorted states are not externally observed.
- Preserve comparator behavior, tie breaking, locale, null ordering, and stable
  ordering guarantees.
- Prefer measured evidence before replacing simple linear code with a complex
  data structure.

## N+1 Queries Or API Calls

- Preserve tenant, authorization, soft-delete, status, and feature-flag filters.
- Preserve ordering, pagination, missing-record behavior, retry behavior, and
  error semantics.
- Confirm the batched call does not fetch data the prior per-item path could not
  see.
- Verify with query counts, logs, or `EXPLAIN` when possible.

## Render-Derived Work

- Confirm the transform is on a hot render path or large collection.
- Preserve dependency arrays and every semantic input to memoized values.
- Do not memoize mutable input objects unless mutation boundaries are clear.
- Prefer moving data preparation out of render over sprinkling memoization.

## Caching

- Name the cache key, invalidation trigger, TTL if any, and stale-data behavior.
- Preserve permission and tenant boundaries in cache keys.
- Verify misses, hits, invalidation, and error paths.

## Bundle Or Load Hotspots

- Confirm the import is on a user-visible route or startup path.
- Preserve side effects and CSS/order-sensitive imports.
- Verify route load, tree shaking, and bundle delta with the repo's existing
  analyzer when available.
