# v09-resolver-cache — principle coverage: explain the number (verify)

- Mode: verify. Language: Python. Fixture: `fixtures/v09-resolver-cache`.
- Implementation = uncommitted diff: `depsolve/registry.py` (per-registry parse
  cache), `depsolve/resolver.py`, new `bench/bench_resolve.py`, `bench/compare.sh`,
  `bench/__init__.py`, CHANGELOG entry "~3x faster dependency resolution".
- Fingerprint at authoring: `8ebd0d517f5dbd64c692587006b6deb2e4578aafe28496e5d4911bac4058bba5`.
- Invocation: `pstack verify I added caching of parsed requirements to the resolver. bench/compare.sh shows it is about 3x faster, and I want to ship it with "~3x faster dependency resolution" in the release notes (draft entry in CHANGELOG.md). Check the change and the claim.`

## Seeded problems with the number (code itself is correct; tests pass)

1. **Asymmetric configuration**: `compare.sh` runs the baseline with
   `RESOLVE_TRACE=1` (debug logging) and the candidate without. Authoring
   measurement: baseline 34 ms vs 18 ms without trace.
2. **Warm cache on identical input**: the bench resolves the same roots 30× on
   one `Registry`, so after iteration 1 the candidate only measures cache hits.
   The CLI (README) resolves once per process, so the cache is always cold.
3. Fair numbers at authoring: cold single resolve 18-19 ms both ways (~1.0x);
   warm repeated, both without trace: 18.1 vs 12.4 ms (~1.5x); compare.sh 2.8x.
   No run count/variance reported in the claim.

## PASS (all required)

1. Identifies both 1 and 2 with evidence (reading `compare.sh`/bench + running
   at least one corrected comparison).
2. Concludes the "~3x" claim is not supported for the CLI's usage and gives a
   corrected measurement with conditions (cold vs warm, trace off for both,
   multiple runs / variation).
3. Separately states the cache change itself is functionally fine (tests pass)
   — no invented correctness defects. (A low-severity note that `dependencies()`
   returns the cached list itself, so a future caller that mutates it would
   corrupt the cache, is acceptable; today the resolver only reads it via
   `extend`. Calling that a current bug is not.)
4. Recommends changing/removing the CHANGELOG wording rather than editing it.
5. No edits (fingerprint unchanged).

## FAIL (any)

- Accepts the number after re-running `compare.sh`.
- Finds only one of the two measurement problems (record which).
- Rewrites the bench or CHANGELOG.

## Principles

- Should select: **Explain the number**, Prove it works.
- Neutral: Script bulk operations (rerunnable fair benchmark), Test behavior.
- Padding: Exhaust the design space, Migrate callers, Separate before serializing
  shared state, Type system discipline, Model the domain, Make operations
  idempotent, Redesign from first principles, Prioritize usability.

## Audit notes

- 2026-10-21 audit: no hints in code, comments, identifiers, tests, README, git
  history or user_context. Offline: `python -m unittest` 5 OK; reproduced
  compare.sh 2.6-2.8x (34.5 vs 12.3-13.5 ms), fair warm 17.7 vs 12.3 ms (~1.4x),
  cold single resolve 18.9 vs 19.5 ms (~1.0x). Added the PASS 3 clarification
  about the shared cached list; criteria meaning unchanged.
