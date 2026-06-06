# Isomorphic Simplification

Catch the refactor that reads as pure cleanup but silently changes behavior, and recommend a merge/extraction/deletion only when behavior is protected by proof.

## When this gate applies

- Diff shows duplication, helper/component extraction, a DRY/`refactor:` intent, or files renamed `_v2`/`_new`/`_improved`/`_copy`.
- Diff deletes a file, function, module, or symbol ("dead code", "unused", "cleanup").
- Diff was AI-generated (Claude Code / Codex / Cursor / Gemini session) — slop pathologies (P1-P40) are the dominant refactor surface, not legacy spaghetti.
- `prepare-pr` routes this gate from `changed-files.txt`.

## Gotchas

1. **DRY is about knowledge, not code.** The merge test is exactly one question: *would changing X require updating both sites in the same way?* Yes = duplicate knowledge (Type I/II/III; merge). No = coincident code (Type V; leave). Two tax functions for two jurisdictions look byte-identical today and diverge the first time one rate changes — merging gets undone. Success is **not** measured in LOC removed; it is measured in *changes that now touch one place where they used to touch many*. LOC is only a proxy.

2. **Merging the wrong clone is worse than the duplication it removes.** Classify every candidate before merging:
   - **I exact** — byte-identical, ≥3 callsites → extract a function. (At 2 callsites, leave it: Rule of 3.)
   - **II parametric** — same shape, one axis of variance (type/literal) → parameterize; type-check that callers still infer the right type.
   - **III gapped** — same shape with small additions → enum/strategy dispatch *only if* variance is one axis and bounded. Many gaps or growing gaps → **leave**; readers want the branches physically separate, and a `{'create': db.insert, ...}[action]` dispatch forces every reader to branch mentally (net loss).
   - **IV semantic clone** — different code, same behavior (e.g. `[...new Set(xs)]` vs sort-and-uniq: one preserves insertion order, one needs comparable `T`) → **stop**. Never merge until tests pin every observable difference. The "right" fix is often delete-one-and-update-callers — that is a behavior change, not a refactor.
   - **V accidental rhyme** — `ms_to_seconds` vs `bytes_to_kib`, both `x / 1000` → **never** merge; coupling cost > LOC savings. Fixing KiB to `/1024` would force touching the time function.

3. **Type V re-proposal loop — kill it with an in-code comment.** Scanners flag accidental rhymes. Reviewers reject them. Then the next agent runs the scanner and re-proposes the same merge. Leave the code AND add a rejection comment so it stops cycling: `// shape rhymes with ms_to_seconds but unrelated; do not merge`.

4. **"Dead code" is the most dangerous phrase an agent can compose.** Horror story: an agent grepped imports of `sync-pipeline.ts` → 0 hits → deleted the file *and its tests*. Tests passed (the assertions left with the file), build passed, typecheck passed. **Every verify gate was green; the judgment was wrong** — the file was the canonical intended implementation path. Deleting a file together with its tests makes the test-reference check pass trivially and meaninglessly. Run the **12-step dead-code gauntlet** (Deep pass) before proposing *any* deletion; ANY fail → `git mv` to `refactor/_to_delete/` and ask. Never `rm`.

5. **Reflexive "N/A" on an isomorphism axis is the most common way bugs ship.** For each change, name the breaker, do not just assert "preserved":
   - **Laziness** — `Iterator → .collect::<Vec>()` kills laziness; a caller that did `take(10)` now does all rows (peak memory + latency change).
   - **Short-circuit** — don't hoist a side-effecting call out of `a ?? compute()`; `compute()` now always runs.
   - **Floating-point** — reordering a sum changes the f64 bits; matters for content-addressed storage and training-data pipelines that hash output.
   - **Serialization key order** — `serde_json` is field-order-stable for structs but **not** for `HashMap`; use `IndexMap`/`BTreeMap` when a signature check, log grep, or downstream ETL compares the wire bytes.
   - **Error-variant widening** — a new `From` impl makes errors that used to arrive as `Foo(_)` now arrive as `Bar(_)`, silently falling into a caller's `_` match arm. Grep callers for `match`/`if let`/`instanceof`/`except` on the error type.
   - **React component identity** — `{cond ? <A/> : <B/>}` mounts/unmounts on toggle; unifying to `<C variant={...}/>` now *preserves* state across the toggle (may or may not be wanted).

