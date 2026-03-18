---
name: visualize
description: >-
  Generate a self-contained HTML visualization to explain a system, plan, code
  flow, or concept. Use when the user asks to visualize, diagram, explain
  visually, or walk through a system, architecture, plan, or code flow. Outputs
  a single HTML file opened in the browser.
license: MIT
metadata:
  author: Andy Pai
  version: "1.0"
  upstream_skill: https://github.com/nicobailon/visual-explainer
---

# Visualize

Generate a single, self-contained HTML file that visually explains a system, plan, code flow, or concept. The output opens in the browser — never fall back to ASCII art when this skill is loaded.

## When to Use

- Visualize a complicated plan or proposal
- Explain key primitives before implementing a plan
- Visual explanation of steps from a third-party repo or blog post
- Understand a module's code flow or execution path

## Workflow

1. **Understand** what the user wants to see — the subject, the audience, the level of detail.
2. **Read `./templates/base.html`** to absorb the tech stack and Threaded style. Read it each time, do not rely on memory.
3. **Pick the format** (see Format Guide below).
4. For Mermaid diagrams with 10+ nodes, also **read `./references/mermaid-tips.md`**.
5. **Adapt** the base template for this specific visualization. Reuse the structure, swap the visual area content.
6. **Write** to `~/.agent/diagrams/<descriptive-name>.html` and open in the browser.

## Format Guide

| Intent | Approach |
|--------|----------|
| Flows, processes, sequences | Mermaid.js in the visual area |
| Architecture, system overview | Mermaid.js or CSS Grid cards |
| Comparisons, data | HTML `<table>` |
| Step-by-step concepts | Walkthrough (base template pattern) |
| Timelines, roadmaps | CSS timeline in the visual area |

## Tech Stack

Every generated file uses:

- **Preact + htm** — ESM CDN imports, no build step
- **Tailwind CSS CDN** — utility classes with inline config
- **Google Fonts** — Merriweather (serif) + Inter (sans)
- **Mermaid.js CDN** — add only when diagrams are needed

No other dependencies. No build step.

For the full Threaded design tokens (colors, typography, motion), see `./references/design-system.md`.

## Principles

- **One primary visual anchor** per request, plus supporting evidence visuals when reviewing a plan or system
- **Visual first** — the main content is a diagram, chart, or table, not prose
- **Adapt the base template** — don't start from scratch
- **Correct over pretty** — the visualization must accurately represent the information
- **Interactive when it helps** comprehension (step-through, hover, collapse)
- **Never use `innerHTML` with user-provided content** (XSS prevention)

## Before Delivering

- **First screen test**: is a meaningful visual visible without scrolling?
- **File opens cleanly**: no console errors, no broken fonts?

## Output

Write to `~/.agent/diagrams/` with a descriptive filename (`auth-flow.html`, `pipeline-overview.html`).

Open in browser:
- macOS: `open ~/.agent/diagrams/filename.html`
- Linux: `xdg-open ~/.agent/diagrams/filename.html`

Tell the user the file path and name the visuals you included.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `visualize` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **visualize** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update visualize` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
