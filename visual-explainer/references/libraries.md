# External Libraries (CDN)

Optional CDN libraries for cases where pure CSS/HTML isn't enough. Only include what the diagram actually needs — most diagrams need zero external JS.

## Mermaid.js — Diagramming Engine

Use for flowcharts, sequence diagrams, ER diagrams, state machines, mind maps, class diagrams, and any diagram where automatic node positioning and edge routing saves effort. Mermaid handles layout — you handle theming.

Do NOT use for dashboards — CSS Grid card layouts with inline SVG sparklines look better for those. Data tables use `<table>` elements.

### Flowchart Default: Excalidraw Pipeline

For `flowchart` / `graph` Mermaid syntax, this skill defaults to Excalidraw conversion and SVG export:

```html
<script type="module">
  import { parseMermaidToExcalidraw } from 'https://esm.sh/@excalidraw/mermaid-to-excalidraw@2.0.0?bundle';
  import { convertToExcalidrawElements, exportToSvg } from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?bundle';

  const { elements, files } = await parseMermaidToExcalidraw(definition, {
    themeVariables: { fontSize: '16px' }
  });
  const excalidrawElements = convertToExcalidrawElements(elements);
  const svg = await exportToSvg({
    elements: excalidrawElements,
    files: files || {},
    appState: { exportBackground: false, viewBackgroundColor: 'transparent' }
  });
</script>
```

Use Mermaid as fallback when:
- the diagram is not a flowchart (for example `sequenceDiagram`, `erDiagram`, `stateDiagram-v2`)
- conversion throws an error
- you need Mermaid-only features unavailable in Excalidraw conversion

Known caveats from Excalidraw docs:
- strongest support is flowcharts
- some Mermaid shapes degrade to rectangles
- unsupported diagram types can fall back to images in Excalidraw contexts

**CDN:**
```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

  mermaid.initialize({ startOnLoad: true, /* ... */ });
</script>
```

