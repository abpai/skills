---
name: visualize
description: >-
  Generate self-contained HTML visualizations for systems, plans, code flows,
  architectures, comparisons, timelines, and concepts. Use when the user asks
  to visualize, diagram, make a visual explainer, or create an interactive
  walkthrough where the visual artifact is the deliverable.
license: MIT
metadata:
  author: Andy Pai
  version: "1.2.2"
  upstream_skill: https://github.com/nicobailon/visual-explainer
---

# Visualize

Generate a single, self-contained HTML file that visually explains a system, plan, code flow, or concept. The output opens in the browser — never fall back to ASCII art when this skill is loaded.

Default aesthetic: the "HTML effectiveness" editorial gallery style. Use an ivory page, serif display headings, clay accents, quiet card grids, simple SVG illustrations, and generous whitespace. The page should feel like something the user wants to read, not a dashboard skin.

## Workflow

1. **Define the visual job** — subject, audience, detail level, and the primary visual anchor.
2. **Read `./templates/base.html`** to absorb the tech stack and HTML-effectiveness style. Read it each time, do not rely on memory.
3. **Pick the format** from the Format Guide and record the choice before writing.
4. For Mermaid diagrams with 10+ nodes, read `./references/mermaid-tips.md`, include Mermaid.js, and keep the graph definition in a plain constant.
5. **Adapt** the base template for this specific visualization. Reuse the structure, swap the visual area content.
6. **Write** to `~/.agent/diagrams/<descriptive-name>.html` and open in the browser.

The workflow is complete when the file exists, the first screen has a meaningful
visual without scrolling, browser console is clean, and the final response names
the file path plus the visuals included.

## Format Guide

| Intent | Approach |
|--------|----------|
| Flows, processes, sequences | SVG/CSS boxes and arrows first; Mermaid.js when the graph is large |
| Architecture, system overview | SVG/CSS module map or card grid |
| Comparisons, data | HTML `<table>` |
| Step-by-step concepts | Numbered sections and cards |
| Timelines, roadmaps | CSS timeline in the visual area |
| Code review / PR explanation | Annotated diff cards, severity labels, reviewer focus list |
| Prompt/config tuning | Purpose-built editor with copy/export button |

## Tech Stack

Every generated file uses:

- **Preact + htm** — ESM CDN imports, no build step
- **Plain CSS custom properties** — no build step or generated CSS
- **System fonts** — serif display, sans body, mono metadata
- **Mermaid.js CDN** — add only when the selected format requires a large graph

No other dependencies. No build step.

For the full HTML-effectiveness design tokens (colors, typography, layout, motion), see `./references/design-system.md`.

## Principles

- **One primary visual anchor** per request, plus supporting evidence visuals when reviewing a plan or system
- **Visual first** — the main content is a diagram, chart, or table, not prose
- **Adapt the base template** — don't start from scratch
- **Correct over pretty** — the visualization must accurately represent the information
- **Interactive when it helps** comprehension (step-through, hover, collapse)
- **Export when the page edits data** — include copy as JSON/Markdown/prompt when the artifact is a tuner or editor
- **Never use `innerHTML` with user-provided content** (XSS prevention)

## Avoiding Escaped Backticks in Output

The Write tool can corrupt JavaScript template literals, writing literal `\`` and `\${` instead of real backticks and interpolations. This breaks all htm tagged templates. To prevent it:

1. **Extract data into separate `const` variables** above the htm templates. Mermaid chart definition strings, config arrays, long text — declare them as plain constants first, then reference the variable inside `html\`...\``.
2. **Keep htm expressions simple.** Pass variables by reference (`${myVar}`, `${myArray.map(...)}`). Do not build complex multi-line strings or nested template literals inline within an `html\`...\`` block.
3. **Verify after writing.** Re-read the first 30 lines of the `<script type="module">` block in the written file and confirm there are no escaped sequences (`\`` or `\${`). If Chrome DevTools MCP is available, check the browser console for `SyntaxError` after opening the file.

## Before Delivering

- **First screen test**: is a meaningful visual visible without scrolling?
- **File opens cleanly**: no console errors, no broken fonts?
- **Format branch followed**: selected format, extra references, and dependencies match the artifact.

## Output

Write to `~/.agent/diagrams/` with a descriptive filename (`auth-flow.html`, `pipeline-overview.html`).

Open in browser:
- macOS: `open ~/.agent/diagrams/filename.html`
- Linux: `xdg-open ~/.agent/diagrams/filename.html`

Tell the user the file path and name the visuals you included.
