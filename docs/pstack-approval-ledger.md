# pstack approval ledger

Reconciled against the conversation and files on 2026-10-21. This records
content approval, not completed runtime validation or publication. Drafting
is complete; behavioral validation is tracked in `docs/pstack-handoff.md`.

| Upstream principle | Status | Local file or disposition |
| --- | --- | --- |
| Attack the Premise | Approved; reconciled | `pstack/skills/pstack/principles/principle-attack-the-premise.md`; includes stop condition, distinction, and local cross-references. |
| Boundary Discipline | Approved; reconciled | `pstack/skills/pstack/principles/principle-boundary-discipline.md`; includes pure logic, thin I/O, examples, testability, and qualified trust. |
| Build the Lever | Approved; renamed | `pstack/skills/pstack/principles/principle-script-bulk-operations.md`; name changed only, retaining bulk updates, one-off verification, placement, and paired example. |
| Encode Lessons in Structure | Approved; reconciled | `pstack/skills/pstack/principles/principle-encode-lessons-in-structure.md`; includes ownership, authoritative guidance, failure examples, and retiring redundant reminders. |
| Exhaust the Design Space | Approved | `pstack/skills/pstack/principles/principle-exhaust-the-design-space.md`; limited to novel UI interactions, architectural decisions, or product behavior policies without useful precedent (widened in `b2715a4a`; see below). |
| Experience First | Approved; renamed | `pstack/skills/pstack/principles/principle-prioritize-usability.md`; renamed Prioritize Usability. |
| Explain the Number | Approved; reconciled | `pstack/skills/pstack/principles/principle-explain-the-number.md`; includes measured limiter, alternative explanations, retained evidence, and both local dependencies. |
| Fix Root Causes | Drafted; in approved wording pass | `pstack/skills/pstack/principles/principle-fix-root-causes.md`. Individual review skipped at the user's request. |
| Foundational Thinking | Split approved; incorporated | Planning lens is in `plan.md`. Read/write patterns, explicit code, prerequisites, and subtraction are in their existing destinations. Concurrency isolation is in Separate Before Serializing Shared State and behavior-testing guidance in Test Behavior, Not Implementation; both destinations are approved. |
| Guard the Context Window | Excluded | Context management, phase budgets, and delegation strategy belong to the harness; avoid conflicting guidance. |
| Laziness Protocol | Approved; reconciled | `pstack/skills/pstack/principles/principle-laziness-protocol.md`; bullet conversion preserves the accepted content. |
| Make Operations Idempotent | Approved | `pstack/skills/pstack/principles/principle-make-operations-idempotent.md`; repeat and partial-failure safety. |
| Migrate Callers Then Delete Legacy APIs | Approved | `pstack/skills/pstack/principles/principle-migrate-callers-then-delete-legacy-apis.md`. |
| Minimize Reader Load | Approved; reconciled | `pstack/skills/pstack/principles/principle-minimize-reader-load.md`; includes independent axes, returns over mutation, and the cost-benefit threshold. |
| Model the Domain | Drafted; in approved wording pass | `pstack/skills/pstack/principles/principle-model-the-domain.md`; agreed read/write-pattern addition incorporated. Individual review skipped at the user's request. |
| Never Block on the Human | Excluded | Autonomy and approval policy belong to the harness; avoid competing instructions. |
| Outcome-Oriented Execution | Approved | `pstack/skills/pstack/principles/principle-outcome-oriented-execution.md`; planned rewrites and migrations with verification checkpoints. |
| Prove It Works | Approved; reconciled | `pstack/skills/pstack/principles/principle-prove-it-works.md`; includes explicit self-report exclusion, executed deterministic checks, retained output, audit retention, and process example. |
| Redesign from First Principles | Approved; reconciled | `pstack/skills/pstack/principles/principle-redesign-from-first-principles.md`; five bullets preserve the focused trigger and cost comparison. |
| Separate Before Serializing Shared State | Approved | `pstack/skills/pstack/principles/principle-separate-before-serializing-shared-state.md`; includes the agreed Foundational Thinking concurrency guidance. |
| Sequence Work into Verifiable Units | Drafted; in approved wording pass | `pstack/skills/pstack/principles/principle-sequence-verifiable-units.md`; agreed prerequisite-types/tooling addition incorporated. Individual review skipped at the user's request. |
| Subtract Before You Add | Approved; reconciled | `pstack/skills/pstack/principles/principle-subtract-before-you-add.md`; includes prompt cleanup, empty-reference removal, and separate related-principle links. |
| Test Behavior, Not Implementation | Approved | `pstack/skills/pstack/principles/principle-test-behavior-not-implementation.md`; includes the agreed Foundational Thinking testing guidance. |
| Type System Discipline | Approved | `pstack/skills/pstack/principles/principle-type-system-discipline.md`. |

