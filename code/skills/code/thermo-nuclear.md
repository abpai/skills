# Thermo-Nuclear Baseline-to-PR Code Quality Review

Use this skill for an unusually strict codebase-health review of an existing
branch, repository, package, module, subsystem, or path.

This skill has exactly one mode: **Baseline-to-PR mode**. It reviews the scoped
codebase as it exists today and produces a list of evidence-backed findings that
could later inform a focused remediation PR. It does not edit code, create a
branch, commit, push, or open a PR.

Above all, this skill should push the reviewer to be ambitious about code
structure. Do not merely identify local cleanup opportunities. Actively search
for "code judo" moves: behavior-preserving restructurings that would make the
implementation dramatically simpler, smaller, more direct, and more elegant.

## Core Prompt

> Perform a deep code quality audit of the scoped codebase as it exists today.
> Find structural debt that is active, costly, or likely to compound.
> Look for behavior-preserving restructurings that would make the implementation
> dramatically simpler, smaller, more direct, and easier to extend.
> Generate only findings supported by concrete evidence from files, line
> references, commands, or observed behavior.
> Do not edit code, create branches, commit, push, or open a PR.
> Be ambitious about simplification. Measure twice, cut once.

## Non-Goals

- Do not perform a merge-readiness review.
- Do not make code changes as part of this skill.
- Do not prepare a branch, commit, PR title, PR body, or test plan.
- Do not produce generic health commentary without evidence.
- Do not include speculative recommendations that are not tied to observed code.
- Do not flood the output with cosmetic nits when structural findings exist.

## Workflow

1. **Define scope.**
   - Identify the branch, package, path, or subsystem under review.
   - If the user gave no scope, use the current branch and the highest-signal
     production areas instead of attempting a whole-monorepo audit.
   - State any scope limits explicitly in the evidence limits section.

2. **Protect the working tree.**
   - Check branch name and working tree status before analysis.
   - Do not overwrite, format, stage, revert, or otherwise alter unrelated user
     changes.
   - If existing changes overlap the review scope, treat them as context and
     say what could or could not be distinguished from the stable baseline.

3. **Gather structural evidence.**
   - Use line counts, directory layout, imports, branching density, duplication,
     type boundaries, ownership boundaries, and commit activity when useful.
   - Read full contents of the highest-signal files: largest, most imported,
     most branching, most central to the scope.
   - Prefer active debt that affects current development over stale ugliness
     nobody touches.

4. **Convert evidence into findings.**
   - A finding needs a concrete source: file/line references, command output, or
     directly observed behavior.
   - Each finding should explain why the evidence matters structurally.
   - Include a remediation direction only when it follows directly from the
     evidence; keep it short and reviewable.
   - Drop weak hunches instead of padding the report.

5. **Report evidence limits honestly.**
   - If the review did not inspect a relevant path, test, branch, generated
     artifact, or runtime behavior, say so.
   - If evidence is incomplete, triage explicitly rather than pretending full
     coverage.

## Evidence Gathering

Use the narrowest useful evidence for the requested scope:

- Current branch and working tree status.
- File tree and line counts for the scoped path.
- Import and ownership-boundary searches.
- Searches for repeated conditionals, duplicate helpers, casts, broad
  optionality, feature flags, and one-off branches.
- Full contents of high-signal production files and nearby tests when tests
  reveal design intent.
- Optional `git log -n 20 -- <path>` to distinguish active debt from stale
  code. Do not blame authors; focus on structure.

Avoid expensive validation unless the user asks for it. If you run a command,
use its output only as supporting evidence for the findings.

## Primary Review Questions

For every baseline hotspot, ask:

- Is there a code-judo move that would make this dramatically simpler?
- Can this code be reframed so fewer concepts, branches, or helper layers are
  needed?
- Does this area improve or worsen the local architecture?
- Does the code preserve branching complexity where a better abstraction should
  exist?
- Has a cohesive module become too coupled, too stateful, or too hard to scan?
- Is this logic living in the right file and layer?
- Is an oversized file actively absorbing responsibilities that should be split
  out?
- Are repeated conditionals signaling a missing model, helper, state machine, or
  policy object?
- Is the implementation direct and legible, or does it rely on special cases and
  incidental control flow?
- Is this abstraction earning its keep, or is it just a wrapper?
- Do casts, optionality, or ad-hoc object shapes obscure the real invariant?
- Is this logic living in the canonical layer, or did details leak across a
  boundary?
