---
name: visual-explainer
description: Generate beautiful, self-contained HTML pages that visually explain systems, code changes, plans, and data. Use when the user asks for a diagram, architecture overview, diff review, plan review, project recap, comparison table, or any visual explanation of technical concepts. Also use proactively when you are about to render a complex ASCII table (4+ rows or 3+ columns) — present it as a styled HTML page instead.
license: MIT
compatibility: Requires a browser to view generated HTML files. Optional surf-cli for AI image generation.
metadata:
  author: nicobailon
  version: "0.3.0"
---

# Visual Explainer

Generate self-contained HTML files for technical diagrams, visualizations, and data tables. Always open the result in the browser. Never fall back to ASCII art when this skill is loaded.

**Proactive table rendering.** When you're about to present tabular data as an ASCII box-drawing table in the terminal (comparisons, audits, feature matrices, status reports, any structured rows/columns), generate an HTML page instead. The threshold: if the table has 4+ rows or 3+ columns, it belongs in the browser. Don't wait for the user to ask — render it as HTML automatically and tell them the file path. You can still include a brief text summary in the chat, but the table itself should be the HTML page.

## Workflow

### 1. Think (5 seconds, not 5 minutes)

Before writing HTML, commit to a direction. Don't default to "dark theme with blue accents" every time.

**Who is looking?** A developer understanding a system? A PM seeing the big picture? A team reviewing a proposal? This shapes information density and visual complexity.

**What type of diagram?** Architecture, flowchart, sequence, data flow, schema/ER, state machine, mind map, data table, walkthrough, timeline, or dashboard. Each has distinct layout needs and rendering approaches (see Diagram Types below).

**What aesthetic?** Pick one and commit:
- Monochrome terminal (green/amber on black, monospace everything)
- Editorial (serif headlines, generous whitespace, muted palette)
- Blueprint (technical drawing feel, grid lines, precise)
- Neon dashboard (saturated accents on deep dark, glowing edges)
- Paper/ink (warm cream background, hand-drawn feel, sketchy borders)
- Hand-drawn / sketch (Mermaid `handDrawn` mode, wiggly lines, informal whiteboard feel)
- IDE-inspired (borrow a real color scheme: Dracula, Nord, Catppuccin, Solarized, Gruvbox, One Dark)
- Data-dense (small type, tight spacing, maximum information)
- Gradient mesh (bold gradients, glassmorphism, modern SaaS feel)

Vary the choice each time. If the last diagram was dark and technical, make the next one light and editorial. The swap test: if you replaced your styling with a generic dark theme and nobody would notice the difference, you haven't designed anything.

### 2. Structure

**Read the reference template** before generating. Don't memorize it — read it each time to absorb the patterns.
- For flowcharts, sequence diagrams, ER, state machines, mind maps: read `./templates/mermaid-flowchart.html`
- For data tables, comparisons, audits, feature matrices: read `./templates/data-table.html`
- For interactive step-through walkthroughs, tutorials, concept explanations: read `./templates/walkthrough.html`
- For dashboards, KPI summaries, metrics overviews: read `./templates/dashboard.html`
- For timelines, roadmaps, milestone tracking: read `./templates/timeline.html`
- For non-editorial aesthetics, also read `./references/aesthetic-palettes.md` for ready-made palettes.

**For CSS/layout patterns and SVG connectors**, read `./references/css-patterns.md`.

**For pages with 4+ sections** (reviews, recaps, dashboards), also read `./references/responsive-nav.md` for section navigation with sticky sidebar TOC on desktop and horizontal scrollable bar on mobile.

**Choosing a rendering approach:**

| Diagram type | Approach | Why |
|---|---|---|
| Mermaid diagrams (flowchart, sequence, ER, state, mind map, data flow) | **Mermaid** | Automatic node positioning, edge routing, hand-drawn mode |
| Architecture (text-heavy) | CSS Grid cards + flow arrows | Rich card content (descriptions, code, tool lists) needs CSS control |
| Data table | HTML `<table>` | Semantic markup, accessibility, copy-paste behavior |
| Walkthrough / tutorial | Vanilla JS step-through | Progressive disclosure with visual + text per step |
| Timeline | CSS (central line + cards) | Simple linear layout doesn't need a layout engine |
| Dashboard | CSS Grid + inline SVG | Card grid with sparklines and progress bars |

For code-heavy pages (reviews, architecture docs), add Prism.js for syntax highlighting (see `libraries.md`).