6. **A cleanup that fixes a real bug is NOT isomorphic — split it, don't bury it.** When the behavior IS wrong and the refactor fixes it incidentally, ship the behavior change in its own commit (`fix: X used to silently swallow Y`), then the simplification on top, with its card honestly marked "now isomorphic to FIXED behavior, not original." Burying the fix in a refactor breaks `git bisect`, reviewers miss it, and release notes lie.

7. **AI-slop is the dominant surface here, not legacy spaghetti.** Session amnesia + autocomplete momentum + addition bias accumulate a characteristic, named set of pathologies (P1-P40). Hunt them by name: P1 over-defensive try/catch, P2 nullish-chain sprawl, P3 orphan `_v2`/`_new`/`_improved` files, P4 `utils`/`helpers` dumping grounds, P5 `BaseXxxManager`/`Abstract*` hierarchies, P8 pass-through wrappers, P10 `catch{return null}` / `except: pass`, P14 dead mocks, P15 compounding `any`, P19 `for x: await fetch(x)` N+1, P22 stringly-typed state machines, P31 `JSON.stringify` as a memo/cache key, P32 float arithmetic for money. The slop detector emits all of these as ranked per-file counts.

8. **Abstraction is monotonic in cost, non-monotonic in benefit — never skip rungs.** Ladder: 0 copy-paste (1-2 sites) → 1 extract fn → 2 parameterize (one axis) → 3 enum/strategy (2+ bounded axes) → 4 trait/interface (open set) → 5 generic+bound (cross-crate) → 6 DSL/macro (done 3+ times). Rungs 4+ are **bets** that pay off only if open-ended generality is actually used; most never are. Skipping (rung 0 → 4) gives you `AbstractFactoryBeanFactory`. Over-abstraction taxes: where-do-I-look, every-change-touches-everything, and parameter-accumulation decay (`render(component, props, *, theme, locale, fallback, suspense_boundary, tracing_span, ...)`).

9. **Rule of 3 — the third instance teaches the axis of variance.** One = a shape, two = a coincidence, three = the parameter to extract. Abstract at two and you guess the parameter wrong → a wrong abstraction **plus** a copy-paste (strictly worse than two copy-pastes). The 4th instance is the diagnostic: slots in cleanly = right rung; forces a new parameter = over-fit.

10. **Metric-tension signals diagnose a bad refactor even when one axis looks clean.** LOC down + complexity up = you inlined helpers into a conditional → re-extract. LOC up + duplication down = the new abstraction is bigger than the dup it replaced → audit. All metrics improved + perf regressed = watch for an introduced `.clone()` or a collected iterator → profile. Report the test **pass count** (not just "green") and warnings before ≥ after. If tests are flaky, lock a seed and re-run 5× (4/5 vs 3/5 means it was already broken, not your refactor).

## Quick pass

1. Confirm applicability from the diff itself, not from naming or structure; bound scope to changed files + their direct callers.
2. Gather behavior proof **first**: tests, goldens, explicit invariants, a callsite census, or a source contract.
3. Classify each duplication candidate (I-V). Run the False positives list below before proposing any merge.
4. Fill the isomorphism card — name every axis (output/ordering/tie-break/error semantics/laziness/short-circuit/FP/serialization/side-effect order+cardinality/type narrowing/React identity); no blank or reflexive-"N/A" rows. Can't fill a row → you don't understand the change well enough to make it.
5. Propose one lever per commit, smallest first; rerun targeted validation after each.

## Deep pass

Escalate on: deletions, semantic clones (Type IV), cross-async/ordering/error-semantics boundaries, AI-generated trees, or refactors spanning many callers.

- **Opportunity Matrix** — score each candidate `Score = (LOC_saved × Confidence) / Risk`; ship only **Score ≥ 2.0** (below that the coupling cost likely exceeds the LOC savings). LOC 1-5 (5 = ≥200 lines, 4 = 50-200, 3 = 20-50, 2 = 5-20, 1 = <5). Confidence 1-5 (5 = scanner + golden-diff confirm equivalent, 3 = looks the same but only one callsite tested, 1 = "these feel similar"). Risk 1-5 (5 = crosses async/ordering/error-semantics boundary, 3 = crosses module boundary / shared state, 1 = single pure function).
- **Callsite census before scoring** — enumerate every reference (source / dynamic / string / test / build / config / docs) so the merge decision rests on actual reach, not a scanner pair-match.
- **12-step dead-code gauntlet** before declaring anything dead. All 12 must pass; ANY fail → `git mv` to `refactor/_to_delete/` and ask, never `rm`:
  1. source imports (mind path aliases `@/`, `~/`, Cargo/Go workspace aliases) · 2. dynamic refs (`import()`/`require`/`importlib`/`getattr`/`dlopen`/`inventory::submit!`/`plugin.Open`/reflection/struct-tags) · 3. string refs in config/JSON/YAML/routes/analytics · 4. test refs (**only meaningful if you preserve the tests**) · 5. build-file refs · 6. feature-flag refs incl external LaunchDarkly/Statsig · 7. doc/ADR refs · 8. git-history scaffold/`wip`/`initial`/`<30 days old`/prior-revert signal · 9. companion files (`.test`/`.stories`/`.md`) · 10. named-intent tokens in the filename (`wip`/`stub`/`scaffold`/`v2`/`future`/`planned`) · 11. owner via `git blame` · 12. explicit user "yes, delete" with the path.
