# Mock Stub Placeholder Sweep

Role: Catch fake or unwired behavior that makes a PR read as complete while the
code path under review still does nothing real.

## Goal

Decide whether the changed surface ships working behavior or hidden fakes. By
the end, every stub, placeholder, no-op, fake delay, disabled path, or hollow
test in the diff is either fixed, recorded as an intentional boundary, tracked
as blocked, or dismissed as a false positive with evidence. The gate is clean
only when no mock or placeholder stands in for the behavior this PR claims to
deliver.

## Use When

Run on changed implementation, tests, fixtures, scripts, generated-looking
code, or multi-agent diffs. Step outside the diff only when a suspect points to
a specific caller or contract that proves whether it is wired.

## Success Criteria

- Each suspect has a disposition: fixed, intentional boundary, blocked, dead, or
  false positive.
- Mocks survive only at accepted test or service boundaries.
- No mock or placeholder stands in for the behavior under review.
- Findings cite caller or consumer impact, not bare keyword matches.

## Constraints

- Grep locates suspects; it does not prove them. Read the code.
- Test mocks are not automatically findings.
- Do not chase repo-wide legacy placeholders for an ordinary small PR.

## Quick Pass

1. Build scope from `changed-files.txt`, falling back to
   `git diff --name-only`.
2. Search the diff for `TODO`, `FIXME`, `HACK`, `stub`, `mock`, `placeholder`,
   `fake`, `not implemented`, trivial returns, and thrown "not implemented"
   errors.
3. Inspect structural suspects: empty handlers, `pass`/ellipsis bodies,
   sleep-as-work, 501 routes, always-zero metrics, disabled cache or storage
   paths, and tests that assert nothing real.
4. Trace the caller or consumer of each real-looking suspect to confirm whether
   the path executes.
5. Assign each suspect a disposition and record it in `gate-decisions.md`.

## Deep Escalation

For large or risky diffs, also:

- Scan short functions and no-ops the keyword pass missed.
- Inspect generated artifacts that feed runtime behavior.
- Compare duplicated implementations for divergent logic.
- Sample tests to confirm they exercise the real path, not a mock.

## Evidence

In `gate-decisions.md`, record:

- Scan commands run.
- Suspect `file:line` refs.
- Caller or consumer `file:line` confirming the path is wired or fake.
- Disposition per suspect, with the fix or blocker.
- False positives worth noting, and why they are clean.

## Skip Or Stop Rules

Skip docs-only changes, lockfiles, vendored or generated files that do not reach
runtime, pure formatting diffs, abstract interfaces, and existing fixtures that
do not hide the subject under test.

## Output

Write the gate decision (`run` / `skip` / `deep` / `override` / `blocked`) to
`gate-decisions.md` with the findings: fixed suspects, open blockers, and the
reviewed false positives that explain why the gate is clean.
