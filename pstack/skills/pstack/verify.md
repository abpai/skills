# Verify

Create and carry out a verification plan for the implementation. Report
findings without changing it.

1. Read the original request and identify what success requires before reading
   the plan. Then inspect the plan and implementation for gaps or deviations.
2. Select and read the relevant [principles](principles.md). Review whether the
   implementation follows them; report concrete problems, not preferences.
3. Choose checks that can expose incorrect behavior or principle violations.
   Match their depth to the change and its risks. Run them against the actual
   implementation and retain the evidence.

Return a concise report with:

- The checks performed and what they establish.
- Actionable findings with locations, evidence, and the requirement or
  principle violated.
- Anything unverified and what is needed to check it.

The original request is the source of requirements; the plan may be wrong.
Do not treat missing evidence as success.
