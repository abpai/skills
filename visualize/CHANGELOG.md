# Changelog

## [1.0] - 2026-03-17

### Rewrite as `visualize`

Complete rewrite. The skill is renamed from `visual-explainer` to `visualize` and rebuilt around a single Preact + Tailwind base template with the Threaded design system.

**Breaking changes:**
- Skill renamed from `visual-explainer` to `visualize` — update install paths
- `/review` and `/fact-check` slash commands removed (may return as a separate skill)
- Excalidraw rendering removed — all diagrams use Mermaid.js
- 6 HTML templates and 3 reference docs replaced by 1 template + 2 reference docs

**Added:**
- `templates/base.html` — single Preact + htm + Tailwind reference template with Threaded styling
- `references/design-system.md` — condensed Threaded design tokens (colors, typography, layout, motion)
- `references/mermaid-tips.md` — Mermaid syntax tips and Threaded theming configuration

**Removed:**
- `templates/` — architecture.html, dashboard.html, data-table.html, mermaid-flowchart.html, timeline.html, walkthrough.html
- `references/` — aesthetic-palettes.md, css-patterns.md, libraries.md
- `prompts/` — review.md, fact-check.md
- `banner.png`

## [0.5.2] - 2026-03-08

### Excalidraw Import Fix

- Switched the `@excalidraw/excalidraw` and `@excalidraw/mermaid-to-excalidraw` browser imports in the flowchart reference template to ESM-friendly CDN entries so Excalidraw rendering works in standalone HTML pages.
- Updated `references/libraries.md` to document the same import path for future generated diagrams.
- Regenerated the `skills` repo pre-commit explainer so its execution flow uses the real Excalidraw pipeline.

## [0.5.1] - 2026-03-04

### Execution/Code Flow Routing Clarification

- **`SKILL.md`** now explicitly treats execution flow and code flow requests as flowcharts.
- Added an explicit priority rule: execution flow / code flow / pipeline chain requests should use the Excalidraw flowchart pipeline by default.
- **`prompts/generate-web-diagram.md`** updated so execution/code flow requests are routed to Excalidraw rendering (not Mermaid-only).

## [0.5.0] - 2026-03-04

### Excalidraw Flowchart Rendering

- **`mermaid-flowchart.html`** now uses an Excalidraw-first pipeline for flowcharts:
  - `parseMermaidToExcalidraw()` from `@excalidraw/mermaid-to-excalidraw`
  - `convertToExcalidrawElements()` + `exportToSvg()` from `@excalidraw/excalidraw`
- Added automatic fallback to Mermaid rendering for:
  - non-flowchart diagram types (`sequenceDiagram`, `erDiagram`, `stateDiagram-v2`, etc.)
  - flowchart conversion failures
- Kept zoom, pan, and SVG download controls across both render paths.

### Visual Direction Update

- Updated `mermaid-flowchart.html` styling to a closer Medium-style editorial baseline:
  - Merriweather + Inter pairing
  - slate-forward palette
  - restrained borders and generous reading rhythm

### Documentation Updates

- **`SKILL.md`** now specifies:
  - Excalidraw-first flowchart behavior
  - Mermaid fallback behavior
  - Threaded/Medium-style editorial default when requested
- **`references/libraries.md`** now includes the Excalidraw CDN pipeline and fallback guidance.
- **`README.md`** updated to reflect Excalidraw flowchart output and fallback limitations.

## [0.3.0] - 2026-02-26

### New Templates: 3 → 5

- **Added** `dashboard.html` — KPI dashboard template with coral tint: hero metric cards with countUp animation, sparkline SVG charts, progress bars, status indicators
- **Added** `timeline.html` — timeline/roadmap template with teal tint: vertical central line, alternating left/right cards, phase markers, status color progression (done→active→upcoming), collapses to single column on mobile

### Template Enhancements

- **`data-table.html`** — Added click-to-sort on column headers (asc/desc with ▲/▼ indicator), search/filter input above the table, "Showing X of Y items" row count. Sort uses `localeCompare` for strings, `parseFloat` for numeric columns. Filter matches any cell's `textContent`.
- **`mermaid-flowchart.html`** — Added "Download SVG" button alongside zoom controls. Extracts the Mermaid SVG, clones it with `xmlns` attribute, and triggers a browser download. Filename derived from page title.

### New References

- **Added** `aesthetic-palettes.md` — Complete `:root` variable blocks (light + dark) for all 9 SKILL.md aesthetics: monochrome terminal, editorial, blueprint, neon dashboard, paper/ink, hand-drawn/sketch, IDE-inspired (Dracula, Nord, Catppuccin, Solarized), data-dense, gradient mesh. Includes font pairings and background atmosphere recommendations.

### Reference Enhancements

- **`css-patterns.md`** — Added Print Styles section (`@media print` block: force light theme, hide interactive elements, expand collapsed sections, page break hints, remove animations). Added SVG Export Button pattern (HTML + JS for download button on Mermaid diagrams).
- **`libraries.md`** — Added Prism.js section: CDN links for core + autoloader, line numbers and diff highlighting plugins, light/dark theme options, CSS overrides for editorial palette, dark mode token color overrides.

### New Prompts

