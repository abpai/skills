# Isomorphic Simplification

Role: Find behavior-preserving simplifications only when behavior is protected.
This is not a negative-LOC contest.

## Goal

Remove accidental complexity without changing public behavior, outputs, side
effects, interfaces, ordering, timing assumptions, or error semantics.

## Use When

Use when changed code shows duplication, accidental complexity, helper/component
reuse opportunities, refactor intent, DRY intent, or `prepare-pr` recommends
this gate.

## Success Criteria

- Behavior proof exists: tests, goldens, explicit invariants, callsite evidence,
  or source contract.
- Duplication is classified before merging: exact, parametric, bounded variance,
  semantic clone, or accidental rhyme.
- Any simplification has low coupling cost and clear preservation evidence.
- Skips are explicit and concrete.

## Constraints

- Do not hide behavior changes inside cleanup.
- Do not merge similar-looking code with different lifecycles.
- Do not introduce generic helpers for two weakly related cases.
- Do not cross async/order/error/side-effect boundaries without proof.

## Quick Pass

1. Decide applicability from the diff, not vibes.
2. Bound scope to changed files and direct callers.
3. Gather behavior proof before recommending changes.
4. Classify simplification candidates.
5. Check preservation axes: error semantics, ordering, laziness, side effects,
   logs/metrics, nullability, units, type narrowing, render behavior.
6. Recommend one small lever at a time.
7. Rerun targeted validation after any change.

## Deep Escalation

Use for larger refactors. Write a behavior-preservation note, enumerate call
sites, update or add goldens/invariants where appropriate, and validate after
each lever instead of one giant rewrite.

## Evidence

Record candidate file:line refs, callsite/search output, preservation proof,
validation commands/results, golden diff status if relevant, and skip reasons.

## Skip Or Stop Rules

Skip when tests are red without a baseline, no proof exists, candidates merely
look similar, parameter sprawl would grow, or coupling risk exceeds clarity gain.

## Output

Return proposed simplifications with proof and risk, or a clean skip rationale.
