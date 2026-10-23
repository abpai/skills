# pstack approval ledger

Reconciled against the conversation and files on 2026-10-21. This records
content approval, not completed runtime validation or publication. Drafting
is complete; behavioral validation is tracked in `docs/pstack-handoff.md`.

| Upstream principle | Status | Local file or disposition |
| --- | --- | --- |
| Attack the Premise | Approved; reconciled | `pstack/skills/pstack/principles/principle-attack-the-premise.md`; includes stop condition, distinction, and local cross-references. |
| Boundary Discipline | Approved; reconciled | `pstack/skills/pstack/principles/principle-boundary-discipline.md`; includes pure logic, thin I/O, testability, and qualified trust. The upstream prompt-construction example was merged into the pure-functions bullet in 0.4.2. |
| Build the Lever | Approved; renamed | `pstack/skills/pstack/principles/principle-script-bulk-operations.md`; name changed only, retaining bulk updates, one-off verification, placement, and paired example. |
| Encode Lessons in Structure | Approved; reconciled | `pstack/skills/pstack/principles/principle-encode-lessons-in-structure.md`; includes ownership, authoritative guidance, failure examples, and retiring redundant reminders. |
| Exhaust the Design Space | Approved | `pstack/skills/pstack/principles/principle-exhaust-the-design-space.md`; limited to an open decision that sets a new UI interaction, architecture, or product behavior policy with no precedent in this codebase (widened in `b2715a4a`, reworded in 0.4.2, and linked from `plan.md` step 3; see below). |
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
| Outcome-Oriented Execution | Approved | `pstack/skills/pstack/principles/principle-outcome-oriented-execution.md`; planned rewrites and migrations with verification checkpoints; its two headings were flattened in 0.4.2. |
| Prove It Works | Approved; reconciled | `pstack/skills/pstack/principles/principle-prove-it-works.md`; includes explicit self-report exclusion, executed deterministic checks, retained output, audit retention, and process example. Since 0.4.2 a check is tested on pass or fail, not only on failure. |
| Redesign from First Principles | Approved; reconciled | `pstack/skills/pstack/principles/principle-redesign-from-first-principles.md`; five bullets preserve the focused trigger and cost comparison. |
| Separate Before Serializing Shared State | Approved | `pstack/skills/pstack/principles/principle-separate-before-serializing-shared-state.md`; includes the agreed Foundational Thinking concurrency guidance. |
| Sequence Work into Verifiable Units | Drafted; in approved wording pass | `pstack/skills/pstack/principles/principle-sequence-verifiable-units.md`; agreed prerequisite-types/tooling addition incorporated. Individual review skipped at the user's request. |
| Subtract Before You Add | Approved; reconciled | `pstack/skills/pstack/principles/principle-subtract-before-you-add.md`; includes empty-reference removal and separate related-principle links. In 0.4.2 the prompt-cleanup bullet was removed and the opening narrowed to dead code, redundant checks, or unneeded layers. |
| Test Behavior, Not Implementation | Approved | `pstack/skills/pstack/principles/principle-test-behavior-not-implementation.md`; includes the agreed Foundational Thinking testing guidance. |
| Type System Discipline | Approved | `pstack/skills/pstack/principles/principle-type-system-discipline.md`. |

## Supporting documents

- `pstack/skills/pstack/verify.md` and `auto.md`: approved; routed from
  `pstack/skills/pstack/SKILL.md` in 0.4.0.

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
- Entrypoints: the hidden `plan`, `verify`, and `auto` wrapper skills were
  removed, leaving the `pstack` umbrella as the only entrypoint. Claude does
  not register `user-invocable: false` skills as commands, so `/pstack:verify`
  silently did nothing in `claude -p`, while `/pstack verify ...` routed
  correctly. The user chose `/pstack plan|verify|auto` over the wrappers.
  Mode text is unchanged.
