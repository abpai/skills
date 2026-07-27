# Simplify

Make code materially easier to understand, change, and operate without changing
its behavior. Prefer restructurings that delete concepts, branches, duplication,
needless work, or low-value tests over cosmetic cleanup.

## Scope contract

Classify the request before editing:

- **Scoped execution:** a named file, directory below the repo root, symbol,
  feature, subsystem, or current diff. Inspect, simplify, validate, and apply the
  worthwhile changes autonomously.
- **Whole-repository proposal:** omitted scope, `.`, the repository root, or an
  explicit whole-codebase request. Inspect the repository and return a ranked
  proposed batch. Do not edit code until the user selects or approves a batch.

If a supplied scope could mean either class, resolve it from the actual path. Ask
only when that evidence is genuinely ambiguous.

## Invariants

- Preserve public behavior, outputs, side effects, error semantics, data formats,
  and interfaces unless the user explicitly requests a behavior change.
- Follow local architecture, vocabulary, formatting, and test conventions.
- Protect unrelated working-tree changes. Never widen scope merely because a
  nearby file could also be cleaner.
- Scanner output is a lead, not a finding. Inspect surrounding code and tests
  before acting.
- A deletion needs reachability evidence. Zero grep hits alone never proves code
  is dead.
- A test deletion needs coverage evidence. Fewer tests is useful only when the
  surviving suite preserves the behavior, security, boundary, and contract guards
  that matter.
- Stop when the remaining gains are speculative, cosmetic, or disproportionate
  to their review cost.

## Evidence gathering

1. Record the repository root, branch, working-tree state, requested scope, and
   relevant validation commands.
2. Map entry points, ownership boundaries, imports, tests, and recent activity for
   the highest-signal areas. For a whole repository, rank hotspots using size,
   branching, coupling, duplication, churn, and centrality rather than reading
   every file uniformly.
3. When Python is available and a selected non-test target contains supported
   JS/TS or Python, run the bundled scanner. For an explicit test-pruning scope,
   start with the test rubric and behavioral census; run the generic scanner only
   when survivor-readability work makes its style leads useful.

   ```bash
   python3 <code-module-dir>/scripts/clean-code-scan.py <target> --format markdown
   ```

   For scoped execution, scan the requested target. For a whole-repository
   proposal, rank hotspots first and scan only the three to five highest-signal
   production areas; exclude generated code, vendored assets, fixtures, and
   bundled test/example corpora unless one is itself the requested concern. Do
   not run a repository-wide scanner merely because scope was omitted. A
   low-signal or truncated scan is evidence to narrow or stop scanning, not a
   reason to inspect every lead.

   The scanner accepts a file or directory; use repeatable `--exclude-glob`
   flags to keep tests, fixtures, generated examples, or other known-noise
   files out of a bounded directory scan.

   Read `references/clean-code-typescript-taxonomy.md` only when scanner leads or
   the target language make those principles relevant.
4. For changed code or deletion candidates, load
   `review-patterns/refactor-safety-check.md`. In scoped execution, use its
   quick pass and run the deep dead-code gauntlet before deleting a file, module,
   public symbol, or its tests. In whole-repository proposal mode, record the
   gauntlet as a proof obligation for a proposed slice; do not perform the full
   census, scorecard, or deletion proof until the user selects that slice.
5. When the requested scope is a test suite, test directory, or test-pruning
   request, read `references/test-deslop-rubric.md`. For a large approved scope,
   also read `references/test-deslop-fan-out.md` before partitioning work.

## Review passes

Use the passes that fit the evidence; do not manufacture one finding per pass.

1. **Reuse and duplication:** find hand-rolled behavior that an existing
   canonical helper, type, policy, or abstraction already owns. Distinguish
   accidental duplication from intentionally separate domain logic.
2. **Semantic shortcuts:** challenge code that guesses instead of consulting an
   authoritative contract — unjustified fallback chains, regex where a parser or
   schema exists, bespoke protocol/auth/security code, and boundary type
   assertions. When the scope contains one, load
   `review-patterns/semantic-shortcuts.md` and follow it. Most of what it finds
   is a correctness finding to report, not a behavior-preserving edit to apply;
   its apply rule governs which is which.
