# p10-billing-events — current-task fallback + bulk rename + recurring correction

- Mode: plan, invoked with **no task text**. Language: TypeScript (bun). Fixture: `fixtures/p10-billing-events`.
- Invocation: `pstack plan`
- The task arrives only through the preceding user message (see scenario user_context).

## Ground truth (hidden)

- 4 renames: `acct.opened|closed|frozen|limit_changed` → `account.*`.
  19 `acct` occurrences across 12 files in `src/`, `tests/`, `docs/events.md`,
  plus the `Acct*` keys in `src/events.ts`. Mixed usage: `Events.X` constants
  and raw strings in `bus.emit`/`bus.on`; `src/audit/trail.ts` builds names
  dynamically (`` `acct.${action}` ``) — a naive string replace of `"acct.`
  misses it; `src/metrics/counters.ts` mixes constants and raw strings; tests
  assert raw names.
- Events are in-process only (README) → no persisted data or external consumers to migrate.
- Recurring review correction (CONTRIBUTING.md): "use Events constants, never
  type event strings". Durable fix: make `Bus.on/emit` accept only an
  `EventName` union derived from `Events` (compiler rejects raw/misspelled
  strings) and/or a test/lint that fails on raw event strings; then drop or
  shorten the checklist line. Note: bun does not type-check; plan must name how
  the type rule is enforced (e.g. `tsc --noEmit` script/CI, or a test).

## PASS (all required)

1. Fallback: uses the prior message as the task without asking for one, and
   does not reply with a usage line.
2. Plan does the rename with a script/codemod or scripted search-and-verify
   (one example first, then automate, then a rerunnable leftover check like
   `grep -rn "acct\." src tests docs` = empty), and notices the dynamic template
   in `audit/trail.ts` or explicitly checks for non-literal uses.
3. Plan encodes the "no raw event strings" rule structurally (typed event names
   on the bus and/or automated check) and says how it is enforced given bun does
   not type-check; mentions retiring the checklist reminder once enforced.
4. Updates docs/events.md and tests as part of the change.
5. Concise; run-dir unchanged.

## FAIL (any)

- Asks the user for a task / prints usage despite the context.
- Plans only a manual find-and-replace with no leftover check.
- Addresses the recurring review issue only with more documentation.
- Proposes keeping both `acct.*` and `account.*` aliases (no external consumers).

## Principles

- Should select: **Script bulk operations**, **Encode lessons in structure**,
  Type system discipline.
- Neutral: Laziness protocol, Prove it works, Migrate callers then delete legacy
  APIs (if framed as "no aliases"), Subtract before you add.
- Padding: Exhaust the design space, Explain the number, Separate before
  serializing shared state, Make operations idempotent (beyond "script is
  rerunnable"), Redesign from first principles, Prioritize usability, Attack the
  premise, Outcome-oriented execution.
