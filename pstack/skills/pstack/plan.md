# Plan

Research the task and produce a short implementation plan. Finish at the plan
unless a calling workflow, such as auto, continues past it.

1. Read the original request and relevant repository guidance. Inspect the
   code and tests that explain current behavior. Resolve uncertainties from
   available evidence; distinguish requirements, findings, and assumptions.
2. Identify the structural decisions and prerequisites that will shape the
   task, including state the approach depends on that the code does not keep
   yet. Draft the smallest approach that covers the request, surfacing
   uncertainties before choosing principles.
3. Select from [principles.md](principles.md) only the principles relevant to
   the draft. Read their files and use them to challenge and reshape it.
   Remove unnecessary steps and details best resolved during implementation.

Return only the refined, human-skimmable plan with:

- The intended outcome, in one sentence.
- A few ordered pointers: relevant code locations, constraints, dependencies,
  and what would demonstrate success. Keep implementation details flexible.
- Selected principle names, each linked as `principles/<file>.md` relative to
  this skill, with a short reason.
- Open questions only where missing information materially affects the plan.

Keep it as short as the task allows. Preserve the original request as the
source of requirements; the plan guides implementation rather than replacing it.
