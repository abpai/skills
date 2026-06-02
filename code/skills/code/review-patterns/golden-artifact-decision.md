# Golden Artifact Decision

Role: Decide whether complex stable output should be protected by a golden,
snapshot, approval artifact, or explicit skip.

## Goal

Any golden add/update should be deterministic, normalized, diff-reviewed, and
justified as behavior evidence.

## Use When

Use for snapshots, `.snap`, `.golden`, approval tests, generated CLI/UI/compiler
/query/serialization output, or complex stable output where field-by-field
assertions would be weaker.

## Success Criteria

- Decision is recorded: add, update, keep, or skip.
- Output strategy is chosen: exact, scrubbed, fuzzy, semantic, canonicalized, or
  structural.
- Dynamic fields are scrubbed or normalized.
- Generation/update and validation commands are captured.
- Diff is reviewed semantically, not blindly accepted.
- Skip cites stronger alternative evidence.

## Constraints

- Do not commit transient `.actual` files.
- Do not exact-match timestamps, UUIDs, machine paths, durations, addresses, or
  nondeterministic ordering without normalization.
- Do not let CI auto-update goldens.

## Quick Pass

1. Inspect changed files and output contracts.
2. Classify output: deterministic, dynamic, numeric, binary, cross-platform, or
   volatile.
3. Pick the lightest stable comparison strategy.
4. Run the repo generation/update command, then normal validation.
5. Review the golden diff and summarize semantic changes.
6. Record decision and evidence.

## Deep Escalation

Use for durable golden suites. Define canonicalization/scrubbing, update command,
human review flow, CI behavior, and how to regenerate artifacts safely.

## Evidence

Record golden paths, command output, validation result, canonicalization note,
reviewed diff summary, and update rationale.

## Skip Or Stop Rules

Skip when output is not stable/observable, too volatile or huge to review,
existing assertions are stronger, or no safe canonicalization exists. If exact
output is a weak oracle, route to metamorphic/property testing.

## Output

Return add/update/keep/skip with rationale and proof.
