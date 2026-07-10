# Refactor Safety Check

Verify two things and nothing broader:

1. Did the refactor preserve observable behavior?
2. Did it leave obsolete code behind, or remove code without enough reachability proof?

Finding simplification opportunities belongs to `simplify.md`. This lens reviews
the safety of a refactor already present in the PR; it does not propose code-judo,
new abstractions, deduplication, or architectural cleanup.

## When this gate applies

- The diff claims `refactor`, cleanup, extraction, consolidation, rename, move,
  deduplication, or behavior preservation.
- A file, function, module, export, route, test, or configuration entry is deleted.
- Old and new implementations coexist (`_v2`, `_new`, `_legacy`, `_deprecated`,
  duplicate registrations, parallel exports) after a replacement.

Select this lens from the actual diff or commit intent. File extensions alone do
not prove a refactor, so `finish-lane.ts` does not auto-route every code file here.

## Behavior-preservation check

1. State the behavior claimed to be unchanged and identify its source contract,
   callers, tests, fixtures, or golden/snapshot evidence.
2. Compare before and after across the observable axes that apply:
   - values, types, ordering, tie-breaks, and serialization;
   - errors, status/exit codes, stdout/stderr, and logging relied on by callers;
   - side-effect order and cardinality;
   - laziness, short-circuiting, async/concurrency, retries, and cancellation;
   - floating-point evaluation and content-addressed/hash inputs;
   - state or component identity and lifecycle.
3. Search direct callers for assumptions about the changed axis. Do not mark an
   axis `N/A` without naming why it cannot vary here.
4. Run the narrowest before/after proof available. If the cleanup also fixes a
   bug, split or describe that behavior change honestly; it is not isomorphic to
   the original behavior.

## Dead-code check

Look in both directions:

- **Left behind:** old files, exports, registrations, flags, tests, fixtures,
  docs, or compatibility branches that the replacement made obsolete.
- **Removed unsafely:** code with unresolved external, dynamic, string, config,
  build, feature-flag, test, or documentation references.

For a proposed or already-applied deletion of a file, module, symbol, or its tests, run
`scripts/dead_code_safety_check.sh <path> [symbol]`. It reports source, dynamic,
string, config, build, test, and documentation references in one read-only scan.
A failing or incomplete scan means `DO NOT DELETE`; report the unresolved
consumer instead of guessing. A clean result still cannot prove that a public
export has no external consumers. Removing a file together with its tests does
not prove it was dead.

## Quick pass

1. Bound the review to changed files and direct callers.
2. Name the claimed unchanged behavior and its proof.
3. Check the applicable behavior axes and run targeted validation.
4. Search for obvious predecessor residue and unresolved references to removals.
5. Record `pass`, `finding`, or `blocked` with concrete evidence.

## Deep pass

Escalate for public APIs, cross-package moves, async/order/error changes, dynamic
registration, or deletions:

- enumerate all callsites and non-code references;
- compare base and branch outputs with the same inputs;
- run snapshot/invariant checks when exact examples are insufficient;
- complete the dead-code gauntlet for every deletion candidate;
- run the full validation gate required by the blast radius.

## Evidence to record

- Claimed unchanged behavior and source of truth.
- Applicable behavior axes and before/after evidence.
- Dead-code safety scan and external-consumer reasoning when relevant.
- Left-behind residue found or explicit `none found` scope.
- Validation commands, results, blockers, and any behavior change split out of
  the refactor.

Skip only when the diff contains no refactor, move, replacement, or deletion.
