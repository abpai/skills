# Mock Stub Placeholder Sweep

Role: Find fake or incomplete behavior that could make a PR look done while real
paths remain unwired.

## Goal

Identify stubs, placeholders, TODO traps, fake data, no-op implementations,
overbroad mocks, fake delays, disabled paths, shallow tests, and divergent
duplicate logic in the changed surface.

## Use When

Use for changed implementation, tests, fixtures, scripts, generated-looking
code, or multi-agent diffs. Expand beyond changed files only when a suspect
points to a nearby caller or contract.

## Success Criteria

- Every suspect is fixed, classified as intentional, tracked as blocked, marked
  dead, or recorded as a false positive with evidence.
- Mocks remain only at accepted test/service boundaries.
- No mock replaces the behavior under review.
- Findings include caller/consumer impact, not just keyword matches.

## Constraints

- Grep is a starting point, not proof.
- Do not treat all test mocks as bad.
- Do not chase repo-wide legacy placeholders for ordinary small PRs.

## Quick Pass

1. Build scope from `changed-files.txt` or `git diff --name-only`.
2. Search changed files for `TODO`, `FIXME`, `HACK`, `stub`, `mock`,
   `placeholder`, `fake`, `not implemented`, trivial returns, and thrown
   "not implemented" errors.
3. Inspect structural suspects: empty handlers, `pass`/ellipsis, sleep-as-work,
   501 routes, always-zero metrics, disabled cache/storage paths, shallow tests.
4. Trace callers or consumers for each real-looking suspect.
5. Classify as `fix now`, `blocked`, `dead code`, `intentional boundary`, or
   `false positive`.

## Deep Escalation

Use for large or risky diffs. Add short-function/no-op scans, inspect generated
artifacts that feed runtime behavior, compare duplicated implementations, and
sample tests to ensure they exercise real paths.

## Evidence

Record scan commands, suspect file:line refs, caller/consumer refs, disposition,
fixes or blocker, and skipped false positives that matter.

## Skip Or Stop Rules

Skip docs-only changes, lockfiles, vendored/generated files that do not affect
runtime behavior, pure formatting diffs, abstract interfaces, and existing
fixtures that do not hide the subject under test.

## Output

Return actionable findings only, plus reviewed false positives that explain why
the gate is clean.
