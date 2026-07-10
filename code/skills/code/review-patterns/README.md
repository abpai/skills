# Prepare-PR Review Lenses

These are the on-demand judgment lenses behind `prepare-pr`. They complement the
deterministic finish lane; they do not replace its scope calculation, validation
commands, mechanical scans, or unconditional advisory UBS scan.

## Effort tiers

`prepare-pr --effort medium` is the default. Effort changes the depth of an
applicable lens, not whether known risk may be ignored. High effort still loads
only lenses supported by the changed surface and diff intent; it does not run all
lenses ceremonially.

| Lens | Select when | Low | Medium | High |
| --- | --- | --- | --- | --- |
| `browser-e2e-verification.md` | Browser-rendered routes, pages, components, or flows changed | Quick pass when browser behavior is at risk | Quick pass | Deep pass |
| `cli-agent-ergonomics.md` | Commands, flags, scripts, stdout/stderr, or automation contracts changed | Quick pass when CLI behavior is at risk | Quick pass | Deep pass |
| `config-contract-check.md` | Manifests, config, generated metadata, or their source of truth changed | Quick pass when config drift is at risk | Quick pass | Deep pass |
| `doctor-self-healing-candidate.md` | Setup, repair, migration, fixer, or doctor behavior changed | Quick pass when recovery safety is at risk | Quick pass | Deep pass |
| `invariant-testing-check.md` | Exact expected output is a weak oracle for a parser, transform, scorer, optimizer, or similar system | Quick decision when oracle choice is at risk | Quick pass | Deep pass |
| `mock-stub-placeholder-sweep.md` | Tests or runtime paths may contain fake, stubbed, placeholder, or bypass behavior | Quick pass when production realism is at risk | Quick pass | Deep pass |
| `performance-profiling.md` | Performance-sensitive code, benchmarks, or a performance claim changed | Quick pass when performance is at risk | Quick pass | Deep pass |
| `prose-quality-check.md` | Human-facing docs, help, UI copy, errors, or release notes changed | Quick pass when prose is part of the change | Quick pass | Deep pass |
| `real-service-integration-check.md` | Auth, billing, database, webhook, worker, or other service boundaries changed | Quick pass when integration realism is at risk | Quick pass | Deep pass |
| `refactor-safety-check.md` | The diff refactors, moves, consolidates, or deletes code | Quick pass when applicable | Quick pass | Deep pass |
| `snapshot-testing-check.md` | Snapshots, goldens, approvals, or exact-output fixtures changed | Quick decision when artifact validity is at risk | Quick pass | Deep pass |
| `ux-accessibility-audit.md` | Rendered UI, interaction, accessibility, or user-visible CLI experience changed | Quick pass when UX is at risk | Quick pass | Deep pass |

## Selection contract

1. Run `scripts/finish-lane.ts`. Its suggested list is a filename-driven starting
   point, not a verdict.
2. Inspect the actual diff and project intent. Accept, skip, override, or add
   lenses based on behavior and risk.
3. Select `refactor-safety-check.md` from diff evidence such as moves, deletions,
   old/new implementations, or a named refactor. Filename extensions alone cannot
   establish that intent, so the finish lane does not auto-suggest it.
4. Read only the selected files. Run the tier-appropriate pass and escalate when
   evidence warrants it.
5. Record findings and proof, or a concrete skip rationale, in the review notes.
   PR title and body drafting remain part of the core `prepare-pr` workflow.

## Lens shape

Each lens defines when it applies, non-obvious failure modes, a quick pass, a deep
pass, false-positive controls, evidence to record, and a stop or skip rule. The
useful unit is an evidence-backed decision, not a finding manufactured for every
lens.
