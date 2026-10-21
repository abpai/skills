# pstack approval ledger

Reconciled against the conversation and files on 2026-10-21. This records
content approval, not completed runtime validation or publication. Review
order is alphabetical, skipping approved entries. Full validation is deferred
until drafting is complete.

| Upstream principle | Status | Local file or disposition |
| --- | --- | --- |
| Attack the Premise | Approved; reconciled | `pstack/skills/pstack/principles/principle-attack-the-premise.md`; includes stop condition, distinction, and local cross-references. |
| Boundary Discipline | Approved; reconciled | `pstack/skills/pstack/principles/principle-boundary-discipline.md`; includes pure logic, thin I/O, examples, testability, and qualified trust. |
| Build the Lever | Approved; renamed | `pstack/skills/pstack/principles/principle-script-bulk-operations.md`; name changed only, retaining bulk updates, one-off verification, placement, and paired example. |
| Encode Lessons in Structure | Approved; reconciled | `pstack/skills/pstack/principles/principle-encode-lessons-in-structure.md`; includes ownership, authoritative guidance, failure examples, and retiring redundant reminders. |
| Exhaust the Design Space | Approved | `pstack/skills/pstack/principles/principle-exhaust-the-design-space.md`; limited to novel UI interactions or architectural decisions without useful precedent. |
| Experience First | Approved; renamed | `pstack/skills/pstack/principles/principle-prioritize-usability.md`; renamed Prioritize Usability. |
| Explain the Number | Approved; reconciled | `pstack/skills/pstack/principles/principle-explain-the-number.md`; includes measured limiter, alternative explanations, retained evidence, and both local dependencies. |
| Fix Root Causes | Initial port; individual review pending | `pstack/skills/pstack/principles/principle-fix-root-causes.md`. |
| Foundational Thinking | Split approved; partially incorporated | Planning lens is in `plan.md`. Read/write patterns, explicit code, prerequisites, and subtraction are in their existing destinations. Concurrency isolation and behavior-testing guidance await review of their destination principles. |
| Guard the Context Window | Excluded | Context management, phase budgets, and delegation strategy belong to the harness; avoid conflicting guidance. |
| Laziness Protocol | Approved; reconciled | `pstack/skills/pstack/principles/principle-laziness-protocol.md`; bullet conversion preserves the accepted content. |
| Make Operations Idempotent | Approved | `pstack/skills/pstack/principles/principle-make-operations-idempotent.md`; repeat and partial-failure safety. |
| Migrate Callers Then Delete Legacy APIs | Approved | `pstack/skills/pstack/principles/principle-migrate-callers-then-delete-legacy-apis.md`. |
| Minimize Reader Load | Approved; reconciled | `pstack/skills/pstack/principles/principle-minimize-reader-load.md`; includes independent axes, returns over mutation, and the cost-benefit threshold. |
| Model the Domain | Initial port; individual review pending | `pstack/skills/pstack/principles/principle-model-the-domain.md`; agreed read/write-pattern addition now incorporated. |
| Never Block on the Human | Excluded | Autonomy and approval policy belong to the harness; avoid competing instructions. |
| Outcome-Oriented Execution | Approved | `pstack/skills/pstack/principles/principle-outcome-oriented-execution.md`; planned rewrites and migrations with verification checkpoints. |
| Prove It Works | Approved; reconciled | `pstack/skills/pstack/principles/principle-prove-it-works.md`; includes explicit self-report exclusion, executed deterministic checks, retained output, audit retention, and process example. |
| Redesign from First Principles | Approved; reconciled | `pstack/skills/pstack/principles/principle-redesign-from-first-principles.md`; five bullets preserve the focused trigger and cost comparison. |
| Separate Before Serializing Shared State | Approved | `pstack/skills/pstack/principles/principle-separate-before-serializing-shared-state.md`; includes the agreed Foundational Thinking concurrency guidance. |
| Sequence Work into Verifiable Units | Initial port; individual review pending | `pstack/skills/pstack/principles/principle-sequence-verifiable-units.md`; agreed prerequisite-types/tooling addition now incorporated. |
| Subtract Before You Add | Approved; reconciled | `pstack/skills/pstack/principles/principle-subtract-before-you-add.md`; includes prompt cleanup, empty-reference removal, and separate related-principle links. |
| Test Behavior, Not Implementation | Approved | `pstack/skills/pstack/principles/principle-test-behavior-not-implementation.md`; includes the agreed Foundational Thinking testing guidance. |
| Type System Discipline | Approved | `pstack/skills/pstack/principles/principle-type-system-discipline.md`. |

## Supporting documents

- `pstack/skills/pstack/verify.md` and `auto.md`: approved; not yet added to
  the public mode router.

- `pstack/skills/pstack/benchmark-checklist.md`: approved after restoring fair
  tuning, capacity arithmetic, measurement evidence, and per-run checks.
- `pstack/skills/pstack/plan.md`: approved research → draft → refine order,
  structural-decisions/prerequisites prompt, general terminology, and only
  the refined plan in the response.

## Reconciliation repairs

- Prove It Works refinements were initially discussed but unwritten; they
  were applied and read back before this audit.
- This audit found and applied the agreed read/write-pattern addition to
  Model the Domain and prerequisite-types/tooling addition to Sequence
  Verifiable Units.
- The rest of the approved content was present on direct file inspection.
- Remaining Foundational Thinking redistribution is explicitly pending,
  rather than treated as already implemented.
- Read back both repaired files and checked all 28 local references across
  the 17 skill Markdown files; every target exists. This was a content and
  reference audit, not the deferred runtime validation suite.

## Plain-language pass

At the user's request, all 13 drafted principles and their selection index
received a wording pass. Titles, scope, decisions, and links were preserved.
Examples of changed phrasing:

- "read/write patterns" became "common lookups and updates".
- "invariants" became "rules that must always hold".
- "pass-through layers" became "wrappers that only pass calls along".
- "mutable state" became "values that can change".
- "verifiable increments" became "small steps whose results can each be checked".
- "pure" and "deterministic" were retained with short explanations of their meaning.

The revised principle files were read back. This is an editorial pass; the
deferred behavioral and packaging validation is still pending.