- **Property tests pin behavior** — add `f(g(x))==x`, `sort(f(xs))==sort(g(xs))`, `len(f)==len(g)` *before* the refactor as the regression net for Type IV merges and ordering-sensitive changes.

## Scripts

- [`scripts/ai_slop_detector.sh`](scripts/ai_slop_detector.sh) — `ai_slop_detector.sh <src-dir>`. Ripgrep scan for P1-P40 vibe-coded pathologies; emits ranked per-file `slop_scan.md`. Highest-leverage asset for an AI-generated PR. Requires `rg`.
- [`scripts/dead_code_safety_check.sh`](scripts/dead_code_safety_check.sh) — `dead_code_safety_check.sh <path> [symbol]`. Runs the 12-step gauntlet; exits non-zero (DO NOT DELETE) if any check fails or is pending. Preserves you from the delete-the-file-and-its-tests false-dead failure.
- [`scripts/callsite_census.sh`](scripts/callsite_census.sh) — `callsite_census.sh <symbol> [run-id]`. Enumerates every reference (source/import/string/test/build/CI/config/docs) and flags blast radius before any merge/parameterize decision.
- [`scripts/score_candidates.py`](scripts/score_candidates.py) — `score_candidates.py <duplication_map.md> [--accept-threshold 2.0]`. Applies the Opportunity Matrix with 1-5 anchors; defaults Conf/Risk to 3/2 and warns to re-score by hand after the callsite census.

## False positives

Scanner hits that look like duplication but must **not** be merged:

- **Test `setUp` boilerplate** — fixtures should be readable in place; use the framework's `BeforeAll`/`setUp`, not a shared helper.
- **Error-format strings** — `log.error("failed to X: %v", err)` at every handler: similar strings, different meanings. Extracting `logFailure(action, err)` loses the call-site location and handler-specific context.
- **SQL SELECTs sharing a JOIN** — different SELECT columns = different network bytes; different WHERE = different query plans. A shared `_join_*()` fragment usually harms.
- **Validation snippets** — `if (!user) throw` at 30 sites: the fix is TypeScript narrowing (`User | null` discriminator) or `zod` at the boundary, not `assertUser()`. The duplication is a symptom of weak types.
- **Per-handler exception blocks** — extract a decorator/context manager *only if* metric tagging and log fields are identical; if each tags differently, leave them.
- **Import blocks** — inherently local; `jscpd` flags them, ignore.
- **Type V accidental rhymes** — same shape, unrelated lifecycle; leave and add the rejection comment (Gotcha 3).

## Evidence to record

In the finish-lane artifacts, record per candidate: `file:line`, the callsite census output, the clone classification (I-V), the preservation proof relied on (tests/goldens/invariants/source contract), the Matrix score, the filled isomorphism card, validation commands + results, golden-diff status, and the reason for any skip. Note the metric-tension check (LOC/complexity/duplication/perf deltas and the test **pass count** before/after, not just "green"). For deletions, attach the 12-step gauntlet result and the `git mv`-to-`_to_delete/` + ask decision. When skipping, record the gate decision as `run`/`skip`/`deep`/`override`/`blocked` with a concrete rationale.

Skip when: tests are red with no baseline, no behavior proof exists, candidates only look alike (Type IV/V), the change would grow parameter sprawl past one axis, or coupling risk exceeds the clarity gain.

---
Provenance: distilled from `simplify-and-refactor-code-isomorphically` (SKILL.md + references DUPLICATION-TAXONOMY, ISOMORPHISM, ABSTRACTION-LADDER, DEAD-CODE-SAFETY, VIBE-CODED-PATHOLOGIES, METRICS-DASHBOARD; scripts ai_slop_detector.sh, dead_code_safety_check.sh, callsite_census.sh, score_candidates.py).
