# Metamorphic Property Test Decision

Role: Choose the right oracle strategy when exact expected output is hard but
valid relationships are knowable.

## Goal

Decide between conventional assertions, differential tests, golden artifacts,
metamorphic/property tests, or a concrete skip. If relation testing applies,
name the invariant, transformation, expected relationship, and evidence.

## Use When

Use for search/ranking, ML/scoring, compilers/interpreters, parsers, query
engines, scientific/math transforms, graphics, serializers, optimizers, or
complex generated output without a trusted exact oracle.

## Success Criteria

- Decision records why the chosen test strategy fits.
- Relations come from spec/domain behavior, not implementation internals.
- Each relation has input `x`, transformation `T(x)`, expected relation between
  `f(x)` and `f(T(x))`, and bug class caught.
- Normal PR gate names one to three high-confidence, low-cost relations or a
  concrete skip.
- Deep escalation controls generators, seeds, tolerances, and nondeterminism.

## Constraints

- Prefer simpler stronger proof first: exact assertions, reference/differential
  tests, or goldens when they are sharper.
- Do not force mutation testing into ordinary PR prep.
- Do not create tautological properties copied from code.

## Quick Pass

1. Classify oracle availability: exact, trusted reference, reviewable golden,
   known relation, or domain analysis needed.
2. Prefer the stronger simpler tool when available.
3. List one to three candidate invariants from the contract/spec.
4. Drop redundant or vague relations.
5. Define input domain, transformation, expected relation, tolerance, seed/time
   controls, and test name.
6. Record selected/skipped/escalated decision and evidence.

## Deep Escalation

Use for reusable oracle-free suites. Add generated inputs, deterministic seeds,
tolerance strategy, planted-bug/mutation evidence, and coverage of independent
relation categories.

## Evidence

Record source contract, decision branch, invariant, transformation, expected
relationship, generator or fixed-input rationale, tolerance/seed controls,
command/test output, and skip rationale.

## Skip Or Stop Rules

Skip when exact output is available, a reference implementation exists, no
meaningful transformation exists, nondeterminism is uncontrolled, a single known
bug needs regression coverage, or behavior is not algorithmic/oracle-free.

## Output

Return strategy decision, proposed or implemented tests, and residual risk.
