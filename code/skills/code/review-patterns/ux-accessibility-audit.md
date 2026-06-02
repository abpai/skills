# UX And Accessibility Audit

Role: Review changed UI for usability and accessibility blockers. Report
user-impacting issues with concrete fixes, not taste preferences.

## Goal

Catch UI that passes its route test but is unusable or inaccessible for real
users: unreachable controls, unlabeled inputs, missing focus, broken keyboard
paths, dead-end error states, and layout that collapses on small viewports.
Done means every changed surface has been exercised and each blocker carries a
file:line, the user path that hits it, and a specific fix.

## Use When

Changed copy, layout, interaction, forms, navigation, loading/empty/error
states, disabled states, or any accessibility surface.

## Success Criteria

- Every finding has file:line, the user path that triggers it, impact, and a fix.
- Keyboard reachability, responsive behavior, visible states, and labeling are
  each checked or explicitly marked skipped with a reason.
- Findings carry severity `Critical`, `Important`, or `Polish`; any `Critical`
  blocks the gate.
- Each finding ties to a route, action, screenshot, or trace.

## Constraints

- Do not duplicate Browser E2E. E2E proves the route works; this gate judges
  whether the experience is usable and accessible.
- Cover keyboard, focus, labels, and semantics, not color contrast alone.
- No generic heuristic scores. Every claim resolves to a fixable finding.

## Quick Pass

1. List changed UI surfaces from the diff and `qa-plan.md`.
2. Open each real route or component; fall back to source review if it will not
   run.
3. Walk the happy path, then the error path, watching for unclear copy, hidden
   navigation, and unrecoverable form states.
4. Tab through with the keyboard: confirm reachability, focus order, visible
   focus, labels, alt text, ARIA where used, and meaning that survives without
   color.
5. Trigger loading, empty, error, disabled, and success states.
6. Record each issue with severity and evidence.

## Deep Escalation

For launch-quality or high-traffic UI, add mobile and desktop viewport passes,
screen-reader smoke notes where practical, input stress, error injection, and a
prioritized UX/a11y report.

## Evidence

Per finding: route/component, user action, severity, file:line, fix. Plus the
coverage record: keyboard path notes, viewports checked, visible states
exercised, accessibility notes, relevant console/network output, screenshot or
trace path, and any QA left for a human.

## Skip Or Stop Rules

Skip docs/config/backend-only diffs with no user-facing change. If
setup/auth/server is blocked, record the blocker and do a static
component-level review instead.

## Output

Write prioritized findings and evidence to `gate-decisions.md` with a `run`,
`skip`, `deep`, `override`, or `blocked` decision per the verb set in `gate-decisions.md`.
A `Critical` finding means `blocked`. If clean, name the paths and states
checked.
