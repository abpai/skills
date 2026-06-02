# Browser E2E Verification

Role: Prove changed UI behavior through real user paths and visible outcomes.
Functional QA and visual QA are related but separate.

## Goal

Show that the changed route/component works in a browser and is visually
shippable, with concrete evidence and explicit residual gaps.

## Use When

Use for routes, components, UI state, browser behavior, frontend assets, forms,
layout, or user-visible copy. Escalate for auth, cross-page journeys, responsive
risk, or visual-regression risk.

## Success Criteria

- Requirements, changed behavior, and final claims each map to a QA check.
- Functional checks use real controls such as click, fill, press, submit, or
  navigation.
- Visual checks cover initial viewport, changed states, mobile/desktop, clipping,
  overflow, contrast, layering, and dynamic stability.
- Console and network are checked.
- Screenshots, traces, or exact blockers are recorded.

## Constraints

- Do not use `page.evaluate`, direct DB writes, or forced client state as signoff
  proof. Label those as diagnostics.
- Do not claim visual success without rendering.
- Do not let setup details bury the actual evidence.

## Quick Pass

1. Build QA inventory from the request, changed behavior, and claims to sign off.
2. For each item, write route/state, user action, expected visible result, and
   evidence before testing.
3. Start or reuse the app with repo-native tooling.
4. Exercise the real path with Browser, Chrome, or Playwright.
5. Check console/network errors.
6. Capture screenshot/trace or record a blocker.
7. Update `verification-timeline.md` and `gate-decisions.md`.

## Deep Escalation

Use persistent Playwright/browser sessions, trace/video, auth test users, failure
injection, input stress, and cross-page journeys when the changed UI is risky or
claims require it.

## Evidence

Record route, viewport, account/browser state, user action, expected result,
actual result, screenshot/trace path, console/network notes, and residual manual
QA.

## Skip Or Stop Rules

Skip non-UI diffs. Mark blocked, not skipped, when the app cannot run, auth is
unavailable, seed data is missing, or a required service is inaccessible.

## Output

Return pass/fail/blocked for each QA item. Include artifacts and residual risk.
