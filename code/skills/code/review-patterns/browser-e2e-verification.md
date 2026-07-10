# Browser E2E Verification

Drive changed UI through real user paths and prove it renders and behaves correctly at runtime — catching code that compiles and passes unit/type checks yet throws, renders broken, or no longer does what the diff claims.

## When this gate applies

- Diff touches routes, components, UI state, forms, layout, frontend assets, or user-visible copy.
- A diff signal of runtime/render risk: new client state, SSR/hydration surface, responsive layout, theming, or a new public web UI.
- Auth-gated, multi-page, or payment/order flows (escalate to Deep pass).
- Skip only diffs with **no** UI surface.

## Tool choice

Pick by the evidence needed, not by a fixed tool ranking:

- **Default to agent-browser / Browser plugin when available for ordinary local UI signoff.** Use it to drive the actual user path with real controls and bounded observations. It is the cheapest honest proof for "does this path work in a real browser?"
- **Escalate to Chrome DevTools MCP when the question is DevTools-shaped.** Prefer it for network request details (payloads, headers, status, timing), structured console messages, performance traces/insights, Lighthouse, emulation/throttling, heap snapshots, extension surfaces, or browser-internals debugging. It can drive input too when agent-browser is unavailable, but its primary job here is diagnosis and richer evidence.
- **Use repo-native E2E as durable regression proof, not as a last resort.** If the repo already has Playwright/Cypress/Puppeteer, run it and extend it when the change should survive into CI. Interactive proof is a session artifact; checked-in E2E is the regression lock.
- **Use ad-hoc Playwright only when no integrated browser surface or repo-native E2E path exists.** Use ad-hoc Puppeteer only when the repo already standardizes on Puppeteer or the Chrome DevTools MCP/Puppeteer stack is the natural local surface.
- **Keep browser evidence token-bounded.** Prefer semantic/accessibility snapshots and focused assertion summaries over raw DOM dumps. Screenshot only when the question is visual; avoid screenshot loops. Write heavy artifacts (traces, network dumps, videos, heap snapshots, performance profiles) to files and reference paths/URIs instead of inlining payloads.

## Gotchas

1. **The `evaluate()` trap — the most dangerous trap for agent QA.** Driving the UI via `page.evaluate()` / direct DOM manipulation bypasses the actionability checks (visible, stable, enabled, **not-obscured**, receives-events, editable) that Playwright's action methods (`.click()`, `.fill()`, `.check()`, `.press()`, `.selectOption()`) run on every interaction. A button completely hidden behind a modal overlay "works" via `evaluate()` but is **untouchable by a real user**. Rule: if you're reaching for `evaluate()` to trigger an interaction, ask "could a human do this?" — if yes, use the action method. `evaluate()` is for reading state and staging conditions only, **never** as signoff proof.

2. **When `.click()` fails, that IS the bug — do not switch to `evaluate()` to make it pass.** The browser error names the underlying UI defect: an overlay, disabled state, or off-viewport control. Treat the failure as the finding, then inspect the element and blocker with the active browser surface.

3. **Don't build the whole page before looking — the #1 failure mode.** Errors compound, and you can't tell which change caused which problem. Use the **Edit-Reload-Verify micro-loop** with one focused change per cycle: change → reload → bounded DOM/state assertions → screenshot for visual judgment → next. Each verified state becomes the next baseline.

4. **Run programmatic diagnostics FIRST, screenshot SECOND.** Agents don't need to "see" every bug. `domHealthCheck()` (one `page.evaluate()`) returns severity-ranked JSON for 10 mechanical bug classes vision misses: page horizontal scroll (critical), element beyond viewport (major), clipped overflow w/o ellipsis, 0×0 elements with text, sub-44px touch targets, images without dimensions (CLS), missing alt, text-color==bg (major), overlapping interactives >30% area (major), unwanted scroll containers. Fix mechanical issues before spending vision on aesthetics.

5. **Structural vs aesthetic split.** Record a small render intent: what should change and what must not. Compare before/after DOM bounds and computed state for those elements, then use screenshots for visual judgment. Do not dump or diff the entire DOM; normal scrolling/filtering creates noisy false positives.

