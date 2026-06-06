# UX And Accessibility Audit

Judge whether changed UI/CLI surfaces are usable and accessible for a first-time user — not taste — and block on user-facing dead ends. Core axiom: **users don't read manuals; if it's not obvious, it's broken.**

## When this gate applies

- Diff touches `.tsx`/`.jsx`/`.vue`/`.svelte`/`.html`/`.css`, templates, or component files — any rendered surface.
- Diff adds/changes a **public CLI/TUI** surface: flags, subcommands, prompts, `stdout`/`stderr` output, exit codes.
- Diff touches copy, layout, forms, navigation, loading/empty/error/disabled states, or anything ARIA/focus/contrast-related.
- Mobile/touch surfaces (touch targets, dynamic type, motion).

## Gotchas

1. **"It's intuitive" is the tell — test with fresh eyes.** Your familiarity is the bug. Walk every changed surface as a first-time user who has never seen the manual. A finding you can't reproduce by actually clicking/tabbing/running it isn't a finding; a "this is obviously fine" without exercising it isn't proof. This fresh-eyes discipline is what separates an audit from a rubber stamp.

2. **Placeholder is NOT a label (Critical, Nielsen #6 Recognition + screen-reader fail).** `<input type="email" placeholder="Email">` with no `<label for>` is a worked-example **Critical** in the source. Placeholder text vanishes on focus (recall, not recognition) and screen readers skip it. Fix: `<label for="email">Email</label><input id="email">`. Recognition-over-recall also fails on icon-only toolbars with no tooltips and "enter the code from your email" context-switches.

3. **Error prevention (#5) failures are blockers, not polish.** Hunt for: free-text where a constraint belongs (`<input>` for a date → user types `13/45/2024`), no validation until submit, a delete button sitting right next to edit, and one-click irreversible actions (`Send to All`). Fix with date pickers, inline/`disabled`-until-valid, confirm-by-typing (`type "DELETE"`), and separation/confirmation of destructive actions.

4. **The Big 4 accessibility check with exact numbers.** Don't reduce a11y to "labels and semantics."
   - **Keyboard:** every interactive element reachable via Tab; focus order logical (left→right, top→bottom); focus indicator **visible** (esp. on dark backgrounds); **no keyboard traps — you can always Tab out**; skip links for repetitive nav. Common fails: dropdown that only opens on hover, modal that won't close on Escape, custom control not focusable.
   - **Contrast (WCAG AA):** **4.5:1** normal text, **3:1** large text (18pt+) and UI components. `#999` on `#fff` = 2.85:1 fails; faint placeholder/disabled states fail.
   - **Not color-only:** error needs **icon AND red border**, required needs **asterisk AND label**, charts need patterns not just hue, links need an underline or other cue. "Green = go, red = stop" alone fails colorblind users.
   - **Screen reader:** images have `alt` (or `alt=""` if decorative); inputs have labels; buttons have accessible names; headings form a logical outline; ARIA correct or absent. Target **WCAG 2.1 AA** (the legal bar; A = floor, AAA = nice-to-have).

5. **Four HTML smells you can grep — find a11y bugs in source even when the app won't run.** This is the fallback path when setup is blocked:
   - `<img>` with no `alt` → add descriptive `alt` (or `alt=""` if decorative).
   - icon `<button>`/`<svg>` button with no `aria-label` → `<button aria-label="Close dialog">`.
   - `<input placeholder=...>` with no `<label>` → add the label (gotcha 2).
   - **`<div onclick="...">` pretending to be a button** → use `<button>`. This is a **double** failure: not keyboard-focusable AND no accessible name. Source flags div-as-button as **Critical**.

6. **CLI/TUI is a first-class audit target — not just web.** Don't skip CLI changes and don't judge them with web criteria. Map Nielsen to the terminal: `Ctrl+C` cancels; `--dry-run` for destructive ops + confirmation before irreversible actions (`--force` to bypass); errors → **stderr**, output → **stdout**; `--help` at **every** subcommand level; "Did you mean…?" on typos; `--no-color`/parseable output (colorblind + screen readers); meaningful **exit codes** (0 = success); **no stack traces to users** (`Error: NoneType has no attribute 'title'` → `error: missing required argument: title` + usage).

7. **Automated a11y catches only ~30%.** A green `axe`/Lighthouse/`pa11y`/WAVE run does **not** mean a11y is done — keyboard flow, screen-reader experience, and cognitive load are **manual**. Run `npx axe <file>` (or Lighthouse) as a cheap first pass, then exercise the surface by hand. Never report "a11y clean" off a tool run alone.

8. **Generic errors and missing feedback are heuristic failures with canonical signatures.** `"Error 500"`, `"Something went wrong"`, `"Invalid input"`, and raw stack traces shown to users violate **#9 (error help)** — replace with plain, specific, actionable text (`"File too large (50MB). Maximum is 10MB."`). **"Form submit with no feedback → user clicks again"** violates **#1 (visibility)** — add a spinner/`aria-busy`/disabled-while-submitting. Trigger every state (loading, empty, error, disabled, success) and tie each failure to its heuristic.

9. **Mobile/touch has hard, testable thresholds.** Touch targets **44pt minimum**; dynamic type / text scaling respected; **reduce-motion respected**; VoiceOver/TalkBack reads it. Without these numbers a "mobile pass" is unfalsifiable.

## Quick pass

1. List changed surfaces from the diff + `changed-files.txt`; classify each web / CLI / mobile / API.
2. Run `generate-checklist.py <type>` for the surface(s) to get the tailored sweep; run `npx axe <file>` on changed `.tsx`/`.jsx`/`.html` as a first pass.
3. Open each real route/command; if it won't run, grep the diff for the four HTML smells (gotcha 5) + CLI gotchas (gotcha 6).
4. Walk happy path, then error path, against **Nielsen's 10**: 1 Visibility · 2 Match real world (no jargon/codes) · 3 Control & freedom (undo, cancel, Escape, back) · 4 Consistency · 5 Error prevention · 6 Recognition-over-recall · 7 Flexibility · 8 Minimalist · 9 Error help · 10 Documentation.
5. Tab through: reachability, focus order, visible focus, no traps, labels/alt/ARIA, color-independent meaning, contrast ratios.
6. Trigger loading / empty / error / disabled / success states.

## Deep pass

For launch-quality / high-traffic / compliance-bound UI: add a full mobile + desktop viewport pass with the 44pt / dynamic-type / reduce-motion checks, screen-reader smoke test (VoiceOver/NVDA), Lighthouse/`pa11y` run, input stress + error injection, and a prioritized UX/a11y report with per-heuristic findings. Run `generate-checklist.py {web|cli|mobile|api}` for each surface and walk it fully.

## Scripts

- [`scripts/generate-checklist.py`](scripts/generate-checklist.py) — emits a surface-tailored UX/a11y checklist to stdout, organized by Nielsen's 10 plus an accessibility block (WCAG 4.5:1, 44pt targets, keyboard, alt text). The `cli`/`mobile`/`api` variants carry criteria a web-only walk drops.
  ```bash
  ./scripts/generate-checklist.py web     # web app
  ./scripts/generate-checklist.py cli     # CLI tool
  ./scripts/generate-checklist.py mobile  # mobile app
  ./scripts/generate-checklist.py api     # API / DX
  ```

## False positives

- **Taste vs. blocker.** Spacing/wording preferences with no usability impact are not findings. Every claim must resolve to a fixable defect tied to a heuristic # or Big-4 item, not "I'd design it differently."
- **Don't duplicate Browser E2E.** E2E proves the route works; this gate judges whether the working route is usable/accessible. A passing route test is not an a11y pass.
- **Green axe ≠ a11y done** (gotcha 7) — do not suppress manual keyboard/screen-reader findings because a tool was clean.
- **Decorative images:** `alt=""` on a purely decorative `<img>` is correct, not a missing-alt finding.
- **`aria-*` already present:** an icon button with a real `aria-label` is fine — don't flag it for "no text."

## Evidence to record

Per finding: route/component, the user action that hits it, severity (`Critical` / `Important` / `Polish`), the Nielsen # or Big-4 item, `file:line`, and a concrete fix. Plus the coverage record: keyboard-path notes, viewports/touch-targets checked, states exercised, axe/Lighthouse output, screenshot or trace path, and any QA punted to a human. When skipped: record why (docs/config/backend-only, or setup/auth blocked → note the blocker and that a static source-level review of the HTML smells + CLI gotchas was done instead). Any `Critical` → the gate is `blocked`; if clean, name the surfaces, heuristics, and states checked.
