# Browser E2E Verification

Role: Prove changed UI behavior through real user paths and rendered output,
catching code that compiles but breaks or renders wrong at runtime.

## Goal

Confirm that each changed route, component, or state renders correctly and
responds to real user input in a browser, with a screenshot or trace as proof
and every untested path named as a residual gap. This gate catches UI that
passes type and unit checks yet throws at runtime, renders broken, or no longer
does what the diff claims. Functional behavior and visual rendering are checked
separately.

## Use When

Diff touches routes, components, UI state, browser behavior, frontend assets,
forms, layout, or user-visible copy. Escalate to Deep when the change involves
auth, multi-page journeys, responsive layout, or visual-regression risk.

## Success Criteria

- Every requirement, changed behavior, and sign-off claim maps to a QA item in
  `qa-plan.md`.
- Functional checks drive real controls (click, fill, press, submit, navigate),
  never simulated state.
- Visual checks cover initial viewport, each changed state, mobile and desktop
  widths, clipping, overflow, contrast, layering, and dynamic stability.
- Console and network are inspected; no new errors or failed requests on the
  tested paths.
- Each item ends with a screenshot path, trace path, or a named blocker.

## Constraints

- `page.evaluate`, direct DB writes, and forced client state are diagnostics
  only; never cite them as sign-off proof.
- Do not claim a visual result without a rendered screenshot.
- Keep setup notes out of the evidence; record outcomes, not scaffolding.

## Quick Pass

1. Build `qa-plan.md` from the request, the diff, and the claims to sign off.
2. For each item, write route/state, user action, expected visible result, and
   intended evidence before testing.
3. Start or reuse the app with repo-native tooling.
4. Drive the real path with Browser, Chrome, or Playwright tools.
5. Inspect console and network for new errors.
6. Capture a screenshot or trace, or record the exact blocker.
7. Log results to `verification-timeline.md` and the verdict to
   `gate-decisions.md`.

## Deep Escalation

When Use When flags risk, run persistent Playwright sessions with trace/video,
auth test users for protected routes, failure injection and input stress for
forms, and full cross-page journeys for multi-step flows. Match the technique to
the risk that triggered escalation.

## Evidence

Per QA item: route, viewport, account/browser state, user action, expected vs.
actual result, screenshot or trace path, console/network notes, and any residual
manual QA. Surface failures and gaps before passes.

## Skip Or Stop Rules

Skip diffs with no UI surface. Mark blocked (not skipped) when the app will not
start, auth is unavailable, seed data is missing, or a required service is
unreachable; name the obstacle.

## Output

Return a `run`, `skip`, `deep`, `override`, or `blocked` decision per the verb
set in `gate-decisions.md`, with a pass/fail per QA item, linked artifacts, and residual
risk. Write the decision to `gate-decisions.md` and feed surviving risk into
`pr-body-draft.md`.
