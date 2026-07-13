---
name: visualize
description: >-
  Generate self-contained HTML visualizations that teach systems, plans, code
  flows, architectures, comparisons, timelines, and concepts. Use when the user
  asks to visualize, diagram, make a visual explainer, or create an interactive
  walkthrough where the visual artifact is the deliverable.
license: MIT
metadata:
  author: Andy Pai
  version: "1.3.1"
  upstream_skill: https://github.com/nicobailon/visual-explainer
---

# Visualize

Generate a single, self-contained HTML file that visually explains a system, plan, code flow, or concept. The output opens in the browser — never fall back to ASCII art when this skill is loaded.

Default aesthetic: the "HTML effectiveness" editorial gallery style. Use an ivory page, serif display headings, clay accents, quiet card grids, simple SVG illustrations, and generous whitespace. The page should feel like something the user wants to read, not a dashboard skin.

The success test is not "does it look good" — it is: **a reader with zero prior context can explain the core idea back after the first screen**, and can find every deeper detail without being shown everything at once.

## Why explainers fail (read this before generating)

You know the subject deeply by the time you generate, so the natural failure mode is the *expert's view*: a dense diagram full of terms of art, every section at the same level, all of it visible at once. Experts read that fine. Learners bounce off it.

People learn in the opposite order: plain idea first, then a concrete example, then the mechanism, then the edge cases. The Explainer Arc below forces that inversion. Deviate only when the reader is better served — never because the subject "is technical."

## The Explainer Arc (default structure for teaching pages)

When the artifact's job is to **explain or teach** — a system, plan, proposal, code flow, or concept — structure it as four layers, in order:

1. **The Gist** — the entire first screen. One or two sentences in plain English stating the whole idea and why it matters, plus one anchor visual with **at most 5 elements**. No term of art appears here unless the sentence defines it in the same breath. An analogy is often the strongest anchor ("a CDN is a chain of local warehouses for your website").
2. **The Walkthrough** — the mechanism as a step-through or numbered sequence, **one idea per step** (3–6 steps). Each step pairs a visual with a caption that states the *takeaway*, not a label. The reader should be able to predict step N+1 from step N.
3. **Depth on demand** — exact schemas, edge cases, file paths, configuration, caveats — all real, all present, but **collapsed by default**. A reader who stops before this layer still leaves with a correct mental model; a reader who needs the details finds them without hunting.
4. **The Recap** — 2–4 "what to remember" points, plus a short glossary of every term of art the page introduced.

Why this shape: working memory holds only a few new items at a time. The gist gives the reader a scaffold; each walkthrough step attaches one new idea to it; depth stays out of the way until asked for. A flat page makes the reader build the hierarchy themselves — which is exactly the work the explainer was supposed to do.

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

1. **Name the audience in one line** ("a PM new to OAuth", "a senior eng reviewing this proposal") — infer it from context or ask. Then **write the Gist sentence first, for that audience**. It is the hardest part; if the gist doesn't land, nothing after it will.
2. **Outline the arc** before writing HTML: gist sentence, the 3–6 walkthrough steps (one idea each), what goes behind Depth collapsibles, the recap points and glossary terms. (For working surfaces, define the visual job instead: subject, audience, detail level, primary visual anchor.)
3. **Read `./templates/base.html`** to absorb the tech stack, the HTML-effectiveness style, and the arc components. Read it each time, do not rely on memory.
4. **Pick the format** from the Format Guide and record the choice before writing.
5. For Mermaid diagrams with 10+ nodes, read `./references/mermaid-tips.md`, include Mermaid.js, and keep the graph definition in a plain constant — but first ask whether a 10+ node diagram belongs in the Walkthrough at all (usually it belongs in Depth, or split across steps).
6. **Write** to `~/.agent/diagrams/<descriptive-name>.html` and open in the browser.

The workflow is complete when the file exists, the first screen passes the gist test (see Before Delivering), browser console is clean, and the final response names the file path, the audience, and the visuals included.

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

Every generated file uses:

