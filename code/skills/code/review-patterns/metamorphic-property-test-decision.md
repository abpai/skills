# Metamorphic / Property Test Decision

Pick the oracle when output has no trusted exact answer — and if a metamorphic
relation is the answer, make it a *real* test, not a placebo that passes for both
correct and broken code.

## When this gate applies

- Diff touches search/ranking, ML/scoring, compilers/interpreters, parsers,
  serializers, query engines, scientific/math transforms, graphics, optimizers
  — output whose exact expected value is hard to state but whose relationships
  are knowable (the *oracle problem*).
- New/changed tests assert `f(x) == f(x)`, re-compute the function inside the
  test, or compare floats with `==`.
- A "property" / "invariant" / "metamorphic" test is added or modified.
- Behavior is guarded only by a tautology or by fixtures the code itself
  produced.

## Gotchas

1. **A green MR suite proves nothing on its own (placebo suite).** MRs are
   *necessary, not sufficient* conditions. A function that always returns `0`
   satisfies `sin(x) = sin(x)`; a constant-return impl passes many relations.
   The dividing line between a real suite and a placebo is **mutation evidence**:
   plant known bugs and confirm each relation *fails* on the broken impl. Check:
   run `scripts/mr_mutation_matrix.py` against the seven canonical operators
   (off-by-one, sign-flip, zero-out, double, swap-args, drop-element,
   constant-return); require every mutation killed by ≥1 relation, **kill-rate
   ≥ 80%**, or a written equivalent-mutant argument. No kill evidence → not done.

2. **MRs never replace assertions (specification-substitute trap).** "My MR
   suite passes, so the code is correct" is false — MRs augment assertions only
   *where the oracle problem exists*. If you can compute the expected value, use
   a plain assertion; MRs are strictly weaker. Use both for coverage.

3. **Tautologies catch nothing.** `f(x) = f(x)` (no transformation) always passes
   for deterministic `f` — it creates false confidence for correct AND incorrect
   impls. Every relation needs a real transformation `T(x)` (e.g. periodicity
   `f(x) = f(x + 2π)`).

4. **Implementation-derived relations are blind.** If the test re-computes the
   function — `let expected = data.iter().sum() / data.len()` for `mean()` — a
   bug in that logic satisfies both sides. The code smell: the "expected" side
   re-implements the function. Derive relations from the **spec/math/domain**
   (`mean(k·data) = k·mean(data)`), never from the code under test.

5. **Float `==` kills trust.** Exact compares (`sin(x) == sin(PI - x)`) throw
   false failures that get the whole suite abandoned. Use a **relative epsilon**
   that scales with magnitude: `eps = max(|a|,|b|) * 1e-12 + 1e-15` (absolute
   floor near zero). Plain absolute epsilon breaks under scale-invariance.

6. **Edge cases under-deliver.** MR power comes from *diverse random* inputs
   (Hypothesis / proptest / fast-check); many bugs only surface on data patterns
   humans wouldn't curate. Property-based generation is mandatory; fixed inputs
   are a fallback that needs a written rationale, not a co-equal default.

7. **Correlated relations masquerading as a diverse suite.** Four flavors of
   permutation invariance (`sort(reverse(x))`, `sort(shuffle(x))`,
   `sort(rotate(x))`, `sort(swap(x))`) are the SAME property four times — they
   kill one mutation set and miss the rest. NIST showed each of 4 *independent*
   MRs caught *different* bugs. Target **≥5 independent MRs from ≥3 of the six
   categories**; if two would catch the same mutation set, keep only the
   stronger one.

8. **Six-pattern taxonomy — the elicitation menu.** Don't "think of relations";
   walk the buckets: **Equivalence** `f(T(x))=f(x)`, **Additive**
   `f(x+c)=f(x)+g(c)`, **Multiplicative** `f(k·x)=h(k)·f(x)`, **Permutative**
   `f(permute(x))=permute(f(x))`, **Inclusive/Exclusive** (subset / superset /
   disjoint), **Invertive** `f(T(T(x)))=f(x)`. For an unfamiliar domain paste
   `scripts/mr_elicit_prompt.txt` to enumerate ALL relations with category,
   exact `T(x)`, exact relation `R`, bug class, and ALWAYS-vs-sometimes
   confidence.

9. **Strength-matrix scoring decides which survive.** "Drop redundant ones" is
   hand-wavy without a rubric. Score each candidate **Fault Sensitivity(1-5) ×
   Independence(1-5) ÷ Cost** and implement only **Score ≥ 2.0** (richer variant:
   `Fault×3 + Independence×2 + Specificity×1 − Cost`, implement ≥12, discard <6).
   Independence is the tiebreak: 5 orthogonal relations beat 20 correlated ones.

10. **Composition multiplies power but order matters.** If MR₁ and MR₂ are valid
    then `MR₁∘MR₂` is valid, and a chain catches faults *no individual relation
    detects* — free fault-sensitivity. But composition **order matters**:
    `MR₁∘MR₂` may differ in fault detection from `MR₂∘MR₁` (Chen et al.). When
    you chain, justify the order.