- Is this orchestration more sequential or less atomic than it needs to be?
- What is the smallest evidence-supported remediation direction for this issue?

## What To Flag Aggressively

Escalate findings when evidence shows:

- A complicated implementation where a cleaner reframing could delete whole
  categories of complexity.
- Refactors that move code around but fail to reduce the number of concepts a
  reader must hold in their head.
- An active file over 1000 lines that keeps accumulating responsibilities.
- Ad-hoc conditionals bolted onto unrelated code paths.
- One-off booleans, nullable modes, or flags that complicate existing control
  flow.
- Feature-specific logic leaking into general-purpose modules.
- Generic or magical handling that hides simple structure and makes the code
  harder to reason about.
- Thin wrappers or identity abstractions that add indirection without
  simplifying anything.
- Unnecessary casts, `any`, `unknown`, or optional params that muddy the real
  contract.
- Copy-pasted logic instead of extracted helpers.
- Narrow edge-case handling implemented in the middle of an already busy
  function.
- Passing code that leaves the system less modular or less readable.
- Temporary branching that is likely to become permanent debt.
- Bespoke helpers where the codebase already has a canonical utility.
- Logic added in the wrong layer/package when there is a clear canonical home.
- Sequential async flow where independent work could stay simpler and clearer
  with parallel execution.
- Partial-update logic that leaves state less atomic than necessary.

## Preferred Remediation Directions

When a finding is proven, prefer concise directions like:

- Delete a whole layer of indirection rather than polishing it.
- Reframe the state model so conditionals disappear instead of getting
  centralized.
- Change the ownership boundary so the feature becomes a natural extension of an
  existing abstraction.
- Turn special-case logic into a simpler default flow with fewer exceptions.
- Extract a helper or pure function.
- Split a large file into smaller focused modules.
- Move feature-specific logic behind a dedicated abstraction.
- Replace condition chains with a typed model or explicit dispatcher.
- Separate orchestration from business logic.
- Collapse duplicate branches into a single clearer flow.
- Delete wrappers that do not meaningfully clarify the API.
- Reuse the existing canonical helper instead of introducing a near-duplicate.
- Make type boundaries more explicit so the control flow gets simpler.
- Move logic to the package/module/layer that already owns the concept.
- Parallelize independent work when that also simplifies orchestration.
- Restructure related updates into a more atomic flow when partial state would
  be harder to reason about.

Do not be satisfied with "maybe rename this" feedback when the real issue is
structural. Do not be satisfied with a merely cleaner version of the same messy
idea if there is a plausible path to a much simpler idea.

## Output Expectations

Lead with findings, ordered by severity and grounded in file/line references.
Use this shape:

```markdown
Findings

1. [Severity] Title
   Evidence: file/path.ts:123 shows ..., and file/path.ts:184 shows ...
   Why it matters: ...
   Remediation direction: ...
```

Prioritize findings in this order:

1. Active structural debt
2. Missed opportunities for dramatic simplification / code-judo restructuring
3. Spaghetti or branching complexity
4. Boundary, abstraction, or type-contract problems
5. File-size and decomposition concerns
6. Modularity and abstraction issues
7. Legibility and maintainability concerns

Keep the output focused:

- Every finding must cite evidence.
- If there are no evidence-supported findings, say that clearly.
- Include open questions only when they block confidence in a finding.
- Include evidence limits after the findings when coverage was incomplete.
- Do not include a change summary, merge verdict, PR notes, or validation plan
  unless the user separately asks for follow-up implementation work.

## Tone

Be direct, serious, and demanding about quality. Do not be rude, but do not
soften major maintainability issues into mild suggestions. If the code is making
the codebase messier, say so clearly. If the implementation missed an
opportunity for dramatic simplification, say that clearly too.

Good phrases:

- `this area is already over 1k lines and still accumulating responsibilities.`
- `this adds another special-case branch into an already busy flow.`
- `this works, but it makes the surrounding code more spaghetti.`
- `this feels like feature logic leaking into a shared path.`
- `this abstraction seems unnecessary; the direct flow would be clearer.`
- `why does this need a cast or optional here? can the boundary be explicit?`
- `this looks like a bespoke helper for something the codebase already owns.`
- `there is a code-judo move here that would make these branches disappear.`
- `this refactor moves complexity around, but does not delete it.`
