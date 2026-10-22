# p12-notes-sync — principle coverage: novel interaction + usability tradeoff

- Mode: plan. Language: Python. Fixture: `fixtures/p12-notes-sync`.
- Invocation: `pstack plan Two people lost edits because they changed the same note on their laptop and their phone before syncing, and jot sync silently kept whichever copy was newer. Plan how jot sync should handle conflicting edits instead.`

## Ground truth (hidden)

- `jot/sync.py` resolves differing copies by mtime, silently. There is no record
  of the last-synced version, so the code cannot tell "edited on both sides"
  from "edited on one side" — a prerequisite the plan must add (e.g. per-note
  base hash/copy from the last sync).
- No precedent in the codebase for conflict handling or interactive prompts;
  README says sync mostly runs unattended (cron/launchd, phone background), so
  an interactive prompt cannot be the only path.
- Reasonable option space: keep both (conflict copy file like
  `note (conflict from phone).md`), inline conflict markers, three-way merge
  with fallback, interactive `jot resolve` command; plus surfacing conflicts in
  `jot sync` output / `jot list`.

## PASS (all required)

1. Identifies the missing base/last-synced state as a prerequisite for detecting
   true conflicts.
2. Compares two or three meaningfully different approaches (and suggests quick
   prototypes or trying them) before choosing, rather than asserting one.
3. Chooses with user experience reasoning: never lose data, works unattended,
   conflicts visible and easy to resolve, phone app shares the logic.
4. Mentions repeated syncs must not keep creating duplicate conflict copies (or
   equivalent rerun safety) — friction-level if missing.
5. Concise; open questions only where they change the plan; run-dir unchanged.

## FAIL (any)

- Jumps straight to one mechanism (e.g. interactive prompt) without considering
  unattended runs.
- Keeps mtime-wins with a warning only.
- Writes the implementation.

## Principles

- Should select: **Exhaust the design space**, **Prioritize usability**.
- Neutral: Make operations idempotent, Separate before serializing shared state
  (per-device copies), Fix root causes, Prove it works, Test behavior.
- Padding: Type system discipline, Migrate callers, Explain the number,
  Outcome-oriented execution, Script bulk operations, Encode lessons in
  structure, Redesign from first principles, Attack the premise.
