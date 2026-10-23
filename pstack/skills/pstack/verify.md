# Verify

Create and carry out a verification plan for the implementation. Report
findings without changing it.

1. Read the original request, such as the task or a pull request's
   description and linked issue, and identify what success requires. If a
   plan is supplied, read it only after that. Then inspect the implementation,
   and any plan, for gaps or deviations. When the implementation is one commit
   in a series, judge it against what the finished series must do: a piece a
   later commit adds, such as a caller or a doc update, is not a gap in this
   one, but behavior this commit breaks is.
2. Check the premise: does the change address the request's real problem, and
   is all of it needed? Doubt it only on evidence, such as an existing tool
   that already does the job, a need nothing demonstrates, or a stated problem
   that a much smaller change would solve.
3. Select relevant principles from [principles.md](principles.md), always
   including [Prove it works](principles/principle-prove-it-works.md), and
   read their files. Review whether the implementation follows them; report
   concrete problems, not preferences.
4. Choose checks that can expose incorrect behavior or principle violations.
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
- Checks: each command, with one line on what its result establishes.
- The principles applied, each with the check or finding it shaped.
- Findings: defects with locations, evidence, and the requirement or
  principle violated. A defect stays a finding when its fix belongs in
  another file or commit; say where. Without a violated requirement or
  principle, it is a note.
- Premise: the result of the check in one line. When it is in doubt, say
  whether to drop the change or what problem it should solve instead, and
  name the smaller alternative.
- Decisions: choices only the requester can make, each with its options:
  the answer changes what ships, and nothing in the request, repository, or
  evidence settles it. A recommendation to keep something as it is is not a
  decision.
- Non-blocking notes: wording and commit-message fixes, follow-ups outside
  the request, and, for a commit in a series, a single note listing the gaps
  that close when later commits land.
- Anything unverified: the attempt and its result, or why it cannot run, and
  what is needed to check it.

The original request is the source of requirements; a plan may be wrong.
Do not treat missing evidence as success.
