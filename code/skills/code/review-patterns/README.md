# Review Pattern Lenses

These lenses are the detailed prompt layer behind `/code:prepare-pr` quality
gates. Each one ports the non-obvious gotchas and named techniques of a source
review skill directly into the `code` plugin, so published installs do not depend
on any external skill archive. The high-value executable assets live in
`scripts/`, referenced from the lens that uses them.

## Loading Rule

Load lenses progressively — never bulk-load all of them:

1. Run `scripts/finish-lane.ts`. It prints a flat **suggested lenses** list,
   inferred from the changed-file surfaces (ui/api/cli/docs/perf/test/golden).
2. Accept, skip, override, or add lenses from the actual diff and project intent.
3. Read only the lens files you selected.
4. Run each lens's quick pass; escalate to its deep pass only when diff risk
   justifies it.
5. Record findings + evidence (or a concrete skip rationale) in your review notes
   and the PR text.

The value is in explicit, surface-driven gate selection, not in maximum ceremony.

## Lens Shape

Each lens is gotchas-first — the highest-signal content lives at the top:

- one-line role
- when this gate applies
- **Gotchas** — the non-obvious failure modes and tells (the heart of the lens)
- Technique — the named methods (matrices, taxonomies, rules, scrub catalogs)
- quick pass
- deep pass
- false positives
- evidence to record
- skip / stop rules
- provenance pointer to the source skill

This keeps each lens dense enough to push the agent off its default behavior while
staying short enough to load on demand.
