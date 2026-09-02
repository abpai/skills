# Deslop Comments

Clean comments across a repository without losing essential rationale or
changing behavior.

## Scope contract

Use the requested path, area, diff, or repository as the maintained scope. A
repository-wide request is an execution scope, not proposal-only: inspect and
clean all maintained areas unless the user asks for a report first.

Exclude generated and vendored output unless it is itself the maintained
source. Change the owning generator or template when generated comments need to
change.

## Outcome

- Remove comments that narrate clear code, duplicate nearby documentation,
  preserve obsolete history, or contradict current behavior.
- Preserve concise rationale that is not evident from code, especially
  security, concurrency, compatibility, product, operational, performance, and
  recovery constraints.
- Retain actionable TODOs, legal requirements, and required formatter, linter,
  type, coverage, or bundler directives.
- Cover every maintained area in scope, including configuration, deployment,
  fixtures, scripts, and runbooks where relevant.
- Leave no unintended behavioral change.

Prefer comments that explain **why** a constraint exists. Remove comments that
merely explain **what** clear code does. Every retained comment must be accurate
and worth its maintenance cost.

## Workflow

1. Read repository instructions, inspect working-tree changes, and identify
   maintained, generated, vendored, nested-workspace, and independently built
   areas in scope.
2. Inventory comment-bearing files across the scope. Searches and scanners are
   leads, not deletion authority; inspect every candidate with its surrounding
   code and relevant history or documentation when needed.
3. Classify each candidate as keep, rewrite, remove, or out of scope. Treat
   source comments, docstrings, test descriptions, directives, configuration
   annotations, and operator guidance according to their distinct purposes.
4. Make comment-focused edits in coherent batches. If upstream changes overlap,
   preserve upstream behavior and keep only cleanup that remains valid. Do not
   resurrect deleted code.
5. Review the complete diff for semantic neutrality, then run repository-native
   validation proportional to every affected surface.

The sweep is complete when the maintained scope has been examined, retained
rationale remains sufficient, and the current diff is supported by appropriate
validation rather than candidate counts alone.

## Invariants

- Follow repository instructions and preserve unrelated user changes.
- Do not use broad text matching as authority to delete comments without
  context.
- Comment-only edits still change bytes, so they can affect
  formatting, snapshots, content fingerprints, generated proofs, and
  independent workspaces with separate toolchains.
- Do not merge, rebase, push, or change pull request state without
  authorization.

## Evidence

Use the repository's own validation and choose effort proportional to the
change. Establish confidence that:

- the intended maintained areas were covered;
- retained rationale remains sufficient;
- the diff is semantically neutral;
- formatting, focused tests, generated artifacts, snapshots, and content
  fingerprints remain valid where affected;
- nested or independent workspaces pass with their own tools; and
- required checks pass for the current head when pull request readiness is in
  scope.

Report the outcome, rationale preserved, evidence gathered, validation left to
CI, and unresolved gaps. Never present an obsolete CI run as proof for a newer
commit.
