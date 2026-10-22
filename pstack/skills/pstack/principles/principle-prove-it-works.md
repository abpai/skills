# Prove it works

Before declaring a task complete:

- Check the actual output, state, or behavior the task required.
- Observe live state directly where it matters; agent self-reports,
  timestamps, summaries, and cached results are not proof of the behavior
  being checked.
- Before relying on a check's result, pass or fail, confirm it can tell
  correct behavior from incorrect, for example by expecting a different
  result from inputs the change should affect.
- Prefer deterministic checks: repeat the same comparison with the same inputs
  and expected result. Use
  [Script Bulk Operations](principle-script-bulk-operations.md) where helpful.
- Run the check and retain its output so another person can inspect and
  repeat the check.
- Keep evidence visible. Commit checks and results when a substantial change
  needs a lasting record for review; avoid adding throwaway checks to the repository.
- State what was verified and what remains unverified; compilation or passing
  tests alone does not prove every requested behavior.

**Example:** Check that the process itself is alive, not merely that its log
was updated recently.

Related: [Explain the Number](principle-explain-the-number.md) checks whether a
measured number means what is being claimed, not merely whether it exists.
