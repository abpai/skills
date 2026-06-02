# UBS Static Risk Scanner

Role: Use `ubs` or a comparable static-risk tool as a focused changed-file
scanner, then triage findings into real bugs, false positives, or tooling
blockers.

## Goal

Catch static risks that compile but may fail at runtime without letting scanner
output replace human review or behavior tests.

## Use When

Use when changed code-like files touch implementation, tests, fixtures, scripts,
CLI/API code, parsing, trust boundaries, async/resource lifecycle, or error
handling, and `ubs` is available.

## Success Criteria

- Scanner ran on changed files or a concrete skip reason is recorded.
- Every finding is triaged.
- Real bugs are fixed at root cause and rescanned.
- False positives have a specific safety reason.
- Exit code and evidence are captured in gate artifacts.

## Constraints

- Do not scan the whole repo by default.
- Do not suppress without a local safety reason.
- Do not treat exit code `2` as clean.
- Do not use this gate as behavior proof.

## Quick Pass

1. Identify changed code-like files from `changed-files.txt`, staged diff, or PR
   diff.
2. Prefer `ubs --staged` for staged commit prep; use `ubs --diff` or
   `ubs <changed-files>` for PR prep.
3. Interpret exit codes: `0` clean, `1` findings need triage, `2` tool/setup
   issue.
4. For each finding, ask whether the path is reachable, guarded, validated
   elsewhere, or relevant to a trust boundary.
5. Fix real bugs, document false positives, and rerun the same scan.

## Deep Escalation

Use when UBS reports real findings or the diff is security/correctness sensitive.
Review callers, tests, and trust boundaries around each finding; rerun scanner
and targeted behavior tests after fixes.

## Evidence

Record command, exit code, finding list, triage outcome, file/line refs for fixes
or suppressions, rerun result, skip reason, and `ubs doctor` output for tool
errors.

## Skip Or Stop Rules

Skip docs-only, generated/vendor/lockfile-only, or no-code diffs. If `ubs` is
missing, record `command -v ubs` failure and continue with manual review.

## Output

Return `clean`, `findings triaged`, `blocked by tool`, or `skipped`, with exact
evidence.
