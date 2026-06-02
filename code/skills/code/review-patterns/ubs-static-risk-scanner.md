# UBS Static Risk Scanner

Role: Run `ubs` (or a comparable static-risk tool) as a changed-file scanner,
then triage each finding into a real bug, a justified false positive, or a
tooling blocker.

## Goal

Find paths that compile but fault at runtime — null/None dereferences,
unhandled errors, unvalidated input at trust boundaries, leaked resources,
unawaited async — in the changed files, and resolve each one before the diff
ships. The gate produces a triaged finding list, not a behavior guarantee.

## Use When

Changed code-like files (implementation, tests, fixtures, scripts, CLI/API,
parsing, trust boundaries, async or resource lifecycle, error handling) are in
the diff and `ubs` is available.

## Success Criteria

- Scanner ran on the changed files, or a concrete skip reason is recorded.
- Exit code is captured and interpreted.
- Each finding is fixed at root cause and rescanned, or marked a false positive
  with a one-line local reason.
- Command, exit code, finding outcomes, and fix file:line refs are in
  gate-decisions.md.

## Constraints

- Scan changed files, not the whole repo, by default.
- Suppress only with a local safety reason at the suppression site.
- Treat exit code `2` as a tool failure, never as clean.
- Do not present scanner output as proof that behavior works.

## Quick Pass

1. List changed code-like files from `changed-files.txt`, the staged diff, or
   the PR diff.
2. Run `ubs --staged` for commit prep; run `ubs --diff` or `ubs <files>` for PR
   prep.
3. Read the exit code: `0` clean, `1` findings to triage, `2` tool/setup issue.
4. For each finding, decide: is the path reachable, guarded, validated
   elsewhere, or on a trust boundary?
5. Fix real bugs, record false-positive reasons, and rerun the same scan.

## Deep Escalation

When the diff touches a trust boundary or `ubs` reports a real bug, trace the
callers and tests around each finding, fix at root cause, then rerun the scanner
plus the targeted behavior tests that exercise the fixed path.

## Evidence

In gate-decisions.md, record the exact command, exit code, the finding list,
each triage outcome, file:line refs for every fix or suppression, and the rerun
exit code. For tool errors, attach `ubs doctor` output. For skips, record the
skip reason.

## Skip Or Stop Rules

Skip docs-only, generated/vendor/lockfile-only, and no-code diffs. If `ubs` is
absent, record the `command -v ubs` failure and fall back to manual review.

## Output

Write one decision to gate-decisions.md: `run` (scanned, findings resolved),
`deep` (escalated to caller/test review), `skip` (`ubs` absent and manual review
done, or out of scope, with reason), `override` (recommendation changed for this
diff), or `blocked` (exit `2` with unresolved high-risk findings), each with the
evidence above.
