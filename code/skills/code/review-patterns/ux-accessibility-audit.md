# UX And Accessibility Audit

Role: Review changed UI for usability and accessibility blockers. Avoid
taste-only commentary; report user-impacting issues with concrete fixes.

## Goal

Find user-facing flow, comprehension, interaction, responsive, keyboard, and
basic assistive-technology issues before PR handoff.

## Use When

Use when interface copy, layout, interaction, forms, navigation, loading/empty
/error states, disabled states, or accessibility surfaces changed.

## Success Criteria

- Critical and important findings include file:line, user path, impact, and fix.
- Keyboard path, responsive behavior, visible states, and labeling concerns are
  checked or explicitly skipped.
- Findings are prioritized as `Critical`, `Important`, or `Polish`.
- Evidence ties to routes, actions, screenshots, traces, or blockers.

## Constraints

- Do not duplicate Browser E2E. E2E proves the route works; this gate judges
  whether the experience is usable and accessible.
- Do not reduce accessibility to color contrast only.
- Do not report generic heuristic scores without fixable findings.

## Quick Pass

1. Identify changed UI surfaces from the diff and `qa-plan.md`.
2. Exercise the real route/component when practical.
3. Check obviousness, navigation, happy/error paths, cognitive load, and form
   recovery.
4. Check keyboard reachability, focus order, labels, alt text, ARIA where used,
   contrast, and non-color-only meaning.
5. Check loading, empty, error, disabled, and success states.
6. Group findings by severity and record evidence.

## Deep Escalation

Use for launch-quality or high-traffic UI changes. Add mobile/desktop viewport
passes, screen-reader smoke notes when practical, input stress, error injection,
and a prioritized UX/a11y report.

## Evidence

Record route/component, user action, screenshot/trace, keyboard path notes,
responsive viewport, visible states checked, accessibility notes, console/network
notes if relevant, and residual manual QA.

## Skip Or Stop Rules

Skip docs/config/backend-only diffs with no user-facing interface change. If
setup/auth/server is blocked, record the blocker and do a static/component-level
review instead.

## Output

Return prioritized findings and evidence. If clean, state which paths and states
were checked.
