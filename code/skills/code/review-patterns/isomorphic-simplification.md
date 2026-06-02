# Isomorphic Simplification

Role: Recommend behavior-preserving simplifications, and only when behavior is
protected by proof.

## Goal

Catch the case where a refactor that reads as pure cleanup silently changes what
the code does. Remove accidental complexity while preserving public behavior,
outputs, side effects, interfaces, ordering, timing assumptions, and error
semantics. A diff that touches behavior is out of scope for this gate.

## Use When

Changed code shows duplication, accidental complexity, helper or component reuse
opportunities, refactor or DRY intent, or `prepare-pr` routes this gate.

## Success Criteria

- Behavior proof exists before any change: tests, goldens, explicit invariants,
  callsite evidence, or a source contract.
- Each duplication candidate is classified: exact, parametric, bounded variance,
  semantic clone, or accidental rhyme.
- Each recommended simplification carries preservation evidence and a stated
  coupling cost.

## Constraints

- Do not hide a behavior change inside cleanup.
- Do not merge similar-looking code with different lifecycles.
- Do not introduce a generic helper for two weakly related cases.
- Do not cross async, ordering, error, or side-effect boundaries without proof.

## Quick Pass

1. Confirm applicability from the diff itself, not from naming or structure.
2. Bound scope to changed files and their direct callers.
3. Gather behavior proof before proposing anything.
4. Classify each duplication candidate.
5. Check preservation axes: error semantics, ordering, laziness, side effects,
   logs and metrics, nullability, units, type narrowing, render behavior.
6. Propose one change at a time, smallest first.
7. Rerun targeted validation after each accepted change.

## Deep Escalation

For larger refactors, write a behavior-preservation note, enumerate affected call
sites, add or update goldens and invariants where they are missing, and validate
after each individual change rather than after one combined rewrite.

## Evidence

Record candidate `file:line` refs, callsite or search output, the preservation
proof relied on, validation commands and results, golden diff status when
relevant, and the reason for each skip.

## Skip Or Stop Rules

Skip when tests are red with no baseline, no behavior proof exists, candidates
only look alike, the change would grow parameter sprawl, or coupling risk exceeds
the clarity gain.

## Output

Return either proposed simplifications (each with classification, preservation
proof, and coupling cost) or a concrete skip rationale. Record the gate decision
in `gate-decisions.md` as `run`, `skip`, `deep`, `override`, or `blocked`.
