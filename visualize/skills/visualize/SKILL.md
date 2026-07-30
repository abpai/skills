---
name: visualize
disable-model-invocation: true
description: >-
  Generate self-contained HTML visualizations that teach systems, plans, code
  flows, architectures, comparisons, timelines, and concepts — for when the
  visual artifact itself is the deliverable.
license: MIT
metadata:
  author: Andy Pai
  version: "1.3.5"
  upstream_skill: https://github.com/nicobailon/visual-explainer
---

# Visualize

Generate a single, self-contained HTML file that visually explains a system, plan, code flow, or concept. The output opens in the browser — never fall back to ASCII art when this skill is loaded.

Default aesthetic: the "HTML effectiveness" editorial gallery style. Use an ivory page, serif display headings, clay accents, quiet card grids, simple SVG illustrations, and generous whitespace. The page should feel like something the user wants to read, not a dashboard skin.

The success test is not "does it look good" — it is: **a reader with zero prior context can explain the core idea back after the first screen**, and can find every deeper detail without being shown everything at once.

## Why explainers fail (read this before generating)

By generation time you know the subject too well, so the default output is the *expert's view* — a dense diagram, every section at the same level, all of it visible at once. The Explainer Arc below forces the opposite order. Deviate only when the reader is better served — never because the subject "is technical."

## The Explainer Arc (default structure for teaching pages)

When the artifact's job is to **explain or teach** — a system, plan, proposal, code flow, or concept — structure it as four layers, in order:

1. **The Gist** — the entire first screen. One or two sentences in plain English stating the whole idea and why it matters, plus one anchor visual with **at most 5 elements**. No term of art appears here unless the sentence defines it in the same breath. An analogy is often the strongest anchor ("a CDN is a chain of local warehouses for your website").
2. **The Walkthrough** — the mechanism as a step-through or numbered sequence, **one idea per step** (3–6 steps). Each step pairs a visual with a caption that states the *takeaway*, not a label. The reader should be able to predict step N+1 from step N.
3. **Depth on demand** — exact schemas, edge cases, file paths, configuration, caveats — all real, all present, but **collapsed by default**. A reader who stops before this layer still leaves with a correct mental model; a reader who needs the details finds them without hunting.
4. **The Recap** — 2–4 "what to remember" points, plus a short glossary of every term of art the page introduced.

**Scope:** working surfaces (prompt/config tuners, editors, review queues, dashboards) are not teaching pages — the arc does not apply to them. The jargon gate and density budget below still do. A lone requested artifact ("just give me a flowchart of X") also skips the arc — but keep the caption-states-takeaway rule.

## Writing rules

- **Jargon gate.** Before any term of art appears, the plain-words version of the idea must already be on the page. Either introduce the term *after* its meaning ("the subagent must end by filing a structured report — this tool is called `submit_subagent_report`") or cut the term entirely. Test each sentence: would a smart intern on their first day parse it?
- **Concrete before abstract.** Show one specific example before the general rule. "When the worker runs out of budget mid-task, v1 returns 'go inspect git yourself'" teaches faster than "v1 lacks structured failure semantics."
- **Captions state takeaways.** Under every visual, write the sentence the reader should walk away with — not a label. Bad: "Subagent flow." Good: "The parent never has to parse prose — the report arrives as checkable fields."
- **One idea per step.** If a walkthrough step needs the word "and" between two new concepts, split it.
- **Signal one thing per visual.** Exactly one element carries the clay accent — the thing the reader must see first. Everything else stays quiet. If everything is highlighted, nothing is.

## Visual density budget

- **≤ 7 primary elements** per visual (boxes, nodes, columns). More than that: split into steps, or push the rest into a Depth section.
- **Text inside visuals ≥ 13px.** Monospace is for code, identifiers, and metadata only — never for body text or captions.
- A first-time reader should know **where to look first within two seconds**. If you can't say which element that is, the visual isn't done.
- Whitespace is doing work; don't fill it.

## Workflow

1. **Name the audience in one line** ("a PM new to OAuth", "a senior eng reviewing this proposal") — infer it from context or ask. Then **write the Gist sentence first, for that audience**.
2. **Outline the arc** before writing HTML: gist sentence, the 3–6 walkthrough steps (one idea each), what goes behind Depth collapsibles, the recap points and glossary terms. (For working surfaces, define the visual job instead: subject, audience, detail level, primary visual anchor.)
3. **Read `./templates/base.html`** to absorb the tech stack, the HTML-effectiveness style, and the arc components. Read it each time, do not rely on memory.
4. **Pick the format** from the Format Guide and record the choice before writing.
5. For Mermaid diagrams with 10+ nodes, read `./references/mermaid-tips.md`, include Mermaid.js, and keep the graph definition in a plain constant — but first ask whether a 10+ node diagram belongs in the Walkthrough at all (usually it belongs in Depth, or split across steps).
6. Before writing the `<script type="module">` block, read `./references/htm-authoring.md` for htm escaping and entity-safety rules.
7. **Write** to `~/.agent/diagrams/<descriptive-name>.html` and open in the browser.

The workflow is complete when the file exists, the first screen passes the success test above, browser console is clean, and the final response names the file path, the audience, and the visuals included.

## Format Guide

| Intent | Approach |
|--------|----------|
| Flows, processes, sequences | SVG/CSS boxes and arrows first; Mermaid.js when the graph is large (usually in Depth) |
| Architecture, system overview | SVG/CSS module map or card grid |
| Comparisons, data | HTML `<table>` — stepwise in the Walkthrough (one aspect at a time), full side-by-side in Depth |
| Step-by-step concepts | Step-through walkthrough (base template pattern) or numbered sections |
| Timelines, roadmaps | CSS timeline in the visual area |
| Code review / PR explanation | Annotated diff cards, severity labels, reviewer focus list |
| Prompt/config tuning | Purpose-built editor with copy/export button |

A dense two-column comparison as the opening visual is the classic expert's-view failure — open with the gist, walk the differences one at a time, keep the full grid in Depth.

## Tech Stack

Every generated file uses Preact + htm via ESM CDN imports, no build step — see `./templates/base.html`. Add Mermaid.js only when the selected format requires a large graph. Never use `innerHTML` with user-provided content (XSS prevention).

For the full HTML-effectiveness design tokens (colors, typography, layout, motion), see `./references/design-system.md`.

## Before Delivering

Confirm the file opens with no console errors or broken fonts, rendered text has no visible entity spellings (`&gt;`, `&lt;`, `&amp;`), and the chosen format's extra references and dependencies match the artifact.
