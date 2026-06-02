# Multi-Pass Bug Hunting

Role: Review the changed behavior for real correctness, security, regression,
and missing-test risks. Prefer actionable findings over broad speculation.

## Goal

Catch defects missed by a single review pass, then re-read after fixes or
triage with fresh assumptions.

## Use When

Use for code/API/CLI changes involving behavior, parsing, trust boundaries,
persistence, concurrency, resource lifecycle, control flow, error handling, or
agent-generated diffs.

## Success Criteria

- Findings are grounded in file:line evidence and changed behavior.
- Each finding states impact, likely cause, and validation needed.
- Scanner output is triaged, not pasted raw.
- A second pass after fixes/triage finds no new real defects, or residual risk
  is explicit.
- Test/QA blockers include exact commands or reasons.

## Constraints

- Do not require many passes for every PR.
- Do not chase unrelated pre-existing issues unless they block changed behavior.
- Do not treat green tests as enough without reviewing changed contracts.
- Read-only subagents report findings; the main agent owns edits and readiness.

## Quick Pass

1. Read the current diff, changed files, `quality-gates.md`, and `qa-plan.md`.
2. Review correctness, security, edge cases, async/resource lifecycle, trust
   boundaries, data contracts, and missing tests.
3. Run a scoped static scan when available.
4. Triage findings into real bug, missing test, false positive, blocker, or
   unrelated issue.
5. After fixes or rejection, re-read touched files and nearby consumers.
6. Recommend the narrowest validation for each real issue.

## Deep Escalation

Use for correctness-sensitive diffs. Run a fresh-eyes second review from the
updated diff, include nearby call sites/consumers, rerun targeted tests/scanners,
and explicitly compare first-pass assumptions against final code.

## Evidence

Record files reviewed, findings with impact, static scan command/exit status,
fix or rejection rationale, validation command/result, and second-pass notes.

## Skip Or Stop Rules

Skip for docs/prose-only changes. Use a compact single pass for tiny type-only
or test-only changes already covered by relevant validation. If no diff exists,
the gate cannot run.

## Output

Return findings ordered by severity, then validation and residual risk. If clean,
say what was reviewed and what remains untested.