6. **Peripheral vision check — a local fix commonly breaks a neighbor.** After fixing component A (width change → sibling reflow, margin → sibling shift, z-index → new overlap), also snapshot/screenshot adjacent components and compare to the pre-fix state. Simplest form: full-page before/after screenshots compared by the agent's vision. The layout-snapshot diff (gotcha 5) automates this.

7. **State Matrix Sweep — agents test only `desktop + happy-path + light + logged-in`.** The high-value combinations that catch the most bugs with the fewest tests: `mobile+empty`, `mobile+overflow`, `desktop+empty`, `dark+error`, `tablet+many-items`, and `mobile+dark+logged-out` (**the least-tested combination; often completely broken**). Pair with a breakpoint sweep (320→1920) running `domHealthCheck()` at each width.

8. **Failure injection is a SEPARATE pass, run AFTER the happy path is confirmed.** "Testing error handling on broken code just generates noise." Minimum-viable pass: (1) use the active browser tool to abort the changed API request and check for a blank page; (2) clear storage, reload, and check for a crash. Escalate with 500/503/401/429, empty, malformed, slow, or partial responses only when relevant. Judge graceful degradation per failure: blank page / raw `TypeError` / crash = **critical (fix now)**; error message + retry with data preserved = **acceptable**. Grade A–F.

9. **Double-submit test — frequently-broken duplicate-order bug.** Click submit 5× rapidly with the real control and count mutating (POST/PUT/PATCH) requests. `>1` mutating request = **CRITICAL** duplicate submission. Exactly 1 request but the button is **not disabled after the first click** = warning (will duplicate on slow networks). Fix double-submit specifically for payment/order flows.

10. **Input stress — XSS payloads must be DISPLAYED, not EXECUTED.** Vectors: paste bomb, max-length input, RTL override, zalgo, CJK, null byte, and representative HTML/SQL/template payloads. Check page and parent overflow plus actual DOM execution; an injected node/script is critical.

11. **Console catches invisible bugs that pass all assertions — hydration is the most serious.** Capture console events with the active browser tool. Categorize: **hydration** (CRITICAL — "Text content does not match", SSR/client mismatch from dates/random/`window`) > runtime (`TypeError`/`ReferenceError`) > network (`net::ERR`/CORS) > react warnings > security (CSP). Filter only known-safe existing noise.

12. **Scroll metrics lie — `getBoundingClientRect()`, not document bounds.** Fixed-height shells can clip a required region while page-level scroll metrics look clean. For a fixed-shell interface, having to scroll to reach the primary surface is a failure even if scroll metrics look fine. Screenshots are **primary** evidence for fit; numeric checks support but never overrule.

13. **Pixel-diff misses what matters — the agent IS the vision model.** Pixel diff false-positives on font rendering and 2px moves but **MISSES** truncated text, wrong icon, poor contrast, and broken mobile layout. The agent's built-in vision answers "does this look right?" (zero cost, in-context, no API key) — that's the default. Reserve `toHaveScreenshot()` pixel regression for agent-less CI only.

14. **Stabilize before ANY screenshot comparison, or get false positives.** Use the active browser surface to disable motion when supported, wait for fonts/images/network/`aria-busy`, and capture the same viewport/state. If the surface cannot inject CSS or wait on a condition, record that limit and prefer real-control assertions over a brittle visual diff.

15. **Auth: Google OAuth cannot be automated** (CAPTCHA, headless detection). Bypass via Supabase email/password test users injecting `sb-access-token`/`sb-refresh-token` cookies — same app, different auth method. Use the IANA-reserved **`.test` TLD** so test emails can never reach real inboxes; mark users `is_test_user: true`. Test-user tiers map to coverage: `primary`(pro), `free`(paywall/limits), `premium`(all features), `fresh`(onboarding/empty-states), `admin`(admin panel).

