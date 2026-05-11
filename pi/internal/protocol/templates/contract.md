# Contract: <task id> — <task title>

## Scope

<What this task slice covers. One paragraph. Reference the task JSON.>

## Out of scope

<What the generator must NOT touch in this slice, even if tempted. Keep the
blast radius tight.>

## Files

<Files this task is expected to create or modify. Path per line.>

- <path>
- <path>

## Verification

<The concrete checks the evaluator will run. Match or expand on the task's
`verification[]` field. Each check must be observable — a command, a file
content assertion, or a behavior the evaluator can reproduce.>

1. <check>
2. <check>

## UI verification (if applicable)

<For UI work, name the selected layout direction from
`research/ui-layout-decision.md`, the viewports to screenshot, and the browser
or test harness that will produce visual evidence. Omit this section for
non-UI work.>

## Risks

<What could go wrong in this slice specifically. Call out risks that differ
from the brief-level risks.>

- <risk>

## Codex review scope

<Files / diff paths the codex-reviewer should focus on for this task. Keep
this tight so the review budget is spent where it matters.>
