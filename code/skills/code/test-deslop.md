# Test Deslop

This is the test-suite pruning module in the `code` workflow pack. Claude users
can invoke `/code:test-deslop`; Codex users can ask for `code test-deslop` or a
natural-language test-deslop request.

Make a test suite high-signal: delete tests that don't earn their keep, and leave
the survivors easy to read. "Slop" is test code that adds maintenance weight without
buying safety — it breaks on refactors that don't change behavior, restates a
constant, re-proves a mock, or duplicates coverage that already exists elsewhere.

A good test reads as a behavior spec: a name that states the behavior, minimal
setup, one reason to fail, no comment needed to follow it. The goal is not "fewer
tests" — it's **higher signal per test**.

Deleting tests removes a safety net, and "low value" is a taste call. So calibrate
taste before scale, protect the load-bearing tests explicitly, and make
"no new failures" *provable* against a captured baseline rather than assumed.

## Confirm the contract first

Before touching anything, settle three decisions with the user. Use
`AskUserQuestion` when that tool is available; otherwise ask directly before
editing. These choices change the whole shape of the work:

- **Deletion bar** — *conservative* (only delete clearly worthless tests; when in
  doubt keep/rewrite) vs *opinionated* (delete anything that doesn't earn its keep,
  including brittle impl-detail and redundant coverage) vs *per-area* (stricter on
  critical paths than periphery).
- **Approval model** — *ratify a worksheet first* (you propose keep/delete/rewrite +
  reason per test; the user approves; then you execute) vs *trust + review the PR*
  (you change directly; the user reviews the diff).
- **Scope** — *pilot one area first* (calibrate, then expand) vs *full repo in one pass*.

Then ground the request: count the test files and lines, and map them by area, so
the plan is sized to reality, not a guess.

If the approval model is **ratify a worksheet first** or the user asks for a
dry run, stay read-only: do not edit, delete, format, stage, commit, or run a
long CI baseline unless the user explicitly asked for it. Produce the
evidence-backed worksheet and mark the CI baseline as the first execution step
after approval.

## The bar

Full catalog with examples in `references/test-deslop-rubric.md`. The short version:

**KILL** a test case (or the whole file if every case is low-value) when it is:

- **Tautological / mock-only** — asserts a mock returned what the mock was told to
  return; verifies wiring, not behavior.
- **Implementation-detail** — asserts call order, private internals, or exact
  log/string output that breaks on a behavior-preserving refactor.
- **Redundant / duplicate** — N near-identical cases on one branch, or coverage
  already guaranteed by a higher-level test (within the same file by default;
  cross-file only with proof the sibling actually covers it).
- **Over-specified non-contract snapshot** — whole-blob equality where one field
  matters, or a snapshot of text that is free to change (prompts, log streams).
- **Vacuous** — `expect(true)`, no real assertion, a permanently empty
  `.skip`/`it.todo`, or asserts a constant/type only.
- **Trivial** — a one-line getter / passthrough / constant with no logic.

**KEEP + SHARPEN** the survivors, conservatively: rename `describe`/`it` to state the
behavior, drop dead setup and unused imports, tighten an over-broad assertion only
when it doesn't weaken coverage. Never change the behavior under test or weaken a
meaningful assertion — survivor edits must keep the test passing.

**PROTECT** — do *not* prune these as "redundant" unless literally identical:

- Security / authz / identity checks; secret-redaction and path-traversal guards.
- Serializer / CLI / API-contract / prompt **goldens where the exact bytes ARE the
  contract** (a wire format or public payload, not incidental text).
- Codegen no-drift gates and import/dependency boundary guards.
- Compile-time type-identity guards (a `satisfies`/type assertion proving two types
  stay structurally equal across a package boundary).

Snapshots cut both ways: a prompt or log snapshot is a change-detector (kill); a
serializer's canonical output is a contract (keep). Decide by *what breaking it
would mean*.

## Workflow

1. **Baseline first.** Before executing approved edits, run the suite exactly the way CI does and capture the
   pass/fail set. For a scoped pilot, use the narrowest command that is already part
   of the CI-equivalent lane for that scope; if you cannot prove one, use the full
   CI-equivalent command. Before finishing, run the full CI-equivalent gate. Your
   finish line is "no *new* failures and fewer tests," not "all green" —
   pre-existing failures are not yours to fix here.
2. **Learn how the suite actually runs.** Whole-repo run vs per-package/per-file?
   A package-subset run can surface pre-existing order-dependent failures that the
   whole-repo CI run doesn't — the CI invocation is the source of truth. Don't chase
   phantom failures that exist on the pristine tree too.
3. **Naming alignment (cheap, do it early).** Pick one convention, rename the
   outliers (preserve history with `git mv`), fix references. Usually a handful of
   files.
4. **Partition into non-overlapping slices.** One coherent subtree per slice
   (~10-18 files). **Verify 0 gaps and 0 overlaps** against the target set before
   fanning out — a silent gap means files never get reviewed.
5. **Calibrate before scale.** Run ONE small representative slice first. Confirm the
   taste matches the user's bar *and* that edits/deletes actually land where you
   expect, then fan out the rest.
6. **Fan out.** Parallel subagents, each owning a disjoint slice, all under **one
   shared rubric verbatim** (consistency depends on this). Whole-file deletion via
   plain `rm` with central staging — not `git rm` per-agent — to avoid git-index
   contention across concurrent agents. Agents edit only the test files assigned
   to their slice, using the repo's convention (`*.test.ts`, `*.spec.ts`,
   `*.test.tsx`, etc.); never source, the code-under-test, or shared helpers.
   Template in `references/test-deslop-fan-out.md`.
7. **Clean up orphans.** Snapshot files with no remaining `toMatchSnapshot` calls;
   fixtures left unused by deletions.
8. **Verify.** Formatter check, typecheck (catches imports orphaned by prunes), then
   the full suite vs the baseline. Safety sweep: confirm only intended test files
   changed and **no source files were touched**.
9. **Ship.** One commit / PR. Put the per-case rationale and the before/after test
   counts in the body so the human can review the taste, not just the line count.

## Pitfalls

- **Inconsistent taste across agents** — give every agent the identical rubric; vary
  only the file list and an area-specific note.
- **Breaking coverage by over-rewriting** — prefer deleting whole low-value files;
  keep survivor edits conservative so the suite stays green and the diff stays
  reviewable.
- **Mislabeling a contract as slop** — wire-format/golden snapshots, security guards,
  and no-drift gates look prunable but aren't. When unsure, keep and flag.
- **"It's cleaner" is not "it caught a bug"** — but neither is deleting a real guard.
  The bar is value, in both directions.
- **Skipped tests with bodies that are env-gated** (`POSTGRES_URL` etc.) are
  deliberate CI-visibility shims, not abandoned `.skip` — keep them.
