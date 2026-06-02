# CLI Agent Ergonomics

Role: Review CLI, script, and dev-tool surfaces as the first blind invocation by a
human or agent at a shell.

## Goal

Catch commands that work for the author but break the next caller who runs them
blind: no `--help` to orient from, output that can't be parsed, diagnostics mixed
into data, an exit code that lies, an error that names no fix, or a destructive
action with no guard. Done means a caller who has never seen this command can
discover it, parse its output, trust its exit code, and recover from a wrong
invocation without reading the source.

## Use When

Changes touch commands, scripts, dev tools, workflow helpers, command docs, error
text, JSON or robot output, setup/doctor flows, or anything invoked from a shell.

## Success Criteria

- `--help` lists every flag, env var, and exit code the change introduced.
- Read-side commands emit structured output (JSON) when a machine consumes them.
- Stdout carries data only; stderr carries diagnostics, progress, and prompts.
- Each exit code maps to a documented condition; success is 0, failures are not.
- Failure messages name the exact fix, deprecated-flag replacement, or safer command.
- Non-TTY, `CI`, and `NO_COLOR` runs drop color and progress and still parse.
- Destructive operations require explicit confirmation and offer dry-run or plan output.
- A test, snapshot, golden, or recorded transcript pins each contract above.

## Constraints

- Do not redesign the CLI during PR prep; flag, fix, or defer.
- Do not require JSON for tiny human-only scripts.
- Do not mix progress or prompts into machine-readable stdout.

## Quick Pass

1. List the changed commands, flags, env vars, exit codes, output schemas,
   prompts, generated files, and side effects.
2. Run the bare command, `--help`, one success path, and one failure path.
3. Pipe output: confirm JSON validity, stdout/stderr split, stable ordering, and
   no ANSI or progress leakage.
4. Trip a typo and a deprecated flag; confirm the error names the fix or safe
   alternative, and that setup/doctor guidance points at the missing piece.
5. Confirm each contract is pinned by a test, snapshot, golden, or transcript.

## Deep Escalation

Escalate for agent-facing CLIs. Add: non-TTY and `CI` runs, JSON schema
validation, a failure matrix mapping inputs to exit codes, dry-run output checks,
idempotence on re-run, and a destructive-operation safety review.

## Evidence

For each finding record the command, exit code, the stdout/stderr split, an output
snippet, JSON or schema validation result, the source `file:line`, and the
test or snapshot that protects the behavior. Write decisions to gate-decisions.md.

## Skip Or Stop Rules

Skip docs-only changes that describe no executable command, internal library
changes with no shell surface, and generated artifacts owned by another gate.
If credentials or runtime are missing, mark the gate `blocked`, record the
missing piece, and review source-level contracts instead.

## Output

Append a gate-decisions.md entry with verb `run`, `skip`, `deep`, `override`, or `blocked`.
For `run` and `deep`, list findings with command evidence and a minimal fix sketch.
For `skip`, `override`, or `blocked`, state the reason in one line.