**With ELK layout** (required for `layout: 'elk'` — it's a separate package, not bundled in core):
```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  import elkLayouts from 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs';

  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({ startOnLoad: true, layout: 'elk', /* ... */ });
</script>
```

Without the ELK import and registration, `layout: 'elk'` silently falls back to dagre. Only import ELK when you actually need it — it adds significant bundle weight. Most simple diagrams render fine with dagre.

### Deep Theming

Always use `theme: 'base'` — it's the only theme where all `themeVariables` are fully customizable. The built-in themes (`default`, `dark`, `forest`, `neutral`) ignore most variable overrides.

```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    look: 'classic',
    themeVariables: {
      // Background and surfaces
      primaryColor: isDark ? '#27272a' : '#f1f5f9',
      primaryBorderColor: isDark ? '#22d3ee' : '#0891b2',
      primaryTextColor: isDark ? '#fafafa' : '#0f172a',
      secondaryColor: isDark ? '#27272a' : '#f1f5f9',
      secondaryBorderColor: isDark ? '#4ade80' : '#16a34a',
      secondaryTextColor: isDark ? '#fafafa' : '#0f172a',
      tertiaryColor: isDark ? '#27272a' : '#fefce8',
      tertiaryBorderColor: isDark ? '#fbbf24' : '#d97706',
      tertiaryTextColor: isDark ? '#fafafa' : '#0f172a',
      // Lines and edges
      lineColor: isDark ? '#71717a' : '#94a3b8',
      // Text
      // Global default — CSS overrides on .nodeLabel/.edgeLabel win when present
      fontSize: '16px',
      fontFamily: 'var(--font-body)',
      // Notes and labels
      noteBkgColor: isDark ? '#1c2333' : '#fefce8',
      noteTextColor: isDark ? '#e6edf3' : '#1a1a2e',
      noteBorderColor: isDark ? '#fbbf24' : '#d97706',
    }
  });
</script>
```

### Hand-Drawn Mode

Add `look: 'handDrawn'` for a sketchy, whiteboard-style aesthetic. Combines well with the `elk` layout engine for better positioning (requires the ELK import — see CDN section above):

```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  import elkLayouts from 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs';

  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    look: 'handDrawn',
    layout: 'elk',
    themeVariables: { /* same as above */ }
  });
</script>
```

Or set it per-diagram via frontmatter:
```
---
config:
  look: handDrawn
  layout: elk
---
graph TD
  A[User Request] --> B{Auth Check}
  B -->|Valid| C[Process]
  B -->|Invalid| D[Reject]
```

### CSS Overrides on Mermaid SVG

Mermaid renders SVG. Override its classes for pixel-perfect control that `themeVariables` can't reach:

```css
/* Container — see css-patterns.md "Mermaid Zoom Controls" for the full zoom pattern */
.mermaid-wrap {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  overflow: auto;
}

/* CRITICAL: Force node/edge text to follow the page's color scheme.
   Without this, themeVariables.primaryTextColor works for DEFAULT nodes,
   but any classDef that sets color: will hardcode a single value that
   breaks in the opposite color scheme. Fix: never set color: in classDef,
   and always include these CSS overrides. */
.mermaid .nodeLabel { color: var(--text) !important; }
.mermaid .edgeLabel { color: var(--text-dim) !important; background-color: var(--bg) !important; }
.mermaid .edgeLabel rect { fill: var(--bg) !important; }

/* Node shapes */
.mermaid .node rect,
.mermaid .node circle,
.mermaid .node polygon {
  stroke-width: 1.5px;
}

/* Edge paths */
.mermaid .edge-pattern-solid {
  stroke-width: 1.5px;
}

/* Edge labels — smaller than node labels for visual hierarchy */
.mermaid .edgeLabel {
  font-family: var(--font-mono) !important;
  font-size: 13px !important;
}

/* Node labels — 16px default; drop to 14px for complex diagrams (20+ nodes) */
.mermaid .nodeLabel {
  font-family: var(--font-body) !important;
  font-size: 16px !important;
}

/* Sequence diagram actors */
.mermaid .actor {
  stroke-width: 1.5px;
}

/* Sequence diagram messages */
.mermaid .messageText {
  font-family: var(--font-mono) !important;
  font-size: 12px !important;
}

/* ER diagram entities */
.mermaid .er.entityBox {
  stroke-width: 1.5px;
}

/* Mind map nodes */
.mermaid .mindmap-node rect {
  stroke-width: 1.5px;
}
```

### classDef Gotchas

`classDef` values are static text inside `<pre>` — they can't use CSS variables or JS ternaries. Two rules:

1. **Never set `color:` in classDef.** It hardcodes a text color that breaks in the opposite color scheme. Let the CSS overrides above handle text color via `var(--text)`.

2. **Use semi-transparent fills (8-digit hex) for node backgrounds.** They layer over whatever Mermaid's base theme background is, producing a tint that works in both light and dark modes. Use `20`–`44` alpha for subtle, `55`–`77` for prominent:

```
classDef highlight fill:#b5761433,stroke:#b57614,stroke-width:2px
classDef muted fill:#7c6f6411,stroke:#7c6f6444,stroke-width:1px
```

Avoid opaque light fills like `fill:#fefce8` — they render as bright boxes in dark mode.

### stateDiagram-v2 Label Limitations

State diagram transition labels have a strict parser. Avoid:
- `<br/>` — only works in flowcharts; causes a parse error in state diagrams
- Parentheses in labels — `cancel()` can confuse the parser
- Multiple colons — the first `:` is the label delimiter; extra colons in the label text may break parsing

If you need multi-line labels or special characters, use a `flowchart` instead of `stateDiagram-v2`. Flowcharts support quoted labels (`|"label with: special chars"|`) and `<br/>` for line breaks.

### Writing Valid Mermaid

Most Mermaid failures come from a few recurring issues. Follow these rules to avoid invalid diagrams:

**Quote labels with special characters.** Parentheses, colons, commas, brackets, and ampersands break the parser when unquoted. Wrap any label containing special characters in double quotes:

```
A["handleRequest(ctx)"] --> B["DB: query users"]
A[handleRequest] --> B[query users]
```

**Keep IDs simple.** Node IDs should be alphanumeric with no spaces or punctuation. Put the readable name in the label, not the ID:

```
userSvc["User Service"] --> authSvc["Auth Service"]
```

**Max 15 nodes per diagram** (hard ceiling; soft target 10-12). Beyond that, readability collapses even with ELK layout. Use `subgraph` blocks to group related nodes, or split into multiple diagrams. For complex systems with 15+ elements, use the hybrid pattern: a simplified 5-8 node Mermaid overview + CSS Grid detail cards (see `templates/architecture.html`).

```
subgraph Auth
  login --> validate --> token
end
subgraph API
  gateway --> router --> handler
end
Auth --> API
```

**Arrow styles for semantic meaning:**

| Arrow | Meaning | Use for |
|-------|---------|---------|
| `-->` | Solid | Primary flow |
| `-.->` | Dotted | Optional, async, or fallback paths |
| `==>` | Thick | Critical or highlighted path |
| `--x` | Cross | Rejected or blocked |
| `-->\|label\|` | Labeled | Decision branches, data descriptions |

**Layout direction — TD vs LR.** Prefer `flowchart TD` (top-down) for diagrams with 5+ nodes. Vertical flow reads naturally and scales better on narrow viewports. Use `flowchart LR` (left-right) only for simple 3-4 node linear flows where the horizontal reading feels natural (e.g., `Input → Process → Output`).

**Forbidden themeVariables colors.** Do not use these in `themeVariables` — they are Tailwind/AI-product defaults that make every diagram look the same:
- `#8b5cf6`, `#7c3aed`, `#6366f1` (indigo/violet family) — the default "AI purple"
- `#06b6d4`, `#22d3ee` (cyan) — overused in dark-mode AI dashboards
- `#ec4899`, `#f472b6` (magenta/pink) — the other half of the AI gradient cliche

Instead, pick accent colors from the chosen palette in `aesthetic-palettes.md`, or use muted, earthy, or scheme-specific colors (teal, slate-blue, amber, olive).

**Escape pipes in labels.** If a label contains a literal `|`, use `#124;` (HTML entity) or rephrase to avoid it — pipes delimit edge labels in flowcharts.

**Don't mix diagram syntax.** Each diagram type has its own syntax. `-->` works in flowcharts but not in sequence diagrams (`->>` instead). `:::className` works in flowcharts but not in ER diagrams. When in doubt, check the examples below for correct syntax per type.

### Dark Mode Handling

Mermaid initializes once — it can't reactively switch themes. Read the preference at load time inside your `<script type="module">`:

```javascript
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
// Use isDark to pick light or dark values in themeVariables
```

The CSS overrides on the container (`.mermaid-wrap`) and page will still respond to `prefers-color-scheme` normally — only the Mermaid SVG internals are static.

## Google Fonts — Typography

Always load with `display=swap` for fast rendering. Pick a distinctive pairing — body + mono at minimum, optionally a display font for the title.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Define as CSS variables for easy reference:
```css
:root {
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}
```

**Font pairings** (rotate — never use the same pairing twice in a row):

> **Forbidden as generic primary body font:** Roboto, Arial, Helvetica. These are invisible defaults — they signal "no design decision was made." Use them only as system fallbacks in the `font-family` stack. Inter is allowed when intentionally paired (for example, Merriweather + Inter editorial mode).

| Pairing | Mono / Labels | Feel | Notes |
|---|---|---|---|
| **DM Sans + Fira Code** | Fira Code | Clean, modern, distinctive | **Recommended default** — good weight range, ligatures in mono |
| **Instrument Serif + JetBrains Mono** | JetBrains Mono | Refined editorial | Serif with character; good for reviews and reports |
| **IBM Plex Sans + IBM Plex Mono** | IBM Plex Mono | Technical, precise | Matched family; professional feel |
| **Bricolage Grotesque + Fragment Mono** | Fragment Mono | Bold, characterful | Strong headings; pairs with hand-drawn aesthetic |
| **Plus Jakarta Sans + Azeret Mono** | Azeret Mono | Rounded, approachable | Friendly but professional |
| Merriweather + Inter | JetBrains Mono | Classic editorial | Still valid but don't use every time — rotate |
| Outfit + Space Mono | Space Mono | Clean geometric | Modern, techy |
| Sora + IBM Plex Mono | IBM Plex Mono | Technical, precise | Good for architecture diagrams |
| Fraunces + Source Code Pro | Source Code Pro | Warm, distinctive | Works well with gradient mesh palette |
| Crimson Pro + Noto Sans Mono | Noto Sans Mono | Scholarly, serious | Good for documentation |

The top 5 pairings (bolded) are the preferred rotation. Pick one per page and commit. Always pick a heading font with character — if you replaced it with Arial and nobody noticed, you haven't designed anything.

## Prism.js — Syntax Highlighting

For code-heavy pages (reviews, architecture docs with code snippets, before/after panels), Prism.js adds syntax highlighting to `<pre><code>` blocks. For pages with minimal code, styled `<pre><code>` with the editorial palette is sufficient — skip Prism.

**CDN — Core + Autoloader** (autoloader dynamically loads language grammars as needed):
```html
<!-- Prism.js — add only for code-heavy pages -->
<link href="https://cdn.jsdelivr.net/npm/prismjs@1/themes/prism.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/plugins/autoloader/prism-autoloader.min.js"></script>
```

**With line numbers** (optional plugin):
```html
<link href="https://cdn.jsdelivr.net/npm/prismjs@1/plugins/line-numbers/prism-line-numbers.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/plugins/line-numbers/prism-line-numbers.min.js"></script>
```
Add `class="line-numbers"` to the `<pre>` element to enable.

**Diff highlighting** (for before/after panels):
```html
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/plugins/diff-highlight/prism-diff-highlight.min.js"></script>
<link href="https://cdn.jsdelivr.net/npm/prismjs@1/plugins/diff-highlight/prism-diff-highlight.min.css" rel="stylesheet">
```
Use language `diff-javascript`, `diff-css`, etc. Prefix lines with `+` or `-`.

**Themes:**
- Light-first editorial: default `prism.min.css` (clean white background)
- Dark-first: `prism-tomorrow.min.css` or `prism-okaidia.min.css`

**CSS overrides** to match the editorial palette:
```css
/* Override Prism to match page fonts and colors */
code[class*="language-"],
pre[class*="language-"] {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
}

pre[class*="language-"] {
  background: var(--surface-recessed);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
}
```

**Dark mode handling:** Prism themes are static CSS. For pages that need both light and dark mode syntax highlighting, load the light theme by default and override token colors inside `@media (prefers-color-scheme: dark)`:
```css
@media (prefers-color-scheme: dark) {
  code[class*="language-"],
  pre[class*="language-"] { color: #f8f8f2; }
  pre[class*="language-"] { background: var(--surface-recessed); }
  .token.comment { color: var(--text-dim); }
  .token.keyword { color: #c792ea; }
  .token.string { color: #a3e59e; }
  .token.function { color: #82aaff; }
  .token.number { color: #f78c6c; }
}
```
