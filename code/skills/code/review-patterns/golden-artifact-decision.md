# Golden Artifact Decision

Role: Decide whether complex stable output should be locked behind a golden,
snapshot, or approval artifact, or skipped in favor of stronger evidence.

## Goal

Every golden added or updated is deterministic, normalized, and reviewed as a
semantic diff before it lands. Catch the failure where a golden is committed
without scrubbing or review and silently locks in nondeterministic noise or a
real regression as the expected output.

## Use When

Output is a snapshot, `.snap`, `.golden`, approval test, or generated
CLI/UI/compiler/query/serialization result, or any complex stable output where
field-by-field assertions would be weaker than comparing the whole artifact.

## Success Criteria

- Decision recorded in gate-decisions.md: add, update, keep, or skip.
- Comparison strategy chosen: exact, scrubbed, fuzzy, semantic, canonicalized,
  or structural.
- Dynamic fields scrubbed or normalized before the artifact is written.
- Generation/update command and validation command both captured and rerun.
- Golden diff read line by line and its changes explained.
- A skip names the stronger evidence that replaces the golden.

## Constraints

- Do not commit transient `.actual` files.
- Do not exact-match timestamps, UUIDs, machine paths, durations, addresses, or
  nondeterministic ordering without normalization.
- Do not let CI auto-update goldens.

## Quick Pass

1. Inspect the changed files and the output contract each golden asserts.
2. Classify the output: deterministic, dynamic, numeric, binary, cross-platform,
   or volatile.
3. Pick the cheapest comparison strategy that stays stable across runs.
4. Run the repo generation/update command, then the normal validation command.
5. Read the golden diff and write a one-line summary of what changed and why.

## Deep Escalation

Escalate for durable golden suites. Define the canonicalization and scrubbing
rules, the single update command, the human review step, the CI behavior on
mismatch, and the safe regeneration procedure.

## Evidence

Record golden paths, generation and validation command output with status, the
canonicalization rule applied, the reviewed diff summary, and the update
rationale. Pair each claim with a path or command, not a description.

## Skip Or Stop Rules

Skip when output is not stable or observable, too volatile or large to review,
already covered by stronger assertions, or has no safe canonicalization. When
exact output is a weak oracle, route to metamorphic or property testing instead.

## Output

Map the decision to the gate set: add or update is `run`, a durable suite is
`deep`, keep or skip is `skip`, an unreviewable or auto-updating golden is
`blocked`; use `override` when the recommendation does not fit. Return the gate
decision, the add/update/keep/skip choice, the
rationale, and the supporting paths and command output.