**Mermaid theming:** Always use `theme: 'base'` with custom `themeVariables` so colors match your page palette. Use `look: 'handDrawn'` for sketch aesthetic or `look: 'classic'` for clean lines. Use `layout: 'elk'` for complex graphs (requires the `@mermaid-js/layout-elk` package — see `./references/libraries.md` for the CDN import). Override Mermaid's SVG classes with CSS for pixel-perfect control. See `./references/libraries.md` for full theming guide.

**Mermaid zoom controls:** Always add zoom controls (+/−/reset buttons) to every `.mermaid-wrap` container. Complex diagrams render at small sizes and need zoom to be readable. Include Ctrl/Cmd+scroll zoom on the container. See the zoom controls pattern in `./references/css-patterns.md` and the reference template at `./templates/mermaid-flowchart.html`.

**AI-generated illustrations (optional).** If [surf-cli](https://github.com/nicobailon/surf-cli) is available, generate images via `surf gemini "prompt" --generate-image /tmp/ve-img.png --aspect-ratio 16:9`, base64 encode, and embed as data URIs. Check with `which surf`; skip gracefully if unavailable. See `./references/css-patterns.md` for image container styles.

### 3. Style

Apply these principles to every diagram:

**Typography is the diagram.** Merriweather + Inter is the default pairing — Merriweather (serif, 700/900) for headings provides editorial authority, Inter (sans, 400-600) for body text provides clean readability, JetBrains Mono for code and labels. Load via `<link>` in `<head>`. Include a system font fallback in the `font-family` stack for offline resilience. When varying the aesthetic, you may swap fonts, but the heading font should always have character.

**Color tells a story.** Use CSS custom properties for the full palette. Define at minimum: `--bg`, `--surface`, `--border`, `--text`, `--text-dim`, and 3-5 accent colors. Each accent should have a full and a dim variant (for backgrounds). Name variables semantically when possible (`--pipeline-step` not `--blue-3`). Support both themes. Put your primary aesthetic in `:root` and the alternate in the media query:

```css
/* Light-first (editorial, paper/ink, blueprint): */
:root { /* light values */ }
@media (prefers-color-scheme: dark) { :root { /* dark values */ } }

/* Dark-first (neon, IDE-inspired, terminal): */
:root { /* dark values */ }
@media (prefers-color-scheme: light) { :root { /* light values */ } }
```

**Surfaces whisper, they don't shout.** Build depth through subtle lightness shifts (2-4% between levels), not dramatic color changes. Borders should be low-opacity rgba (`rgba(255,255,255,0.08)` in dark mode, `rgba(0,0,0,0.08)` in light) — visible when you look, invisible when you don't.

**Backgrounds create atmosphere.** The editorial default is flat white (`#ffffff`) — whitespace IS the atmosphere. For dark-first aesthetics, use subtle gradients or faint grid patterns. The background should feel intentional, not accidental.

**Visual weight signals importance.** Not every section deserves equal visual treatment. Executive summaries and key metrics should dominate the viewport on load (larger type, more padding, subtle accent-tinted background zone). Reference sections (file maps, dependency lists, decision logs) should be compact and stay out of the way. Use `<details>/<summary>` for sections that are useful but not primary — the collapsible pattern is in `./references/css-patterns.md`.

**Surface depth creates hierarchy.** Vary card depth to signal what matters. Hero sections get elevated shadows and accent-tinted backgrounds (`node--hero` pattern). Body content stays flat (default `.node`). Code blocks and secondary content feel recessed (`node--recessed`). See the depth tiers in `./references/css-patterns.md`. Don't make everything elevated — when everything pops, nothing does.

**Animation earns its place.** Use staggered `fadeUp` for cards, `fadeScale` for KPIs and badges, `countUp` for hero numbers. Always respect `prefers-reduced-motion`. CSS transitions and keyframes handle all cases.

### 4. Deliver

**Output location:** Write to `~/.agent/diagrams/`. Use a descriptive filename based on content: `modem-architecture.html`, `pipeline-flow.html`, `schema-overview.html`. The directory persists across sessions.

**Open in browser:**
- macOS: `open ~/.agent/diagrams/filename.html`
- Linux: `xdg-open ~/.agent/diagrams/filename.html`

**Tell the user** the file path so they can re-open or share it.

## Diagram Types

### Mermaid Diagrams (Flowcharts, Sequences, ER, State Machines, Mind Maps, Data Flow)

**Use Mermaid** for any diagram where automatic node positioning and edge routing matters. This covers flowcharts/pipelines (`graph TD`/`graph LR`), sequence diagrams (`sequenceDiagram`), ER/schema diagrams (`erDiagram`), state machines (`stateDiagram-v2`), mind maps (`mindmap`), and data flow diagrams. Color-code node types with `classDef` or `themeVariables`. Use `look: 'handDrawn'` for sketch aesthetic. See `./templates/mermaid-flowchart.html` for the reference pattern.

**`stateDiagram-v2` label caveat:** Transition labels have a strict parser — colons, parentheses, `<br/>`, HTML entities, and most special characters cause silent parse failures. If your labels need special characters, use `flowchart LR` instead with rounded nodes and quoted edge labels (`|"label text"|`).

### Architecture / System Diagrams

**Topology-focused** (connections matter more than card content): Use Mermaid. **Text-heavy overviews** (card content matters more than connections): CSS Grid with explicit row/column placement. Sections as rounded cards with colored borders. Vertical flow arrows between sections. Use when cards need descriptions, code references, tool lists, or other rich content that Mermaid nodes can't hold.

### Data Tables / Comparisons / Audits
Use a real `<table>` element — not CSS Grid pretending to be a table. Tables get accessibility, copy-paste behavior, and column alignment for free. The reference template at `./templates/data-table.html` demonstrates all patterns.

**Use proactively.** Any time you'd render an ASCII box-drawing table in the terminal, generate an HTML table instead. This includes: requirement audits, feature comparisons, status reports, configuration matrices, test result summaries, dependency lists, permission tables, API endpoint inventories.

### Walkthrough / Tutorial

Interactive step-through for progressive disclosure of concepts, processes, or tutorials. Each step has a visual element and explanatory text. Navigation via prev/next buttons, clickable dots, and keyboard arrows. The reference template at `./templates/walkthrough.html` demonstrates the pattern — vanilla JS, no framework dependencies.

### Timeline / Roadmap Views
Vertical or horizontal timeline with a central line (CSS pseudo-element). Phase markers as circles on the line. Content cards branching left/right. Date labels on the line. Color progression from past (muted) to future (vivid).

### Dashboard / Metrics Overview
Card grid layout. Hero numbers large and prominent. Sparklines via inline SVG `<polyline>`. Progress bars via CSS `linear-gradient`. KPI cards with trend indicators.

## File Structure

Every diagram is a single self-contained `.html` file. No external assets except CDN links (fonts, optional libraries). Structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Descriptive Title</title>
  <link href="https://fonts.googleapis.com/css2?family=...&display=swap" rel="stylesheet">
  <style>
    /* CSS custom properties, theme, layout, components — all inline */
  </style>
</head>
<body>
  <!-- Semantic HTML: sections, headings, lists, tables, inline SVG -->
  <!-- No script needed for static CSS-only diagrams -->
  <!-- Optional: <script> for Mermaid or interactive walkthroughs -->
</body>
</html>
```

## Quality Checks

Before delivering, verify:
- **Both themes**: Toggle your OS between light and dark mode. Both should look intentional, not broken.
- **Information completeness**: Does the diagram actually convey what the user asked for? Pretty but incomplete is a failure.
- **No overflow**: Resize the browser to different widths. No content should clip or escape its container. Every grid and flex child needs `min-width: 0`. Side-by-side panels need `overflow-wrap: break-word`. See the Overflow Protection section in `./references/css-patterns.md`.
- **File opens cleanly**: No console errors, no broken font loads, no layout shifts.
- **Print-friendly**: Cmd+P should produce a clean PDF. See `css-patterns.md` for print styles.

## Constraints

Hard rules — not guidelines. Violating these creates broken or unusable output.

- **Max 20 Mermaid nodes per diagram.** Beyond this, use `subgraph` to group or split into multiple diagrams. (The 15-20 range in libraries.md is the soft target; 20 is the hard ceiling.)
- **Section navigation required for pages with 4+ sections.** Read `responsive-nav.md` and include the TOC. Long pages without navigation are hostile to readers.
- **Pagination or virtual scroll for tables with 50+ rows.** Either paginate (show 25 at a time with prev/next) or truncate with a "Show all" toggle. Large DOM tables are slow and unusable.
- **Never exceed 1000 lines of HTML.** If approaching this, split into multiple pages or collapse secondary sections with `<details>`.
- **Never use `innerHTML` with user-provided content.** Use `textContent` or DOM APIs. This prevents XSS in interactive elements.
- **Maximum 5 KPI cards in a row.** More than 5 gets cramped. Use a second row or collapse less important metrics.
- **Test Mermaid syntax separately.** If the diagram is complex (10+ nodes), validate the Mermaid syntax in isolation before embedding. A broken diagram = a broken page.