11. **Reach for named industrial patterns first.** Don't reinvent: DB **TLP**
    (Ternary Logic Partitioning: `WHERE P ∪ WHERE NOT P ∪ WHERE P IS NULL =
    full table` — found bugs in SQLite/Postgres/MySQL/CockroachDB/TiDB/DuckDB),
    **NoREC** (optimized == unoptimized), **PQS** (insert row → exact-match query
    must find it), **EET** (equivalent expression rewrite). Search: AND term →
    subset, OR term → superset (Live Search bug: `"GLIF"`=11,783 results but
    `"GLIF OR 5Y4W"`=0). Crypto: roundtrip, **avalanche** (flip 1 bit → ~50%
    output bits flip), determinism. Parsers: `parse(serialize(x))=x`. Graphics:
    semantics-preserving shader transforms (GraphicsFuzz caused a whole-phone
    reboot on a Galaxy S6 via valid WebGL).

12. **Name each test after its property, not `test_mr_1` / `test_mr_2`.** Aids
    debugging when a relation fails and you need to know which property broke.

## Quick pass

1. Classify the oracle: exact value / trusted reference / reviewable golden /
   relation-only. **Use the sharpest** — exact assertion if computable,
   differential test against a reference impl, golden if output is reviewable.
   MRs only when none of those exist.
2. Enumerate 1-3 candidate relations by walking the six categories (use the
   elicitation prompt for unfamiliar domains); drop tautologies and
   implementation-derived ones on sight.
3. Score on the strength matrix; keep only Score ≥ 2.0.
4. For each kept relation, fix: input domain, `T(x)`, expected
   `f(x)`↔`f(T(x))` relation, tolerance (relative epsilon for floats), and a
   seed / mocked-time control.
5. Generate inputs property-based, not hand-picked.
6. Run; record command, output, exit status. Confirm the relation *fails* on at
   least one planted bug (cheap inline mutant — not a full mutation campaign).
7. Record the run / skip / deep / override / blocked decision.

## Deep pass

Escalate when the unit needs a durable oracle-free suite:

- Build ≥5 independent relations across ≥3 categories; add ≥1 composite chain
  where the chain's sensitivity exceeds any single relation (justify the order).
- Run the full mutation matrix (`scripts/mr_mutation_matrix.py`): every operator
  killed by ≥1 relation, suite kill-rate ≥80%, or a written equivalent-mutant
  argument for survivors.
- Pin deterministic seeds, an explicit tolerance strategy, and property-based
  generators.
- Mutation testing belongs to a durable suite — don't drag a full campaign into
  ordinary PR prep beyond confirming the landed relations kill one planted bug.

## Scripts

- [`scripts/mr_mutation_matrix.py`](scripts/mr_mutation_matrix.py) — placebo
  detector. Wire `relation_holds(mr, mutation)` to the code under test; it builds
  the MR × mutation detection matrix over the seven canonical operators, asserts
  every mutation is killed by ≥1 relation, and prints the kill-rate. Run:
  `python3 scripts/mr_mutation_matrix.py`.
- [`scripts/mr_elicit_prompt.txt`](scripts/mr_elicit_prompt.txt) — paste-ready
  prompt to enumerate ALL relations for an unfamiliar `[SYSTEM/INPUT/OUTPUT]`,
  each tagged category / exact `T(x)` / exact `R` / bug class / ALWAYS-vs-
  sometimes confidence, prioritized for diversity.
- [`scripts/mr_templates.md`](scripts/mr_templates.md) — proptest/Hypothesis
  skeletons for Equivalence / Subset / Round-trip plus the relative-epsilon
  helper `eps = max(|a|,|b|)*1e-12 + 1e-15`.

## False positives

- **Exact value or reference impl available** — not an MR gate; use a plain
  assertion or differential test. Skip with the stronger oracle named.
- **No property-preserving transformation exists** (opaque blob, no known
  invariant) — MRs have nothing to bite on; do domain analysis first, don't
  force a relation.
- **Uncontrolled nondeterminism** (true randomness, network races, real clock) —
  control it *first* (seed RNG, mock time); a flaky relation is not a finding.
- **Chasing one known bug** — use a targeted regression test, not an MR
  investment.
- **Behavior is not algorithmic** — MRs don't apply.
- Rationalization blacklist: "the suite is green so it's correct" (placebo);
  "the expected side matches the code" (implementation-derived); "edge cases
  cover it" (no diverse generation); "we have 5 MRs" when all 5 are the same
  category (correlated). None of these clear the gate.

## Evidence to record

In the finish-lane verification/QA notes: source contract, the chosen branch
(exact / differential / golden / relation / skip), and a relation table — input
domain, `T(x)`, expected relation, tolerance, generator-or-fixed-input
rationale, category, and Score. Attach the test command, output, exit status,
**and the mutation kill-rate** (or a written equivalent-mutant argument). For a
skip, name the stronger oracle that replaces the relation.

---
Provenance: distilled from `jeffery-skills/testing-metamorphic` (SKILL.md +
references/MR-CATALOG, ANTI-PATTERNS, COMPOSITION, QUICK-REFERENCE).
