# Verify

Create and carry out a verification plan for the implementation. Report
findings without changing it.

1. Read the original request, such as the task or a pull request's
   description and linked issue, and identify what success requires. If a
   plan is supplied, read it only after that. Then inspect the implementation,
   and any plan, for gaps or deviations.
2. Select relevant principles from [principles.md](principles.md), always
   including [Prove it works](principles/principle-prove-it-works.md), and
   read their files. Review whether the implementation follows them; report
   concrete problems, not preferences.
3. Choose checks that can expose incorrect behavior or principle violations.
   Match their depth to the change and its risks. Run them against the actual
   implementation and retain their output; keep temporary probes outside the
   working tree under review. Run every check that can run here rather than
   deferring it. Call a check unverified only after attempting it and keeping
   the failure, or after stating why it cannot run here. Label any substitute
   check with what it does not cover.

Return a concise report with these sections, saying "none" for an empty one:

- Requirements: what success requires from the original request, noting any
  that a supplied plan omits or contradicts. When the only statement of the
  request is the pull request's own description, say so: it can share the
  implementation's blind spots.
- The checks run, with their commands, and what they establish.
- The principles applied, each with the check or finding it shaped.
- Findings: defects with locations, evidence, and the requirement or
  principle violated. Without a violated requirement or principle, it is a
  note.
- Decisions: consequences the request asks for or implies that someone may
  need to act on, with the options. These are not defects.
- Non-blocking notes, marked as such.
- Anything unverified: the attempt and its result, or why it cannot run, and
  what is needed to check it.

The original request is the source of requirements; a plan may be wrong.
Do not treat missing evidence as success.
