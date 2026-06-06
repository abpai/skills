# Doctor Self-Healing Candidate

Judge whether a diff's `doctor`/`check`/`repair`/setup/bootstrap surface is safe to ship — or whether a recurring setup/auth/repair pain should become one — and block fix-then-detect, in-place mutation, and irreversible repairs.

## When this gate applies

- Diff touches a `doctor`/`health`/`verify`/`repair`/`check`/`diagnose`/`fix` subcommand, a setup/bootstrap/provision script, or any code that writes to disk/DB "to fix a broken state."
- Diff adds or edits a fixer/detector, a `--fix`/`--repair` flag, a backup/undo/rollback path, or a `capabilities`/robot-JSON surface.
- A QA failure keeps recurring and the repo could detect or repair it itself (self-healing candidate, not yet built).
- Globs: `**/doctor*`, `**/repair*`, `**/{setup,bootstrap,provision}*`, `**/fixers/**`, `**/migrations/**` paired with a write-on-fix code path.

## Gotchas

1. **Single `mutate()` chokepoint or you can prove nothing.** EVERY disk write under `--fix` must flow through ONE function `mutate(path, op) -> ActionResult`, in this fixed order: (1) acquire per-path lock, (2) compute `before_hash`, (3) check preconditions/scope, (4) write verbatim backup AND `cmp`-verify it byte-identical before proceeding, (5) plan the new bytes in memory, (6) execute atomically, (7) compute `after_hash`, (8) append one `actions.jsonl` line. "Scoped atomic writes" is not enough — the load-bearing claim is that `mutate()` is the *only* writer. Get this right and reversibility/idempotence/observability/crash-recovery fall out almost for free; get it wrong and the doctor's scorecard is meaningless. Mechanically checkable — see Scripts (`validate-doctor.sh`).

2. **Forbidden-write grep is the actual test, not prose judgment.** Scan the doctor module for `std::fs::write`, `std::fs::remove_file`, `fs.writeFileSync`, `fs.unlink(Sync)`, `os.WriteFile`, `os.Remove(All)`, `shutil.rmtree`, `.unlink(`, `open(...,"w")`, `rm -*r`, `git reset --hard`, `git clean -*f`, `DROP TABLE`, `kubectl delete`. A match is allowed ONLY inside the `mutate()` definition (within ~60 lines of `fn mutate`/`func Mutate`/`def mutate`/`function mutate`) or inside a quoted "will NEVER" negative-space doc line. Any other match is a violation. Run `validate-doctor.sh <target>`.

3. **No `DeletePath`; delete means rename-to-quarantine.** Deletion is forbidden — the `Op` enum has no `DeletePath` variant. A fixer that wants to delete (stale lock, junk file) must `mutate(path, Op::Rename { to: <run-dir>/quarantine/<rel-path> })` and let the *user* decide to remove it later. Flag any `unlink`/`rm`/`remove_file`/`RemoveAll` in a fixer; the correct pattern is quarantine, not erase. "No destructive cleanup" without naming the rename-to-quarantine alternative is too vague.

4. **Atomic write = same-directory temp; cross-FS rename is NOT atomic.** The temp file MUST live in the target's directory so `rename(2)` is a directory-entry swap. A temp on `/tmp` renamed over a `/home` target silently breaks atomicity. Per-language primitives matter: Python `os.replace` NOT `os.rename`; C uses same-dir `mkstemp` + `fdatasync`; DB atomicity is `BEGIN IMMEDIATE … COMMIT` (SQLite) / `BEGIN … COMMIT` (PG) with rollback *inside* `mutate()`. In-place truncation / seek+write is a crash-recoverability bug (leaves a half-old/half-new file).

5. **Idempotence's #1 real break: timestamp/header re-stamping.** Second `--fix` reports `actions_taken: 2` because a fresh `generated_at:`/timestamp header is materialized BEFORE the no-op check runs. Fix: the detector compares CONTENT *excluding* the timestamp; if a timestamp is essential it lives in a side channel (`actions.jsonl::finished_at_ns`), never in file content. Same family: a detector that memoizes "for next time" is no longer pure and breaks idempotence. Demand: run `--fix` twice, second run reports `actions_taken: 0` exit 0 (`verify-idempotence.sh`).

6. **Reversibility's silent killer: a fixer touching bytes outside its diff range.** "Clean up trailing whitespace while we're here" / re-format the JSON it just wrote → undo restores the backup byte-identically but live state diverges, OR undo re-formats on the way out, and `cmp -s` fails. Rule: a fixer touches ONLY the bytes that must change; its diff range IS its scope; undo is a plain `cp backup -> live` with ZERO transformation. Check the fixer's actual write surface against its stated scope; `mutate()` writes the backup BEFORE any read of the live file (reading live AFTER backup is a TOCTOU race).

