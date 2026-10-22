# Plan

Research the task and produce a short implementation plan. Finish at the plan
unless a calling workflow, such as auto, continues past it.

1. Read the original request and relevant repository guidance. Inspect the
   code and tests that explain current behavior. Resolve uncertainties from
   available evidence; distinguish requirements, findings, and assumptions.
2. Identify the structural decisions and prerequisites that will shape the
   task, including state the approach depends on that the code does not keep
   yet. Note which decisions the evidence settles and which remain open.
3. For an open decision with no precedent in this codebase, compare two or
   three real options before choosing, following
   [Exhaust the design space](principles/principle-exhaust-the-design-space.md).
   Then write a rough draft of the smallest approach that covers the request
   and every confirmed cause it depends on.
4. Select from [principles.md](principles.md) the principles whose triggers
   match the task, its findings, or the draft. Read their files, use them to
   challenge the draft, and revise it. Remove unnecessary steps.
5. Recheck the revised plan against each selected principle. Keep those that
   changed it or supply a check it relies on, and drop the rest.

Return only the refined, human-skimmable plan with:

- The intended outcome, in one sentence.
- A few ordered pointers: relevant code locations, confirmed findings, the
  decisions taken and why, assumptions, constraints, dependencies, and what
  would demonstrate success, including the checks of selected principles.
  Leave flexible only details that do not change behavior or structure.
- Selected principle names, each linked as `principles/<file>.md` relative to
  this skill, with a short reason.
- Open questions only where missing information materially affects the plan,
  not for decisions the evidence already settles.

Keep it as short as the task allows. Preserve the original request as the
source of requirements; the plan guides implementation rather than replacing it.
