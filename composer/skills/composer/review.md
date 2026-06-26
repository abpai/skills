# Composer Review

Run Cursor Composer as a strict, read-only reviewer for a working-tree diff,
branch diff, or PR diff.

## Workflow

1. Resolve review target:
   - current uncommitted diff
   - `BASE...HEAD`
   - a GitHub PR patch
2. If auth/model readiness is unknown, run the review readiness smoke from
   `setup.md` before gathering any diff or sending repo content to Composer.
   Prefer `composer-2.5-fast`; use `composer-2.5` for strict release gates.
3. Gather the diff and only the surrounding context needed to judge changed
   behavior. Avoid whole-repo dumps, generated artifacts, unrelated logs, and
   setup transcripts.
4. Run Composer in read-only ask mode through the wrapper:

```bash
composer/skills/composer/scripts/composer-run.sh review \
  --model composer-2.5 \
  --prompt-file /path/to/review-prompt.md \
  --workspace /path/to/repo
```

Use `composer-2.5-fast` for quick second opinions; use `composer-2.5` for
strict release-gate review. Use `--output-format json` when you want a single
parseable final answer; the final text is in the `result` field. Use
`stream-json` only for progress monitoring.

5. Treat Composer findings as input, not truth. Verify each finding against the
   code before forwarding it to the user or asking an implementer to fix it.
6. If the user wants "no findings left", run a repair pass separately and then
   review the updated diff again.
7. The review itself is strictly read-only: Composer never writes, and the
   write-capable tools pre-approved on the Composer umbrella are off-limits
   during review. Only if the user explicitly asks to improve, update, or merge
   the PR does the parent agent move to a separate write phase *after* the review
   completes — and the parent agent, not Composer, performs those steps. Before
   merging, refresh the branch against the current base, check
   mergeability/conflicts, run repo validation, wait for required checks, and
   verify the final merged state.

## Review Prompt Contract

Ask Composer to lead with findings and focus on:

- correctness bugs and regressions
- missed edge cases
- missing tests or QA
- security and secret handling
- cross-boundary contract drift
- risky behavior changes hidden inside refactors

Ask it to avoid style-only feedback unless it blocks maintainability.

For adversarial review, ask for the smallest useful answer: actionable findings
only, concrete file/line evidence, and no implementation plan unless a finding
needs a short fix sketch. Do not include Composer setup smoke output in the
review prompt.

## Output

Use:

1. `Findings` grouped by severity with file/line references.
2. `Verified False Positives` for rejected findings.
3. `Required Fixes` if the PR is not ready.
4. `Review Verdict`: clean, needs fixes, or blocked by missing context.

Do not let Composer modify files during review.

Do not use Cursor `plan` mode for release-gate review. It can return planning
progress instead of the review verdict. Use the wrapper default (`ask`) unless
the user explicitly asks for an implementation plan.
