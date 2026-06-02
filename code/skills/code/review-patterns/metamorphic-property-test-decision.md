# Metamorphic Property Test Decision

Role: Pick the test oracle for output whose exact expected value is hard to
state but whose valid relationships are knowable.

## Goal

Stop code from shipping untested, or guarded only by a tautology, because no
trusted exact oracle exists. For each unit at risk, land on one decision: exact
assertion, differential/reference test, golden artifact, metamorphic/property
relation, or a skip with stronger evidence named. When a relation is chosen,
write it down with enough detail that a reader can run it: input domain,
transformation `T(x)`, expected relation between `f(x)` and `f(T(x))`, and the
bug class it catches.

## Use When

Use for search/ranking, ML/scoring, compilers/interpreters, parsers, query
engines, scientific/math transforms, graphics, serializers, optimizers, or
other generated output with no trusted exact oracle.

## Success Criteria

- Decision recorded per unit: exact, differential, golden, relation, or skip.
- Relations derive from spec or domain behavior, never copied from the code
  under test.
- Each relation states input domain, `T(x)`, expected `f(x)`-to-`f(T(x))`
  relation, tolerance, and bug class caught.
- Quick pass lands one to three high-confidence, low-cost relations or a skip
  with the stronger oracle named.

## Constraints

- Reach for the sharper proof first: exact assertions, reference/differential
  tests, or goldens when they pin behavior more tightly than a relation.
- Do not pull mutation testing into ordinary PR prep.
- Do not write relations that restate the implementation; they pass by
  construction and catch nothing.

## Quick Pass

1. Classify the oracle: exact value, trusted reference, reviewable golden, or
   known relation only.
2. If a sharper oracle exists, use it and skip the relation work.
3. List one to three candidate invariants from the contract or spec; drop
   redundant or vague ones.
4. For each kept relation, define input domain, `T(x)`, expected relation,
   tolerance, and a fixed seed or time control.
5. Run the test; record the command, output, and exit status.
6. Record the run / skip / deep / override / blocked decision and evidence.

## Deep Escalation

Escalate when the unit needs a durable oracle-free suite. Add generated inputs,
deterministic seeds, an explicit tolerance strategy, planted-bug or mutation
evidence that the relations fail on a broken implementation, and coverage
across independent relation categories.

## Evidence

Record in gate-decisions.md: the source contract, the chosen decision branch,
and a relation table (input domain, `T(x)`, expected relation, tolerance,
generator or fixed-input rationale). Attach the test command, its output, and
exit status. For a skip, name the stronger oracle that replaces the relation.

## Skip Or Stop Rules

Skip when an exact value or reference implementation is available, no meaningful
transformation exists, nondeterminism is uncontrolled, a single known bug only
needs regression coverage, or behavior is not algorithmic. If exact output is a
weak oracle, route to the golden-artifact gate or back here for relations.

## Output

Return run / skip / deep / override / blocked per unit, the proposed or implemented
relations, and residual risk.
