# Repair Safety Check

Review setup, doctor, migration, and repair paths for predictable diagnosis,
bounded mutation, recovery, and repeatability. Do not force every repository into
one invented doctor interface.

## When this gate applies

- A changed command diagnoses or repairs local state.
- A setup, bootstrap, provision, migration, `--fix`, backup, undo, or rollback
  path writes to disk or a database.
- A recurring setup failure could be detected or repaired by the repository.

## Safety contract

1. **Detect before mutating.** A read-only diagnose/check mode must report the
   failure without changing state. Fix-then-detect hides defects.
2. **Bound the write surface.** Name every file, row, service, and command the
   repair may touch. Unrelated cleanup is a finding.
3. **Prefer reversible operations.** Back up exact bytes/rows before mutation;
   quarantine files instead of deleting them. Verify restoration against the
   pre-fix broken state.
4. **Write atomically.** Plan new bytes in memory, write a same-directory temp,
   flush when required, then replace atomically. Use a transaction for database
   changes. In-place truncation is unsafe.
5. **Make retries safe.** A second fix should perform zero actions. Timestamp or
   generated-header churn that changes every run breaks idempotence.
6. **Handle concurrency explicitly.** Lock, compare-and-swap, or fail with a
   retryable result. Two repair processes must not interleave writes.
7. **Keep robot output parseable.** stdout is data, stderr is diagnostics; no
   prompts, ANSI, or progress in JSON/non-TTY mode. Exit codes must distinguish
   findings, partial repair, rollback, unsafe refusal, and lock contention.
8. **Stay offline by default.** Online-only checks are opt-in and degrade to a
   useful finding when unavailable.

## Quick pass

1. Name the failure mode, owned repair boundary, and response class: better error,
   setup script, read-only checker, or repair workflow.
2. Run help, diagnose/check, JSON/non-TTY behavior, and representative exit paths.
3. Inspect every changed write primitive. Confirm it is scoped, atomic, backed up,
   and recoverable; flag destructive commands or writes outside the declared
   boundary.
4. Reproduce one failure in an isolated fixture: diagnose → fix → diagnose healthy
   → run fix again (zero actions) → restore/undo → compare with the broken fixture.
5. Record the commands, exit codes, changed paths, before/after hashes, and any
   repair behavior not exercised.

## Deep pass

Escalate for migrations, shared state, locks, databases, or correctness-sensitive
repairs:

- kill the process during each write phase and verify clean recovery;
- run two fixes concurrently and verify exactly one writer wins;
- round-trip any capabilities/registry output against real invocable handlers;
- simulate backup, write, network, and rollback failure;
- prove offline behavior and exact undo for every touched failure mode.

Use the target repository's fixtures and commands for these proofs. The previous
bundled harness assumed one CLI shape and produced false confidence on other
repositories, so this lens deliberately ships no universal repair script.

## False positives

- A read-only check that never claims to repair does not need undo machinery.
- A setup script may be the right response for a one-time install problem; judge
  its actual writes rather than demanding a full doctor command.
- A delegated repository-native formatter/fixer operating on version-controlled
  source does not need a second backup/undo system. It must recompute the review
  scope after fixing, expose the resulting diff, and exit non-zero when validation
  is red.
- Evidence and gate-control files under a declared `.workflow`/cache directory are
  not user/product state. They still need fail-closed semantics, but not the same
  undo contract as a migration or data repair.
- A skipped destructive test is not a pass. Record the untested recovery path and
  block when it is central to the change.

## Evidence to record

Failure mode, response class, owned write boundary, diagnose/fix/second-fix/undo
commands and exit codes, changed paths or rows, atomicity/locking evidence,
before/after hashes, offline behavior, and residual untested failure modes.