- **Preact + htm** — ESM CDN imports, no build step
- **Plain CSS custom properties** — no build step or generated CSS
- **System fonts** — serif display, sans body, mono metadata
- **Mermaid.js CDN** — add only when the selected format requires a large graph

No other dependencies. No build step.

For the full HTML-effectiveness design tokens (colors, typography, layout, motion), see `./references/design-system.md`.

## Principles

- **Teach, don't display** — the reader's understanding is the deliverable, the HTML is the medium
- **One primary visual anchor** per request, plus supporting evidence visuals when reviewing a plan or system
- **Adapt the base template** — don't start from scratch; it already implements the arc
- **Correct over pretty** — the visualization must accurately represent the information
- **Interactive when it helps** comprehension (step-through, hover, collapse) — never interaction for its own sake
- **Export when the page edits data** — include copy as JSON/Markdown/prompt when the artifact is a tuner or editor
- **Never use `innerHTML` with user-provided content** (XSS prevention)

## Avoiding Escaped Backticks in Output

The Write tool can corrupt JavaScript template literals, writing literal `\`` and `\${` instead of real backticks and interpolations. This breaks all htm tagged templates. To prevent it:

1. **Extract data into separate `const` variables** above the htm templates. Mermaid chart definition strings, config arrays, long text — declare them as plain constants first, then reference the variable inside `html\`...\``.
2. **Keep htm expressions simple.** Pass variables by reference (`${myVar}`, `${myArray.map(...)}`). Do not build complex multi-line strings or nested template literals inline within an `html\`...\`` block.
3. **Verify after writing.** Re-read the first 30 lines of the `<script type="module">` block in the written file and confirm there are no escaped sequences (`\`` or `\${`). If Chrome DevTools MCP is available, check the browser console for `SyntaxError` after opening the file.

## Avoiding Visible HTML Entity Text

Inside an `htm` tagged template, entity spellings such as `&gt;`, `&lt;`, and
`&amp;` are passed to Preact as ordinary text and escaped again. The rendered page
then shows the spelling itself, such as `-&gt;`, instead of the intended symbol.

- Write non-structural visible symbols directly in `html\`...\`` templates:
  `→`, `←`, `›`, `>`, `&`, and so on. A visible `<` is the exception because
  `htm` treats it as markup; render it through an expression such as `${'<'}`
  (or a named string variable) and let Preact escape it. Use the same expression
  approach for dynamic text.
- Use HTML entities only in browser-parsed markup outside `<script>` blocks.
  JavaScript source — including plain string constants and `htm` templates —
  does not decode them for you.
- Before delivery, inspect the rendered page text for visible entity spellings.
  If the browser console is available, run
  `document.body.innerText.match(/&(?:#\d+|#x[\da-f]+|[a-z][a-z0-9]+);/gi)`;
  any match must be intentional or replaced with safe text that renders the
  character the reader should see.

## Before Delivering

Run these checks against the finished file, in order:

1. **Gist test** — read only the first screen. Can someone with zero context say what this is and why it matters? Is every word on that screen plain English?
2. **Jargon scan** — find each term of art on the page. Is its plain-words meaning established before (or at) its first appearance? Is it in the glossary?
3. **Hierarchy test** — could a reader stop after the Gist and leave with a correct (if shallow) model? Stop after the Walkthrough with a working model? Is Depth collapsed?
4. **Density check** — any visual with more than 7 primary elements? Any text in a visual under 13px?
5. **First screen test** — is the gist + anchor visual visible without scrolling?
6. **File opens cleanly** — no console errors, no broken fonts.
7. **Rendered text is clean** — no accidental visible entity spellings such as `&gt;`, `&lt;`, or `&amp;`.
8. **Format branch followed** — selected format, extra references, and dependencies match the artifact.

## Output

Write to `~/.agent/diagrams/` with a descriptive filename (`auth-flow.html`, `pipeline-overview.html`).

Open in browser:
- macOS: `open ~/.agent/diagrams/filename.html`
- Linux: `xdg-open ~/.agent/diagrams/filename.html`

Tell the user the file path, the audience you wrote it for, and the arc you used (gist → steps → depth → recap).