## Supporting documents

- `pstack/skills/pstack/verify.md` and `auto.md`: approved; routed from
  `pstack/skills/pstack/SKILL.md` and hidden `verify`/`auto` wrappers in 0.4.0.

- `pstack/skills/pstack/benchmark-checklist.md`: approved after restoring fair
  tuning, capacity arithmetic, measurement evidence, and per-run checks.
- `pstack/skills/pstack/plan.md`: approved research → draft → refine order,
  structural-decisions/prerequisites prompt, general terminology, and only
  the refined plan in the response. In 0.4.0 its opening sentence lets a
  calling workflow such as auto continue past the plan.

## Reconciliation repairs

- Prove It Works refinements were initially discussed but unwritten; they
  were applied and read back before this audit.
- This audit found and applied the agreed read/write-pattern addition to
  Model the Domain and prerequisite-types/tooling addition to Sequence
  Verifiable Units.
- The rest of the approved content was present on direct file inspection.
- Foundational Thinking redistribution was pending at the time of that audit;
  it is now complete (see the table).
- At that time, read back both repaired files and checked all 28 local
  references across the then 17 skill Markdown files; every target existed.
  The 0.4.0 audit rechecked 41 local Markdown links across the 27 Markdown
  files in `pstack/skills/pstack/`; every target exists and all 21 retained
  principles are listed in `principles.md`. This was a content and
  reference audit, not the deferred runtime validation suite.

## Plain-language pass

At the user's request, the principles drafted at that point (including Fix
Root Causes, Model the Domain, and Sequence Verifiable Units) and their
selection index received a wording pass, which the user approved. The user
chose not to redo individual reviews of those three principles afterward. Titles, scope, decisions, and links were preserved.
Examples of changed phrasing:

- "read/write patterns" became "common lookups and updates".
- "invariants" became "rules that must always hold".
- "pass-through layers" became "wrappers that only pass calls along".
- "mutable state" became "values that can change".
- "verifiable increments" became "small steps whose results can each be checked".
- "pure" and "deterministic" were retained with short explanations of their meaning.

The revised principle files were read back. This is an editorial pass; the
deferred behavioral and packaging validation is still pending.

## 0.4.0 index trigger change

The Laziness Protocol trigger "Sizing a change or considering an abstraction"
matched every task. It now reads "Adding a helper, layer, or abstraction, or
scope grows beyond the request". Principle text is unchanged.

## Changes after the 0.4.0 dogfood

Made in response to dogfood and eval evidence, recorded in
`docs/pstack-dogfood.md`. They have not had a separate user content review;
review them in the draft PR.

- `b2715a4a`: the Exhaust the Design Space trigger also covers a product
  behavior policy with no precedent, and in plan mode the agent compares the
  options and proposes prototypes instead of building them.
- `221737ac`: routing change. `SKILL.md` now shows usage and stops unless the
  mode is exactly `plan`, `verify`, or `auto`, and does not map synonyms such as
  `review`. `plan.md` asks for state the approach depends on that the code does
  not keep yet, and links selected principles as `principles/<file>.md`.