- **Added** `gallery.md` — Generates an index page listing all HTML files in `~/.agent/diagrams/` with card grid, search/filter, and sort by date.

### SKILL.md

- Added template references for dashboard and timeline in step 2 (Structure)
- Added aesthetic-palettes.md reference for non-editorial aesthetics
- Added Prism.js note for code-heavy pages in rendering approach table
- Added print-friendly quality check
- Added Constraints section: hard limits on Mermaid nodes (max 20), section navigation (4+ sections), table pagination (50+ rows), HTML line count (max 1000), XSS prevention (`textContent` not `innerHTML`), KPI card limit (max 5 per row), Mermaid syntax validation
- Version bumped to 0.3.0

## [0.2.0] - 2026-02-26

### Editorial Redesign

Unified all templates under a single editorial design system inspired by Medium/Substack: white background, Merriweather serif headings, Inter body text, generous whitespace. Each template retains a subtle tint color for differentiation (indigo for data tables, emerald for Mermaid, violet for walkthroughs).

### Templates: 3 → 3

- **Added** `walkthrough.html` — interactive step-through template (vanilla JS, no Preact/Tailwind)
- **Restyled** `data-table.html` — editorial palette with indigo tint (was rose/cranberry)
- **Restyled** `mermaid-flowchart.html` — editorial palette with emerald tint (was teal/cyan)
- **Removed** `architecture.html` — Mermaid subgraphs handle architecture diagrams

### Prompts: 5 → 4

- **Added** `review.md` — merged diff-review + plan-review with auto-detection (file path → plan review, git ref → diff review)
- **Removed** `diff-review.md` and `plan-review.md` (superseded by `review.md`)

### References: ~36% reduction

- **`css-patterns.md`** — updated to editorial palette, removed `.node--glass`, SVG curved connector, hover lift, architecture 2-column grid, duplicate HTML examples
- **`libraries.md`** — removed Chart.js and anime.js sections, removed duplicate Mermaid diagram examples, updated font pairing table
- **`responsive-nav.md`** — trimmed adaptation notes and verbose comments

### SKILL.md

- Consolidated rendering approach table from 11 to 6 rows
- Added walkthrough diagram type
- Simplified AI image generation guidance
- Updated typography rule (Merriweather + Inter as system default)
- Updated background atmosphere guidance (editorial white as default)
- Removed anime.js, Chart.js, and architecture.html references
- Consolidated quality checks from 7 to 4

## [0.1.1] - 2026-02-19

- Prompts no longer require the `pi-prompt-template-model` extension — each prompt now explicitly loads the skill itself
- Added "Writing Valid Mermaid" section to `libraries.md` (quoting special chars, simple IDs, max node count, arrow styles, pipe escaping)
- Fixed mobile scroll offset in `responsive-nav.md` — section headings now clear the sticky nav bar via `scroll-margin-top`
- Added video preview to README

## [0.1.0] - 2026-02-16

Initial release.

### Skill
- Core workflow: Think (pick aesthetic) → Structure (read template) → Style (apply design) → Deliver (write + open)
- 11 diagram types with rendering approach routing (Mermaid, CSS Grid, HTML tables, Chart.js)
- 9 aesthetic directions (monochrome terminal, editorial, blueprint, neon, paper/ink, sketch, IDE-inspired, data-dense, gradient mesh)
- Mermaid deep theming with `theme: 'base'` + `themeVariables`, hand-drawn mode, ELK layout
- Zoom controls (buttons, scroll-to-zoom, drag-to-pan) required on all Mermaid containers
- Proactive table rendering — agent generates HTML instead of ASCII for complex tables
- Optional AI-generated illustrations via surf-cli + Gemini Nano Banana Pro
- Both light and dark themes via CSS custom properties and `prefers-color-scheme`
- Quality checks: squint test, swap test, overflow protection, zoom controls verification

### References
- `css-patterns.md` — theme setup, depth tiers, node cards, grid layouts, data tables, status badges, KPI cards, before/after panels, connectors, animations (fadeUp, fadeScale, drawIn, countUp), collapsible sections, overflow protection, generated image containers
- `libraries.md` — Mermaid (CDN, ELK, deep theming, hand-drawn mode, CSS overrides, diagram examples), Chart.js, anime.js, Google Fonts with 13 font pairings
- `responsive-nav.md` — sticky sidebar TOC on desktop, horizontal scrollable bar on mobile, scroll spy

### Templates
- `architecture.html` — CSS Grid card layout, terracotta/sage palette, depth tiers, flow arrows, pipeline with parallel branches
- `mermaid-flowchart.html` — Mermaid flowchart with ELK + handDrawn mode, teal/cyan palette, zoom controls
- `data-table.html` — HTML table with KPI cards, status badges, collapsible details, rose/cranberry palette

### Prompt Templates
- `/generate-web-diagram` — generate a diagram for any topic
- `/diff-review` — visual diff review with architecture comparison, KPI dashboard, code review, decision log
- `/plan-review` — plan vs. codebase with current/planned architecture, risk assessment, understanding gaps
- `/project-recap` — project mental model snapshot for context-switching
- `/fact-check` — verify factual accuracy of review pages and plan docs against actual code
