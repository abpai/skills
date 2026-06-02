# Doctor Self-Healing Candidate

Role: Decide whether recurring setup, auth, bootstrap, diagnostics, or repair pain
should become a safe `doctor`, `check`, `repair`, setup script, or skill.

## Goal

Catch two failures: a self-healing surface that mutates state while claiming to
only diagnose, and a one-off environment hiccup being hardened into a permanent
repair command. A passing change has a read-only default, an explicit fix path,
and a repair proven against a real broken state.

## Use When

CLI or script changes touch setup, auth, bootstrap, diagnostics, repair, or
seed/fixture flows, or a QA failure keeps recurring and the repo can detect or
repair it itself.

## Success Criteria

- Decision is one of `not needed`, `setup skill enough`, `doctor candidate`, or
  `doctor hardening required`, with the triggering failure mode named.
- Diagnosis is read-only; repair requires an explicit `--fix` or equivalent.
- Fixers detect before writing, name preconditions, scope their writes, are
  idempotent, and back up or undo where the change is reversible.
- Non-interactive surface has `--help`, stable exit codes, separated
  stdout/stderr, robot/JSON output where machines consume it, and errors that
  say what to do next.
- Every repair claim is backed by fixture or reproducible broken-state evidence.

## Constraints

- No state change in diagnose mode.
- No broad or destructive cleanup.
- No network calls or secret reads by default.
- No doctor command for a one-off external environment issue.

## Quick Pass

1. Name the failure mode: symptom, likely cause, and the repair boundary the repo
   actually owns.
2. Run the surface non-interactively: check `--help`, failure output, exit codes,
   non-TTY behavior, and validate any robot/JSON output against its schema.
3. Classify the response: better error, setup script, read-only checker, full
   doctor command, or no action.
4. For repair, inspect detector purity, the explicit fix flag, scoped and atomic
   writes, backup/undo, lock/concurrency handling, and offline defaults.
5. Demand the round trip: corrupt -> diagnose -> dry-run -> fix -> healthy ->
   second fix is a no-op -> undo where reversible. This is the gate's core proof.

## Deep Escalation

Escalate when a doctor/repair surface already exists, or the failure is common and
repo-controlled. Require fixture-based tests, precise finding IDs, rollback proof,
and safe behavior when the repair itself fails.

## Evidence

Record in verification-timeline.md: `--help` output, commands run with exit codes,
stdout/stderr notes, the robot/JSON schema check, detector and fixer file:line
refs, the backup/undo path, the fixture or test name, and the round-trip
transcript. If self-healing is not warranted, record why.

## Skip Or Stop Rules

Skip docs-only changes, unrelated feature work, and failures an existing validator
already covers. Stop and block if a proposed repair is unsafe or destructive.

## Output

Write the decision to gate-decisions.md: `skip` for `not needed`, `run` for
`setup skill enough` or a verified `doctor candidate`, `deep` for
`doctor hardening required`, `blocked` for an unsafe repair, and `override` when
the recommendation does not fit this diff. Include the evidence refs and any
narrow follow-up candidate.