7. **Backups must be VERBATIM and `cmp`-verified.** `cp -a` / `shutil.copy2` preserving mtime + permissions, no transcoding/normalization/"fix the trailing newline," and `cmp` byte-identical against the original at the moment of backup. DB rows → `pg_dump` / `sqlite3 .dump` of the affected rows. Dropping perms/mtime breaks downstream tools keyed on mode. "Back up first" is meaningless without verbatim + `cmp` verify.

8. **Exit-code dictionary carries agent semantics; 4 vs 5 changes behavior.** `0` healthy, `1` findings (no `--fix`), `2` fix partial, `3` fix failed + rolled back, `4` refused-unsafe, `5` concurrency-lost (lock held), `6` online-required, plus sysexits `64`/`66`/`73`/`74`. Critically: lock-held is exit **5 not 4**, so an agent knows to retry-after-wait rather than escalate. A read-only/out-of-scope refusal uses 4; a contended-lock refusal uses 5. Ad-hoc codes that collapse these are a finding.

9. **stdout = data, stderr = progress, as a hard contract.** Any ANSI/spinner/log line on stdout breaks `doctor --json | jq`. Auto-disable color/progress on non-TTY, `NO_COLOR=1`, `--robot`, or `--json`. `--robot` must ALSO pin every config knob to canonical defaults (configs affect non-robot mode only) so an agent gets predictable behavior across user configs. Watch for a TUI/interactive/spinner path that still fires under `--robot`/`--json` (a `--robot --explain` that forks into a TUI blocks the agent until timeout — gate at the subcommand entry point, not per-print).

10. **`capabilities --json` must be GENERATED from the live detector/fixer registry, not hand-maintained.** Hand-edited capabilities drift and lie — they declare detectors that don't exist or aren't invoked. A hand-edited capabilities block is a red flag. Round-trip it: every declared detector/fixer must actually be callable (`--only <id>`); `verify-capabilities.sh` fails if any declared item isn't invocable.

11. **Offline by default; degrade to `findings_only_offline`, never wedge.** A default "license check"/call-home detector runs on plain `doctor` and hangs ~30s in a no-network sandbox. Network detectors are `online_required: true` in capabilities, skipped unless `--online`, and when skipped emit a `findings_only_offline` finding describing what they would have checked. A network failure downgrades a fixer to findings-only and proceeds — it never blocks the fixer.

12. **Run-id deterministic / content-addressed, not random/wall-clock.** `run-id = sha256(target_sha + iso8601_utc_seconds)[..6]`. Random or pure-wall-clock ids break determinism and reproducibility. Same discipline for failure-mode ids: derive from `subsystem + symptom` slug (`compute-fm-id.py`) so the same failure isn't scored/tracked under two ids across passes.

13. **Triage which repairs are worth hardening: `priority = frequency × score_gap × blast_radius`.** `frequency` mined from CASS/bug-tracker/git-log counts, clamped `[0.5, 2.0]`; `score_gap = (1000 − score)/1000`; `blast_radius` on a calibrated ladder — cosmetic `0.25`, nuisance `0.5`, degrades_correctness `1.0`, corrupts_state `2.0`, loses_data `4.0`. P0 ⇒ `corrupts_state` or `loses_data`. Use this to rank candidates instead of qualitative "common and repo-controlled"; CI should fail a pass whose top-priority FMs aren't addressed or explicitly deferred with a reason.

14. **The gate's core proof is a BYTE-EXACT round-trip per failure mode.** corrupt → `doctor --fix` → `doctor` (no flags) exits 0 → `doctor undo <run-id>` → state `cmp -s` byte-identical to the **corrupted** state (not the original). `corrupt.sh` reproduces the broken state deterministically and writes a `.fixture_baseline`; `assert.sh` returns 0 only when the post-fix state is healthy. One fixture per failure mode. This is what turns "undo where reversible" into a scriptable acceptance test (`verify-undo.sh`).

## Quick pass

For a normal PR touching a doctor/repair surface:

1. Name the failure mode (symptom, likely cause) and the repair boundary the repo actually owns.
2. Run the surface non-interactively: `--help`, exit codes, non-TTY behavior, `doctor --json | jq` (must have zero log lines on stdout), validate any JSON schema.
3. Classify the response: better error / setup script / read-only checker / full doctor / no action.
4. For any repair path: `validate-doctor.sh <target>` (forbidden-write grep), then eyeball detector purity (no `mutate()`, no memoization), verbatim+`cmp` backup, same-dir atomic write, scoped diff range, lock-or-exit-5, offline default.
5. Run the byte-exact round-trip for the touched failure mode (`verify-undo.sh`); second `--fix` must be a no-op (`verify-idempotence.sh`).

## Deep pass

