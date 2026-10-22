# p08-mirror-sync — principle coverage: shared state + idempotent restart (shell)

- Mode: plan. Language: bash + jq. Fixture: `fixtures/p08-mirror-sync`.
- Invocation: `pstack plan Two problems with mirror-sync. With --jobs 4 the nightly run sometimes ends with entries missing from state.json, and once it left state.json empty so mirror-status failed. And when the nightly run dies partway (reboot, OOM kill), the next run copies every mirror from scratch even though most had finished; some mirrors are ~40 GB. Make parallel runs record state reliably and make a rerun resume instead of redoing finished work.`

## Ground truth (hidden)

- `bin/mirror-sync-one`: every worker does read-modify-write of the shared
  `state.json` via jq into the shared `state.json.tmp` then `mv` → lost updates
  and truncated/empty file. Reproduced: 12 mirrors, `--jobs 6` → 2-4 of 12 recorded or unreadable.
- `rm -rf "$dest"` before fetch defeats rsync's incremental transfer and leaves a
  half-copied `dest` that looks complete; there is no completion marker.
- Good direction: per-mirror state files (e.g. `state.d/<name>.json`) written
  atomically (temp + rename) by their owner, combined when `mirror-status`/the
  summary reads them (or a single writer); fetch into `<name>.partial`/temp and
  rename on success, or keep dest and let rsync update in place with a
  completion record written last; rerun skips/resumes based on reliable
  evidence; check by running twice and by killing mid-run.
- `mirror-status` and the monitoring check read `state.json` — plan must keep
  them working (combine on read or regenerate the file).

## PASS (all required)

1. Identifies concurrent writes to one `state.json` (and shared `.tmp` path) as
   the cause of lost/empty state.
2. Prefers separating write targets per worker (combine on read) over adding a
   lock — or, if choosing a lock/single writer, says why separation does not fit.
3. Addresses restart: removes the unconditional `rm -rf`, uses temp+rename or a
   completion marker so partial mirrors are recognizable, and decides "done" from
   reliable evidence rather than timestamps/existence alone.
4. Success checks: parallel run records all mirrors; run twice = no re-copy;
   kill mid-run then rerun reaches the same end state.
5. Keeps `mirror-status`/monitoring consumers in view.
6. Concise; run-dir unchanged.

## FAIL (any)

- Only adds `flock` around jq without noting separation, AND ignores the shared
  tmp path (lock alone is acceptable only with reasoning; see 2).
- Ignores the restart half of the request.
- Implements instead of planning.

## Principles

- Should select: **Separate before serializing shared state**, **Make operations idempotent**.
- Neutral: Prove it works, Sequence verifiable units, Script bulk operations
  (rerunnable kill/restart check), Laziness protocol.
- Padding: Exhaust the design space, Prioritize usability, Type system discipline,
  Migrate callers, Explain the number, Model the domain, Redesign from first
  principles, Encode lessons in structure.
