# CSS Patterns for Diagrams

Reusable patterns for layout, connectors, theming, and visual effects in self-contained HTML diagrams.

## Theme Setup

Always define both light and dark palettes via custom properties. Start with whichever fits the chosen aesthetic, ensure both work.

```css
:root {
  --font-heading: 'DM Sans', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'Fira Code', 'SF Mono', Consolas, monospace;

  --bg: #ffffff;
  --bg-secondary: #f8fafc;
  --surface: #ffffff;
  --surface-elevated: #ffffff;
  --surface-recessed: #f1f5f9;

  --border: #e2e8f0;
  --border-bright: #cbd5e1;

  --text: #0f172a;
  --text-secondary: #475569;
  --text-dim: #94a3b8;

  --accent: #0891b2;
  --accent-dim: rgba(8, 145, 178, 0.08);

  --green: #16a34a;  --green-dim: rgba(22, 163, 74, 0.08);
  --red: #dc2626;    --red-dim: rgba(220, 38, 38, 0.08);
  --amber: #d97706;  --amber-dim: rgba(217, 119, 6, 0.08);
  --blue: #2563eb;   --blue-dim: rgba(37, 99, 235, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #09090b;
    --bg-secondary: #18181b;
    --surface: #18181b;
    --surface-elevated: #27272a;
    --surface-recessed: #09090b;

    --border: rgba(255, 255, 255, 0.08);
    --border-bright: rgba(255, 255, 255, 0.14);

    --text: #fafafa;
    --text-secondary: #a1a1aa;
    --text-dim: #71717a;

    --accent: #22d3ee;
    --accent-dim: rgba(34, 211, 238, 0.12);

    --green: #4ade80;  --green-dim: rgba(74, 222, 128, 0.10);
    --red: #f87171;    --red-dim: rgba(248, 113, 113, 0.10);
    --amber: #fbbf24;  --amber-dim: rgba(251, 191, 36, 0.10);
    --blue: #60a5fa;   --blue-dim: rgba(96, 165, 250, 0.10);
  }
}
```

## Background Atmosphere

