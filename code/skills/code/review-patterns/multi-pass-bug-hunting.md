# Multi-Pass Bug Hunting

Role: Review the changed behavior for correctness, security, regression, and
missing-test defects, and surface the ones a single read-through would miss.

## Goal

Find the defects a single review pass leaves behind. Correctness-sensitive
diffs hide bugs that only surface on a second read with fresh assumptions:
mishandled edge cases, broken data contracts, race conditions, and changed
behavior with no covering test. Done means each real defect is named with
file:line evidence, or the diff is confirmed clean with remaining untested
areas stated.

## Use When

Code, API, or CLI changes touching behavior, parsing, trust boundaries,
persistence, concurrency, resource lifecycle, control flow, error handling, or
agent-generated diffs.

## Success Criteria

- Each finding cites file:line, states impact, likely cause, and the validation
  needed to confirm it.
- Findings are triaged into real bug, missing test, false positive, blocker, or
  unrelated, never pasted raw from a scanner.
- A second pass over touched files and their consumers finds no new real defect,
  or names the residual risk.
- Test or QA blockers carry the exact command that fails or the reason it cannot
  run.

## Constraints

- Do not chase pre-existing issues unless they block the changed behavior.
- Do not treat green tests as sufficient without reviewing the changed contract.
- Read-only subagents report findings; the main agent owns edits and the gate
  decision.

## Quick Pass

1. Read the diff, the changed files, `quality-gates.md`, and `qa-plan.md`.
2. Review correctness and edge cases.
3. Review security and trust boundaries.
4. Review async, resource lifecycle, and data contracts.
5. Identify behavior changed with no covering test.
6. Run a scoped static scan when one is available; triage its output.
7. Triage every finding into one of the five categories above.
8. After fixes or rejection, re-read the touched files and their nearby
   consumers.
9. Name the narrowest validation that confirms each real issue.

## Deep Escalation

For correctness-sensitive diffs, run a second review with fresh eyes from the
updated diff. Include nearby call sites and consumers, rerun the targeted tests
and scanners, and compare first-pass assumptions against the final code line by
line.

## Evidence

Record in `gate-decisions.md`: files reviewed, each finding with impact and
file:line, static scan command and exit status, fix or rejection rationale,
validation command and result, and second-pass notes. Log the validation
command and result to `verification-timeline.md`.

## Skip Or Stop Rules

Skip for docs or prose-only changes. Use one compact pass for tiny type-only or
test-only changes already covered by relevant validation. With no diff, the gate
is blocked.

## Output

Return a `run`, `skip`, `deep`, `override`, or `blocked` decision with findings ordered
by severity, then the validation status and residual risk. If clean, state what
was reviewed and what remains untested.
