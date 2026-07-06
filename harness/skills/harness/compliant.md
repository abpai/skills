# Harness Compliant (overhaul)

Bring a repo up to agent-harness standard end-to-end: audit it, remediate the
findings, then re-audit to prove the fixes landed. Use this when the request is
"make this repo harness compliant," "overhaul this repo for agents," or anything
that maps to neither audit-only (`doctor.md`) nor author-only (`docs.md`) but to
both in sequence. This module orchestrates the other two; it defines no new
checks of its own.

## Sequence

1. **Audit.** Load `doctor.md` and run a full audit (no `--diff`) following its
   execution policy. Capture the baseline: the weighted D1-D7 score, the
   loop-readiness verdict, and the tiered finding list (Immediate / Near-term /
   Later). This baseline is what step 3 measures against — record it before
   touching anything.
2. **Remediate.** Load `docs.md` and work the findings through its process,
   highest-leverage first, walking the enforcement hierarchy (enforcement over
   prose): run the Keep / Move / Delete audit on flagged guidance, convert prose
   rules to tests/lints/CI/scripts, author any missing core docs (spec contract,
   architecture, commands, testing), and rewrite `AGENTS.md` as a router. Order
   the work by the audit's tiers, not by file convenience. Respect `docs.md`'s
   own guardrails: do not bootstrap project infrastructure that does not exist
   (record it as a `docs/todos` spec and surface the decision), and when the
   original request was docs-scoped, present the prose-to-enforcement conversion
   plan for approval before implementing it.
3. **Re-verify.** Re-run the `doctor.md` audit and diff against the baseline:
   which findings are resolved, which remain, and how the score and verdict
   moved. A finding is closed only when the re-audit no longer reports it —
   never mark it resolved from intent alone.

## Completion

The overhaul is done when step 3 has run and you can report, concretely:

- Baseline vs. final: D1-D7 score and loop-readiness verdict, before and after.
- Findings resolved (by ID), findings deferred (with reason — usually a missing
  enforcement surface captured as a `docs/todos` spec), and any finding that a
  re-audit shows is still open.
- Files created, changed, deleted, and prose rules converted to enforcement.
- Every validation command actually run during both audits, per the execution
  policy — a documented command not run is `unverified`, not passing.

Do not claim compliance from a single audit pass: without the re-verify step this
is just `doctor` followed by `docs`, and the loop that proves the remediation
worked is the whole point of this route.