The editorial default is flat white (#ffffff) — whitespace IS the atmosphere. For dark-first aesthetics or when you want more texture, use subtle gradients or patterns.

```css
/* Radial glow behind focal area */
body {
  background: var(--bg);
  background-image: radial-gradient(ellipse at 50% 0%, var(--accent-dim) 0%, transparent 60%);
}

/* Faint dot grid */
body {
  background-color: var(--bg);
  background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* Diagonal subtle lines */
body {
  background-color: var(--bg);
  background-image: repeating-linear-gradient(
    -45deg, transparent, transparent 40px,
    var(--border) 40px, var(--border) 41px
  );
}

/* Gradient mesh (pick 2-3 positioned radials) */
body {
  background: var(--bg);
  background-image:
    radial-gradient(at 20% 20%, var(--accent-dim) 0%, transparent 50%),
    radial-gradient(at 80% 60%, var(--green-dim) 0%, transparent 50%);
}
```

## Section / Card Components

The fundamental building block. A colored card representing a system component, pipeline step, or data entity. Named `.ve-card` (not `.node`) to avoid collision with Mermaid's internal `.node` class on SVG elements.

```css
.ve-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  position: relative;
}

/* Colored accent border (left or top) */
.ve-card--accent-a {
  border-left: 3px solid var(--accent);
}

/* --- Depth tiers: vary card depth to signal importance --- */

/* Elevated: KPIs, key sections, anything that should pop */
.ve-card--elevated {
  background: var(--surface-elevated);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* Recessed: code blocks, secondary content, detail panels */
.ve-card--recessed {
  background: color-mix(in srgb, var(--bg) 70%, var(--surface) 30%);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
  border-color: var(--border);
}

/* Hero: executive summaries, focal elements — demands attention */
.ve-card--hero {
  background: color-mix(in srgb, var(--surface) 92%, var(--accent) 8%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  border-color: color-mix(in srgb, var(--border) 50%, var(--accent) 50%);
}

/* Section label */
.ve-card__label {
  font-family: var(--font-heading);
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Colored dot indicator */
.ve-card__label::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
```

## Overflow Protection

Grid and flex children default to `min-width: auto`, which prevents them from shrinking below their content width. Long text, inline code badges, and non-wrapping elements will blow out containers.

### Global rules

```css
/* Every grid/flex child must be able to shrink */
.grid > *, .flex > *,
[style*="display: grid"] > *,
[style*="display: flex"] > * {
  min-width: 0;
}

/* Long text wraps instead of overflowing */
body {
  overflow-wrap: break-word;
}
```

### Side-by-side comparison panels

```css
.comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.comparison > * {
  min-width: 0;
  overflow-wrap: break-word;
}

@media (max-width: 768px) {
  .comparison { grid-template-columns: 1fr; }
}
```

### Never use `display: flex` on `<li>` for marker characters

Using `display: flex` on a list item to position a `::before` marker creates an anonymous flex item for the remaining text content. That anonymous flex item gets `min-width: auto` and you **cannot** set `min-width: 0` on anonymous boxes. Lines with many inline `<code>` badges will overflow their container with no CSS fix possible.

Use absolute positioning for markers instead:

```css
/* WRONG — causes overflow with inline code badges */
li {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
li::before {
  content: '›';
  flex-shrink: 0;
}

/* RIGHT — text wraps normally */
li {
  padding-left: 14px;
  position: relative;
}
li::before {
  content: '›';
  position: absolute;
  left: 0;
}
```

## Mermaid Zoom Controls

Mermaid diagrams are often too small to read comfortably, especially complex flowcharts and sequence diagrams. Add zoom controls to every `.mermaid-wrap` container.

### CSS

```css
.mermaid-wrap {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 32px 24px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.mermaid-wrap::-webkit-scrollbar { width: 6px; height: 6px; }
.mermaid-wrap::-webkit-scrollbar-track { background: transparent; }
.mermaid-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.mermaid-wrap::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }

.mermaid-wrap .mermaid {
  transition: transform 0.2s ease;
  transform-origin: top center;
}

.zoom-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
  z-index: 10;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px;
}

.zoom-controls button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.zoom-controls button:hover {
  background: var(--border);
  color: var(--text);
}

.mermaid-wrap.is-zoomed { cursor: grab; }
.mermaid-wrap.is-panning { cursor: grabbing; user-select: none; }

@media (prefers-reduced-motion: reduce) {
  .mermaid-wrap .mermaid { transition: none; }
}
```

### HTML

```html
<div class="mermaid-wrap">
  <div class="zoom-controls">
    <button onclick="zoomDiagram(this, 1.2)" title="Zoom in">+</button>
    <button onclick="zoomDiagram(this, 0.8)" title="Zoom out">&minus;</button>
    <button onclick="resetZoom(this)" title="Reset zoom">&#8634;</button>
  </div>
  <pre class="mermaid">
    graph TD
      A --> B
  </pre>
</div>
```

### JavaScript

Add once at the end of the page. Handles button clicks and scroll-to-zoom on all `.mermaid-wrap` containers:

```javascript
function updateZoomState(wrap) {
  var target = wrap.querySelector('.mermaid');
  var zoom = parseFloat(target.dataset.zoom || '1');
  wrap.classList.toggle('is-zoomed', zoom > 1);
}

function zoomDiagram(btn, factor) {
  var wrap = btn.closest('.mermaid-wrap');
  var target = wrap.querySelector('.mermaid');
  var current = parseFloat(target.dataset.zoom || '1');
  var next = Math.min(Math.max(current * factor, 0.3), 5);
  target.dataset.zoom = next;
  target.style.transform = 'scale(' + next + ')';
  updateZoomState(wrap);
}

function resetZoom(btn) {
  var wrap = btn.closest('.mermaid-wrap');
  var target = wrap.querySelector('.mermaid');
  target.dataset.zoom = '1';
  target.style.transform = 'scale(1)';
  updateZoomState(wrap);
}

document.querySelectorAll('.mermaid-wrap').forEach(function(wrap) {
  // Ctrl/Cmd + scroll to zoom
  wrap.addEventListener('wheel', function(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    var target = wrap.querySelector('.mermaid');
    var current = parseFloat(target.dataset.zoom || '1');
    var factor = e.deltaY < 0 ? 1.1 : 0.9;
    var next = Math.min(Math.max(current * factor, 0.3), 5);
    target.dataset.zoom = next;
    target.style.transform = 'scale(' + next + ')';
    updateZoomState(wrap);
  }, { passive: false });

  // Click-and-drag to pan when zoomed
  var startX, startY, scrollL, scrollT;
  wrap.addEventListener('mousedown', function(e) {
    if (e.target.closest('.zoom-controls')) return;
    var target = wrap.querySelector('.mermaid');
    if (parseFloat(target.dataset.zoom || '1') <= 1) return;
    wrap.classList.add('is-panning');
    startX = e.clientX;
    startY = e.clientY;
    scrollL = wrap.scrollLeft;
    scrollT = wrap.scrollTop;
  });
  window.addEventListener('mousemove', function(e) {
    if (!wrap.classList.contains('is-panning')) return;
    wrap.scrollLeft = scrollL - (e.clientX - startX);
    wrap.scrollTop = scrollT - (e.clientY - startY);
  });
  window.addEventListener('mouseup', function() {
    wrap.classList.remove('is-panning');
  });
});
```

Scroll-to-zoom requires Ctrl/Cmd+scroll to avoid hijacking normal page scroll. Click-and-drag panning activates only when zoomed in (zoom > 1). Cursor changes to `grab`/`grabbing` to signal the behavior. The zoom range is capped at 0.3x–5x.

## Grid Layouts

### Pipeline (horizontal steps)
```css
.pipeline {
  display: flex;
  align-items: stretch;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 8px;
}

.pipeline__step {
  min-width: 130px;
  flex-shrink: 0;
}

.pipeline__arrow {
  display: flex;
  align-items: center;
  padding: 0 4px;
  color: var(--border-bright);
  font-size: 18px;
  flex-shrink: 0;
}

/* Parallel branch within a pipeline */
.pipeline__parallel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

### Card Grid (dashboard / metrics)
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
```

### Data Tables

Use real `<table>` elements for tabular data. Wrap in a scrollable container for wide tables.

```css
/* Scrollable wrapper for wide tables */
.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Base table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.5;
}

/* Header */
.data-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
}

.data-table th {
  background: var(--surface-elevated, var(--surface2, var(--surface)));
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-align: left;
  padding: 12px 16px;
  border-bottom: 2px solid var(--border-bright);
  white-space: nowrap;
}

/* Cells */
.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  color: var(--text);
}

/* Let text-heavy columns wrap naturally */
.data-table .wide {
  min-width: 200px;
  max-width: 500px;
}

/* Right-align numeric columns */
.data-table td.num,
.data-table th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}

/* Alternating rows */
.data-table tbody tr:nth-child(even) {
  background: var(--accent-dim);
}

/* Row hover */
.data-table tbody tr {
  transition: background 0.15s ease;
}

.data-table tbody tr:hover {
  background: var(--border);
}

/* Last row: no bottom border (container handles it) */
.data-table tbody tr:last-child td {
  border-bottom: none;
}

/* Code inside cells */
.data-table code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--accent-dim);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 3px;
}

/* Secondary detail text */
.data-table small {
  display: block;
  color: var(--text-dim);
  font-size: 11px;
  margin-top: 2px;
}
```

#### Status Indicators

Styled spans for match/gap/warning states. Never use emoji.

```css
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.status--match {
  background: var(--green-dim, rgba(5, 150, 105, 0.1));
  color: var(--green, #059669);
}

.status--gap {
  background: var(--red-dim, rgba(239, 68, 68, 0.1));
  color: var(--red, #ef4444);
}

.status--warn {
  background: var(--amber-dim, rgba(217, 119, 6, 0.1));
  color: var(--amber, #d97706);
}

.status--info {
  background: var(--accent-dim);
  color: var(--accent);
}

/* Dot variant (compact, no text) */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot--match { background: var(--green, #059669); }
.status-dot--gap { background: var(--red, #ef4444); }
.status-dot--warn { background: var(--amber, #d97706); }
```

#### Table Summary Row

For totals, counts, or aggregate status at the bottom:

```css
.data-table tfoot td {
  background: var(--surface-elevated, var(--surface2, var(--surface)));
  font-weight: 600;
  font-size: 12px;
  border-top: 2px solid var(--border-bright);
  border-bottom: none;
  padding: 12px 16px;
}
```

#### Sticky First Column (for very wide tables)

```css
.data-table th:first-child,
.data-table td:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--surface);
}

.data-table tbody tr:nth-child(even) td:first-child {
  background: color-mix(in srgb, var(--surface) 95%, var(--accent) 5%);
}
```

## Connectors

### CSS Arrow (vertical, between stacked sections)
```css
.flow-arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 6px 0;
}

/* Down arrow via SVG icon */
.flow-arrow svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--border-bright);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

Down arrow SVG (reuse inline):
```html
<svg viewBox="0 0 20 20"><path d="M10 4 L10 16 M6 12 L10 16 L14 12"/></svg>
```

### CSS Arrow (horizontal, between inline steps)
Use `::after` or a literal arrow character:
```css
.h-arrow::after {
  content: '→';
  color: var(--border-bright);
  font-size: 18px;
  padding: 0 4px;
}
```

## Animations

### Staggered Fade-In on Load

Define the keyframe once, then stagger via a `--i` CSS variable set per element. This approach works regardless of DOM nesting or interleaved non-animated elements (unlike `nth-child` which breaks when siblings aren't all the same type).

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.ve-card {
  animation: fadeUp 0.4s ease-out both;
  animation-delay: calc(var(--i, 0) * 0.05s);
}
```

### Scale-Fade (for KPI cards, badges, status indicators)

```css
@keyframes fadeScale {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.kpi-card {
  animation: fadeScale 0.35s ease-out both;
  animation-delay: calc(var(--i, 0) * 0.06s);
}
```

### SVG Draw-In (for connectors, progress rings, path elements)

```css
@keyframes drawIn {
  from { stroke-dashoffset: var(--path-length); }
  to { stroke-dashoffset: 0; }
}

/* Set --path-length to the path's getTotalLength() value */
.connector path {
  stroke-dasharray: var(--path-length);
  animation: drawIn 0.8s ease-in-out both;
  animation-delay: calc(var(--i, 0) * 0.1s);
}
```

### CSS Counter (for hero numbers without JS)

Uses `@property` to animate a custom property as an integer, then display it via `counter()`. No JS required. Falls back to showing the final value immediately in browsers without `@property` support.

```css
@property --count {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}

@keyframes countUp {
  to { --count: var(--target); }
}

.kpi-card__value--animated {
  --target: 247;
  counter-reset: val var(--count);
  animation: countUp 1.2s ease-out forwards;
}

.kpi-card__value--animated::after {
  content: counter(val);
}
```

### Choreography

Don't use the same animation for everything. Mix types by element role, with easing stagger (fast-then-slow, not linear):

- **Cards**: `fadeUp` — the default entrance, reliable and subtle
- **KPI / badges**: `fadeScale` — scale draws the eye to important numbers
- **SVG connectors**: `drawIn` — reveals flow direction, pairs with card stagger
- **Hero numbers**: `countUp` — counting motion signals "this number matters"
- **Stagger timing**: `calc(var(--i) * 0.06s)` with lower `--i` values on important elements so they appear first

### Respect Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Sparklines and Simple Charts (Pure SVG)

For simple inline visualizations without a library:

```html
<!-- Sparkline -->
<svg viewBox="0 0 100 30" style="width:100px;height:30px;">
  <polyline points="0,25 15,20 30,22 45,10 60,15 75,5 90,12 100,8"
    fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- Progress bar -->
<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
  <div style="height:100%;width:72%;background:var(--accent);border-radius:3px;"></div>
</div>
```

## Responsive Breakpoint

Include a single breakpoint for narrow viewports:

```css
@media (max-width: 768px) {
  .pipeline { flex-wrap: wrap; gap: 8px; }
  .pipeline__arrow { display: none; }
  body { padding: 16px; }
}
```

## Badges and Tags

Small inline labels for categorizing elements:

```css
.tag {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--accent-dim);
  color: var(--accent);
}
```

## Lists Inside Nodes

For tool listings, feature lists, table columns:

```css
.node-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
}

.node-list li {
  padding-left: 14px;
  position: relative;
}

.node-list li::before {
  content: '›';
  color: var(--text-dim);
  font-weight: 600;
  position: absolute;
  left: 0;
}

.node-list code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--accent-dim);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 3px;
}
```

## KPI / Metric Cards

Large hero number with trend indicator and label. For dashboards, review summaries, and impact sections.

```css
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.kpi-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.kpi-card__value {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.kpi-card__label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  margin-top: 6px;
}

.kpi-card__trend {
  font-family: var(--font-mono);
  font-size: 12px;
  margin-top: 4px;
}

.kpi-card__trend--up { color: var(--green, #16a34a); }
.kpi-card__trend--down { color: var(--red, #ef4444); }
```

## Before / After Panels

Two-column comparison with diff-colored headers. For review pages, migration docs, and feature comparisons.

```css
.diff-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.diff-panels > * { min-width: 0; overflow-wrap: break-word; }

.diff-panel__header {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 10px 16px;
}

.diff-panel__header--before {
  background: var(--red-dim, rgba(239, 68, 68, 0.08));
  color: var(--red, #ef4444);
  border-bottom: 2px solid var(--red, #ef4444);
}

.diff-panel__header--after {
  background: var(--green-dim, rgba(5, 150, 105, 0.08));
  color: var(--green, #059669);
  border-bottom: 2px solid var(--green, #059669);
}

.diff-panel__body {
  padding: 16px;
  background: var(--surface);
  font-size: 13px;
  line-height: 1.6;
}

/* Highlight changed items within a panel */
.diff-changed {
  background: var(--accent-dim);
  border-radius: 3px;
  padding: 0 3px;
}

@media (max-width: 768px) {
  .diff-panels { grid-template-columns: 1fr; }
}
```

## Collapsible Sections

Native `<details>/<summary>` with styled disclosure. Zero JS, accessible. For lower-priority content: file maps, decision logs, reference sections.

```css
details.collapsible {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

details.collapsible summary {
  padding: 14px 20px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  transition: background 0.15s ease;
}

details.collapsible summary:hover {
  background: var(--surface-elevated, var(--surface));
}

details.collapsible summary::-webkit-details-marker { display: none; }

/* Chevron indicator */
details.collapsible summary::before {
  content: '▸';
  font-size: 11px;
  color: var(--text-dim);
  transition: transform 0.15s ease;
}

details.collapsible[open] summary::before {
  transform: rotate(90deg);
}

details.collapsible .collapsible__body {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  line-height: 1.6;
}
```

## Generated Images

For AI-generated illustrations embedded as base64 data URIs via `surf gemini --generate-image`. Use sparingly — hero banners, conceptual illustrations, educational diagrams, decorative accents.

### Hero Banner

Full-width image cropped to a fixed height with a gradient fade into the page background. Place at the top of the page before the title, or between the title and the first content section.

```css
.hero-img-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 24px;
}

.hero-img-wrap img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  display: block;
}

/* Gradient fade into page background */
.hero-img-wrap::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(to top, var(--bg), transparent);
  pointer-events: none;
}
```

### Inline Illustration

```css
.illus { text-align: center; margin: 24px 0; }
.illus img { max-width: 480px; width: 100%; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08); }
.illus figcaption { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); margin-top: 8px; }
```

## SVG Export Button

Add a "Download SVG" button alongside zoom controls on any `.mermaid-wrap` container. Lets users extract diagrams for use in slides or docs.

### HTML

Add to the `.zoom-controls` div:
```html
<button onclick="downloadSVG(this)" title="Download SVG" style="width:auto;padding:0 8px;font-size:12px;">&#8681; SVG</button>
```

### CSS

The button inherits zoom control styles. The wider width accommodates the icon + text:
```css
.zoom-controls button[title="Download SVG"] {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
  gap: 2px;
}
```

### JavaScript

```javascript
function downloadSVG(btn) {
  var wrap = btn.closest('.mermaid-wrap');
  var svg = wrap.querySelector('.mermaid svg');
  if (!svg) return;
  var clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  var blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.svg';
  a.click();
  URL.revokeObjectURL(url);
}
```

The clone ensures we don't modify the live SVG. The `xmlns` attribute is required for standalone SVG files. The filename is derived from the page title.

## Link Styling

Never rely on browser default link colors. They vary across browsers and are invisible in dark mode. Always style links explicitly.

```css
a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

a:hover {
  color: var(--text);
}

a:visited {
  color: color-mix(in srgb, var(--accent) 70%, var(--text-dim) 30%);
}
```

## Code Blocks

For review pages and architecture docs with code snippets. Use `white-space: pre-wrap` to prevent horizontal overflow. Add an optional file header for context.

```css
.code-block {
  background: var(--surface-recessed);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.code-block__header {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  padding: 6px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.code-block pre {
  padding: 16px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
  max-height: 400px;
  overflow-y: auto;
}
```

### HTML

```html
<div class="code-block">
  <div class="code-block__header">src/auth/middleware.ts</div>
  <pre><code>export function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'No token' });
  next();
}</code></pre>
</div>
```

## CSS Zoom for Mermaid Scaling

Prefer CSS `zoom` over `transform: scale()` for scaling Mermaid diagrams inside containers. `zoom` actually changes the element's layout size, so the container scrolls correctly. `transform: scale()` only visually scales — the element's layout box stays the same size, causing clipping or excess whitespace.

```css
/* Preferred — layout-aware scaling */
.mermaid-wrap .mermaid {
  zoom: 1.3;
}

/* Fallback for Firefox (doesn't support zoom) */
@supports not (zoom: 1) {
  .mermaid-wrap .mermaid {
    transform: scale(1.3);
    transform-origin: top center;
  }
}
```

Note: The zoom controls JS (see Mermaid Zoom Controls above) still uses `transform: scale()` for interactive zoom because it needs fractional values and smooth transitions. The CSS `zoom` approach is for setting a static base scale.

## Prose Page Elements

For review pages, architecture docs, and other text-heavy pages that need editorial typography.

### Lead Paragraph

```css
.lead {
  font-size: 18px;
  line-height: 1.7;
  color: var(--text-secondary);
  max-width: 640px;
  margin-bottom: 32px;
}
```

### Pull Quote

```css
.pull-quote {
  border-left: 3px solid var(--accent);
  padding: 16px 24px;
  margin: 24px 0;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text);
  font-style: italic;
}

.pull-quote cite {
  display: block;
  font-style: normal;
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 8px;
}
```

### Section Divider

```css
.section-divider {
  border: none;
  height: 1px;
  background: var(--border);
  margin: 40px 0;
}
```

### Callout Box

```css
.callout-box {
  background: var(--accent-dim);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-radius: 8px;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.6;
}

.callout-box--warn {
  background: var(--amber-dim);
  border-color: color-mix(in srgb, var(--amber) 20%, transparent);
}

.callout-box--danger {
  background: var(--red-dim);
  border-color: color-mix(in srgb, var(--red) 20%, transparent);
}
```

## Print Styles

Generated HTML pages should print cleanly via Cmd+P / Ctrl+P. Add this `@media print` block to any page that might be exported as a PDF.

```css
@media print {
  /* Force light theme */
  :root {
    --bg: #fff;
    --bg-secondary: #f8f8f8;
    --surface: #fff;
    --surface-elevated: #fff;
    --surface-recessed: #f5f5f5;
    --border: #ddd;
    --border-bright: #ccc;
    --text: #000;
    --text-secondary: #333;
    --text-dim: #888;
  }

  /* Hide interactive elements */
  .zoom-controls, .toc, .table-filter-wrap { display: none !important; }

  /* Expand all collapsed sections */
  details.collapsible { display: block !important; }
  details.collapsible > * { display: block !important; }

  /* Page break hints */
  .ve-card, .kpi-card, tr { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  section, .mermaid-wrap { break-before: auto; break-inside: avoid; }

  /* Remove animations and shadows */
  * { animation: none !important; transition: none !important; box-shadow: none !important; }

  /* Adjust margins */
  body { padding: 0; font-size: 12px; }
  .container { max-width: 100%; }
}
```
