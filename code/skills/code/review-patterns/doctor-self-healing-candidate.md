# Doctor Self-Healing Candidate

Role: Decide whether recurring setup, auth, bootstrap, diagnostics, or repair
pain should become a safe `doctor`, `check`, `repair`, setup script, or skill.

## Goal

Review or propose self-healing surfaces as agent-facing safety contracts, not as
hidden mutation.

## Use When

Use for CLI/script changes involving setup, auth, bootstrap, diagnostics, repair
flows, seed/fixture workflows, or QA failures that agents keep rediscovering and
the repo can detect or repair.

## Success Criteria

- Gate decision is `not needed`, `setup skill enough`, `doctor candidate`, or
  `doctor hardening required`.
- Diagnosis is read-only by default.
- Repair requires explicit `--fix` or equivalent.
- Fixers detect before fixing, name preconditions, scope writes, support backup
  or undo when practical, and are idempotent.
- Non-interactive surface has help, stable exit codes, stdout/stderr discipline,
  JSON/robot output when appropriate, and actionable errors.
- Repair claims have fixture or reproducible broken-state evidence.

## Constraints

- No hidden mutation in diagnose mode.
- No broad destructive cleanup.
- No unsafe network or secret use by default.
- Do not build a doctor command for a one-off external environment issue.

## Quick Pass

1. Name failure mode: symptom, likely cause, and repo-owned repair boundary.
2. Check CLI discoverability, `--help`, failure output, exit code, and non-TTY
   behavior.
3. Classify response: better error, setup script, read-only checker, full doctor
   command, or no action.
4. For repair, inspect detector purity, explicit fix flag, atomic/scoped writes,
   backup/undo, lock/concurrency behavior, and offline defaults.
5. Check JSON/robot schema and stdout/stderr separation if present.
6. Require or propose round-trip proof: corrupt -> diagnose -> dry-run -> fix ->
   healthy -> second fix no-op -> undo when applicable.

## Deep Escalation

Use when a doctor/repair surface already exists or the failure is common and
repo-controlled. Add fixture-based tests, precise finding IDs, rollback proof,
and safe failure behavior.

## Evidence

Record help output, commands, exit codes, stdout/stderr notes, detector/fixer
file refs, backup/undo path, fixture/test name, or reason self-healing is not
warranted.

## Skip Or Stop Rules

Skip docs-only changes, one-off external environment problems, unrelated feature
work, unsafe repair requirements, or existing validators that clearly cover the
failure.

## Output

Return the self-healing decision, evidence, and any narrow follow-up candidate.