16. **Two pre-signoff questions force a final honest look:** "What visible part have I not yet inspected closely?" and "What visible defect would most likely embarrass this result?" Then require explicit **negative confirmation** of the defect classes checked-and-not-found (e.g. "No clipping, overflow, contrast, or layering issues found"). These are the anti-success-theater devices — functional and visual signoff are independent passes; one does not imply the other.

## Quick pass

1. Build a QA inventory from **three sources**: requested requirements, what you actually built, and the claims you're signing off — every item maps to a check. Add ≥2 off-happy-path scenarios.
2. Start or reuse the app with repo-native tooling; choose the browser surface from [Tool choice](#tool-choice); drive **real controls only** (`.click()`/`.fill()`/`.press()`) for signoff.
3. Per change, run the Edit-Reload-Verify micro-loop: reload → assert intended DOM/state changes and unchanged neighbors → screenshot.
4. Capture console events and failed requests with the active browser tool; check hydration first.
5. Capture bounded evidence per item: assertion summary + screenshot/trace/network artifact path where relevant, or the exact blocker.

## Deep pass

Risk-gated escalation when the gate triggers flag auth, multi-page journeys, responsive/visual-regression risk, or payment/order flows:

- **State Matrix Sweep + breakpoint sweep** (gotcha 7) — run `domHealthCheck` at the high-value combinations and at widths 320→1920; review failing combos first.
- **Failure-injection pass** (gotcha 8) — abort the changed endpoint first, then add relevant response/state corruption modes; grade A–F.
- **Double-submit + input stress** (gotchas 9, 10) on changed forms using real controls and network observation.
- **Auth test users** (gotcha 15) for protected routes; persistent Playwright sessions with trace/video for multi-step flows.
- **DevTools-shaped escalation** (tool choice) — Chrome DevTools MCP for network payload/header/timing inspection, console source detail, Lighthouse, performance traces, emulation/throttling, or heap snapshots. Store heavy output as files and cite paths.
- **Durable regression proof** (tool choice) — extend repo-native E2E when the bug/change should be locked into CI.
- **Stabilize** (gotcha 14) before any before/after comparison.

Use the active browser surface directly. The removed bundled DOM helper assumed a
full Playwright API, failed in the default Browser surface, and produced noisy
false positives for intentionally hidden cards and scroll containers.

## False positives

- **`evaluate()` "pass."** A green result obtained via `page.evaluate()`, forced client state, or a direct DB write is a diagnostic, never proof — never cite it for signoff (gotcha 1). A `.click()` that fails is a finding, not a false positive to route around (gotcha 2).
- **Known-safe console noise.** Suppress only the allowlist (react devtools, fast refresh, ResizeObserver loop, analytics, sentry); do not extend the allowlist to silence a real `hydration`/`runtime` error (gotcha 11).
- **Pixel-diff noise.** Font-rendering and ≤2px-move pixel diffs are not findings; trust agent vision over pixel equality (gotcha 13). Subpixel layout-snapshot moves ≤3px are filtered by threshold.
- **Server-side dedup.** Multiple POSTs that the server deduplicates is still a client warning — the button should prevent the dupe (gotcha 9).
- **"Scroll metrics look clean."** Not a pass when a required region is clipped per `getBoundingClientRect()` (gotcha 12).
- **Unstabilized comparison.** Diffs from animations/fonts/loading are false positives — stabilize first (gotcha 14), don't report them as defects.

## Evidence to record

Per QA item: route, chosen browser surface, viewport, account/browser state, user action, expected-vs-actual, bounded assertion summary, screenshot/trace/network artifact path, console + network notes, and any residual manual QA. Record functional and visual as **independent** passes (one does not imply the other), plus the failure-resilience grade if the Deep pass ran. End with explicit **negative confirmation** of the defect classes checked and not found, and the two pre-signoff answers (gotcha 16). Cite any `evaluate()`, forced state, or DB write strictly as a diagnostic. When skipping: record "no UI surface." When **blocked** (not skipped) — app won't start, auth unavailable, seed data missing, required service unreachable — name the obstacle, the smallest diagnostic attempted, the closest proof reached, and the residual human QA.