- `8c395a22` (0.4.1): repairs from the round-4 dogfood. `SKILL.md` says to
  read the mode's module file in full before any other step. `plan.md`
  separates settled from open decisions, selects principles against the task,
  findings and open decisions before drafting, covers every confirmed cause,
  and leaves flexible only details that do not change behavior or structure.
  Exhaust the Design Space treats precedent as this codebase's and, in plan
  mode, recommends one option. `verify.md` adds a Requirements section, checks
  with commands, and unverified only after an attempt or a stated reason.
  `auto.md` reports selected principles and checks run. The plan order
  (select, then draft) departs from the handoff's preserved
  "drafts the smallest approach, then selects principles" decision, and round
  5 showed principle over-selection. 0.4.2 resolved both (below). Not
  separately content-reviewed.
- `7ad0641a` (0.4.2): edits approved in conversation before the commit, plus
  four prompt-audit hunks (`docs/pstack-prompt-audit.md`).
  - **Plan ordering.** Research; then, for an open decision with no
    precedent in this codebase, compare two or three options following
    Exhaust the Design Space; then a rough draft of the smallest approach
    that covers the request and every confirmed cause; then select principles
    against the task, findings and draft, read them and revise; then recheck
    and drop principles that changed nothing. This restores the preserved
    "draft, then select" order. `principles.md` now says "Keep at most five".
  - **Verify from a PR alone.** The plan is optional. The request can be a
    pull request's description and linked issue, and the report says when
    the PR's own description is the only statement of the request.
  - **Trigger rewrites.** 12 rows in `principles.md` rewritten against the
    upstream descriptions (Laziness Protocol, Attack the Premise, Boundary
    Discipline, Exhaust the Design Space, Prioritize Usability,
    Outcome-Oriented Execution, Explain the Number, Subtract Before You Add,
    Model the Domain, Sequence Verifiable Units, Make Operations Idempotent,
    Migrate Callers Then Delete Legacy APIs), with each matching principle
    file's opening line aligned. Earlier notes said 13 rows; the diff
    changes 12.
  - **Audit hunks.** Prove It Works tests a check on pass or fail; the
    Boundary Discipline prompt-construction aside merged into the previous
    bullet; the Subtract Before You Add prompt-cleanup bullet removed;
    Outcome-Oriented Execution headings flattened.
  - Round 6 (`docs/pstack-dogfood.md`): Claude subagent 10 of 13, Codex
    `gpt-6.1-sol` 12 of 13. Over-selection is gone, but Exhaust the Design
    Space was padding in 8 of 12 plan runs and the recheck dropped two
    bolded should-select principles. Open; no further skill change made.
- `89b0f999` (0.4.3): the held audit hunk for `SKILL.md` routing. "Otherwise,
  before any other step, read the mode's module file below in full and follow
  it ... do not infer them" became "Otherwise read the mode's module file
  below and follow it; the steps and report format of each mode exist only in
  that file." Applied because `gpt-6.1-sol` read the mode file first in all 12
  round-6 mode runs. The unsupported-mode stop and the `verify` route bullet
  are unchanged, so their ablation spans still match. Not rerun on either
  dogfood host; Eve iteration 6 (`gpt-6-luna`) passed every mode-file read
  gate on it.

- `09fa61c8` (0.4.4), approved in conversation: plan step 3 compares
  options only for a still-open decision that would set new UI,
  architecture, or product behavior that nothing settles, without naming
  Exhaust the Design Space inline; the Exhaust trigger and file scope line
  match. "Keep at most five" became a short-list rule with no number, per the
  prompt audit. Plan pointers settle behavior and structure, leave coding to
  implementation, and trace to the request or a finding. The user accepted
  that the recheck may drop a principle the draft already follows. Checked on
  Claude subagents only (round 7), by the user's choice.

- 0.4.5 (`verify.md` only), approved in conversation as the lean plan for a
  real-series eval packet: series-aware review, a premise check with the
  smaller alternative, defects kept as Findings wherever the fix lands, and
  Decisions limited to choices that change what ships. Checked by a same-day
  0.4.4 vs 0.4.5 rerun on 11 private commits (round 9) and the Eve lane.

Neither 0.4.2, 0.4.3, 0.4.4, nor 0.4.5 has had a separate user content review of the
changed text beyond the conversation approvals noted above; review them in
the draft PR.
