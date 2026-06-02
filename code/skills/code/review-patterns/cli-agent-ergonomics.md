# CLI Agent Ergonomics

Role: Review CLI/script surfaces for the first reasonable attempt by a human or
agent at a shell.

## Goal

Make commands discoverable, parseable, deterministic, safe, and easy to recover
from when invocation is slightly wrong.

## Use When

Use for commands, scripts, dev tools, workflow helpers, command docs, error
handling, JSON/robot output, setup/doctor flows, or anything users or agents
invoke from a shell.

## Success Criteria

- Useful `--help` exists.
- Read-side commands expose structured output when appropriate.
- Stdout is data; stderr is diagnostics.
- Exit codes are intentional.
- Failures name the exact fix or safer command.
- Non-TTY, `CI`, and `NO_COLOR` behavior is sane.
- Dangerous operations require explicit confirmation and offer dry-run/plan
  alternatives when practical.
- Behavior is protected by tests, snapshots, or transcript evidence.

## Constraints

- Do not redesign the whole CLI during PR prep.
- Do not require JSON for tiny human-only scripts.
- Do not mix progress text into machine-readable stdout.

## Quick Pass

1. Identify changed commands, flags, env vars, exit codes, output schemas,
   prompts, generated files, and side effects.
2. Exercise bare command, `--help`, representative success path, and one failure
   path.
3. Check JSON validity, stdout/stderr split, stable ordering, and ANSI/progress
   leakage in pipes.
4. Review recovery paths: typo/deprecated flag hints, actionable errors,
   setup/doctor guidance, and safe alternatives.
5. Verify contracts with tests, snapshots, goldens, or command evidence.

## Deep Escalation

Use for agent-facing CLIs. Add non-TTY and CI checks, JSON schema validation,
failure matrix, dry-run behavior, idempotence checks, and destructive-operation
safety review.

## Evidence

Record command, exit code, stdout/stderr distinction, output snippet, JSON/schema
validation, source file/line, and test/snapshot that protects behavior.

## Skip Or Stop Rules

Skip docs-only changes that do not describe executable commands, internal
library changes with no CLI/script surface, or generated artifacts covered by
another gate. If credentials/runtime are missing, record the blocker and inspect
source-level contracts.

## Output

Return actionable findings with exact command evidence and minimal fix sketches.