3. **Structural simplification:** look for a reframing that removes state,
   branches, flags, casts, optionality, wrappers, or whole layers of indirection.
   A refactor that only moves complexity is not a simplification.
4. **Readability and boundaries:** inspect naming, function shape, cohesion,
   abstraction level, side effects, error flow, and logic living in the wrong
   package or layer.
5. **Efficiency:** find repeated work, sequential independent work, N+1 access,
   avoidable I/O, hot-path bloat, unbounded collections, and no-op updates. Do not
   trade clarity for micro-optimization without evidence.
6. **Reachability:** start from executables, routes, jobs, exports, framework
   hooks, and external-consumer boundaries. Classify candidates as proven dead,
   test-only, conditional, externally consumable, or unresolved. Reflection,
   string dispatch, `eval`, and generated registration lower confidence.
7. **Test signal:** remove tests that only re-prove mocks, private call order,
   constants, duplicate branches, incidental snapshots, or vacuous assertions.
   Keep and sharpen observable behavior tests. Protect security and identity
   guards, public wire/CLI/API goldens, no-drift and dependency-boundary gates,
   compile-time type proofs, and intentional environment-gated test shims.

Every promoted item must cite concrete files/lines and explain the concept or
work it removes.

## Scoped execution

For a narrow scope:

1. Rank findings by simplification value and confidence.
2. Apply each worthwhile behavior-preserving change directly. Skip weak findings
   without padding the diff.
3. For dead code, remove in dependency-safe order only after the reachability
   proof passes. Preserve externally consumable exports unless the user confirms
   their consumers.
4. Run the narrowest useful validation first, then the repository gate required
   by the blast radius.
5. Re-read the final diff and confirm it is smaller in concepts, not merely
   different in style.

### Test-suite scopes

Treat test pruning as simplification, not as a separate command:

1. Inventory the target tests by area and capture before counts. Establish the
   pristine pass/fail baseline using the invocation CI actually uses; for a small
   scope, run the narrow CI-equivalent command first, but still finish with the
   repository gate required by the blast radius.
2. Apply the rubric autonomously within the named scope. Delete clearly low-value
   cases or whole files, conservatively clarify survivors, and keep borderline or
   load-bearing guards with an explicit reason. Do not weaken meaningful
   assertions just to reduce counts.
3. For a large named scope, calibrate on one representative slice before scaling.
   If subagents are used, give them non-overlapping test-file lists and the same
   rubric; centralize formatting, test execution, staging, and orphan cleanup.
4. Remove snapshots and fixtures made unreachable by the approved test deletions.
   Confirm the diff did not spill into production code or shared helpers unless
   those files were independently inside the requested simplify scope.
5. Re-run formatting, type checking, and the CI-equivalent suite. When deletion
   is justified, the proof is fewer tests with no new failures relative to
   baseline, plus a before/after count and a short account of what was protected.
   When every candidate is load-bearing or uncertain, a same-count justified
   no-op is the correct result; do not delete merely to satisfy a metric.

Done means the scoped changes are applied, relevant checks have run, and any
residual uncertainty is explicit.

## Whole-repository proposal

For broad scope, do not edit. Return a ranked batch table with:

- stable ID and proposed slice;
- evidence and affected paths;
- simplification move and concepts expected to disappear;
- behavior-preservation and reachability proof obligations;
- estimated review size and dependency order;
- recommended validation;
- confidence and reasons to defer.

Prefer a small batch of high-leverage, independently reviewable slices. Include
an explicit `not recommended` section for tempting cleanups whose evidence is too
weak. Done means the user can select a slice without another archaeology pass.

## Output

For scoped execution, report:

1. Applied simplifications.
2. Findings intentionally skipped and why.
3. Dead-code/reachability decisions, if any.
4. Test cases/files removed and protected, with before/after counts when relevant.
5. Validation commands and results.
6. Remaining risk.

For whole-repository work, return the ranked proposed batch and state clearly
that no files were modified.