Escalate when a doctor/repair surface already exists, the failure is common and repo-controlled (high `priority` score), or the diff is correctness-sensitive (writes to state files/DB, migrations, lock handling):

- Full Phase-5 safety harness over each touched FM: `verify-undo.sh` (byte-identity), `verify-idempotence.sh` (no-op second run), `verify-crash-recovery.sh` (SIGKILL mid-fix at K={1,5,25,125}ms → no torn writes, no orphan `.tmp.*`, clean next run), `verify-concurrency.sh` (two `--fix` → exactly one exits 5), `verify-metamorphic.sh` (detector repeatability).
- `verify-capabilities.sh <tool>` to round-trip the capabilities contract against the live registry.
- Score the candidate with the `priority` formula; require fixtures, precise finding IDs (`file:line`/`key=…`/json-pointer/blob hash), rollback proof, and safe behavior when the repair itself fails (exit 3 + rolled back, not exit 0).

## Scripts

Ported from `world-class-doctor-mode-for-cli-tools`. Run from the target repo (set `TOOL=<binary>` or pass it as the arg shown).

- [`scripts/validate-doctor.sh`](scripts/validate-doctor.sh) — forbidden-write grep enforcing the single-chokepoint invariant. `scripts/validate-doctor.sh <target>` (exit 0 clean, ≥1 with violations).
- [`scripts/verify-capabilities.sh`](scripts/verify-capabilities.sh) — round-trips `capabilities --json` against the live detector/fixer registry. `scripts/verify-capabilities.sh <tool>`.
- [`scripts/verify-undo.sh`](scripts/verify-undo.sh) — corrupt → fix → assert healthy → undo → `cmp` byte-identical to the corrupted state. `scripts/verify-undo.sh <fm_id> <tool> [fixture_root]`.
- [`scripts/verify-idempotence.sh`](scripts/verify-idempotence.sh) — runs `--fix` twice, asserts second run `actions_taken: 0`. `scripts/verify-idempotence.sh <fm_id> <tool> [fixture_root]`.
- [`scripts/verify-crash-recovery.sh`](scripts/verify-crash-recovery.sh) — SIGKILLs mid-fix and asserts clean recovery / no orphan temps. `scripts/verify-crash-recovery.sh <fm_id> <tool> [fixture_root]`.
- [`scripts/verify-concurrency.sh`](scripts/verify-concurrency.sh) — two concurrent `--fix`, asserts one exits 5. `scripts/verify-concurrency.sh <fm_id> <tool> [fixture_root]`.
- [`scripts/verify-metamorphic.sh`](scripts/verify-metamorphic.sh) — detector repeatability probe. `scripts/verify-metamorphic.sh <fm_id> <tool> [fixture_root]`.
- [`scripts/compute-fm-id.py`](scripts/compute-fm-id.py) — deterministic content-derived failure-mode id. `scripts/compute-fm-id.py --subsystem <name> --symptom <slug>` (also the model for the deterministic run-id rule).

## False positives

- **Read artifacts under `.doctor/runs/<id>/`** (report.json/md, atomic `latest` symlink update) are NOT mutations of project state — don't flag a no-flags `doctor` for writing them.
- **Forbidden-primitive matches inside the `mutate()` body or a quoted "will NEVER" doc line** are allowed by design; the grep excuses them. Don't re-flag.
- **`doctor gc --before <date> --yes`** is a separate, dual-flag, explicit-intent retention command — not part of `--fix`; its pruning is not the "destructive cleanup" the gate blocks.
- **A passing fixture suite whose `corrupt.sh`/`assert.sh` encode the code's own assumption proves nothing** — don't accept a green round-trip without checking the fixture reproduces a *real* broken state.
- **Don't harden a one-off external-environment hiccup** (a flaky DNS, a co-worker's local misconfig) into a permanent repair command; that's a rationalization, not a `priority`-worthy failure mode.

## Evidence to record

Into the finish-lane verification timeline:

- `--help` output; commands run with exit codes; a stdout/stderr separation note (`--json | jq` clean).
- `validate-doctor.sh` result and detector/fixer/`mutate()` `file:line` refs.
- Backup path + verbatim/`cmp` note; the same-dir atomic-write primitive used.
- Fixture name + the full round-trip transcript ending in the `cmp -s` byte-identity check (`verify-undo.sh` PASS), plus the second-`--fix` no-op (`verify-idempotence.sh` PASS).
- `verify-capabilities.sh` PASS (or why skipped); exit-code dictionary check (4 vs 5).
- If self-healing was NOT warranted: the decision (`not needed` / `setup script enough` / `doctor candidate` / `hardening required` / `blocked-unsafe`) and the `priority` score if it was a recurring failure.
- **Stop and block** if a proposed repair deletes files (no quarantine), bypasses `mutate()`, mutates in detect mode, or can't be undone byte-for-byte.
