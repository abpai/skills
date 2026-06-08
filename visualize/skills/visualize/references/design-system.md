# HTML Effectiveness Design System

The default visual identity for generated HTML artifacts. Editorial, quiet, warm, and easy to scan. It is inspired by the "unreasonable effectiveness of HTML" gallery style: ivory page, serif headings, clay accent, simple SVG illustration, and card grids with restrained borders.

## Core Feel

- The page should feel like a carefully edited gallery, not a SaaS dashboard.
- Whitespace is the atmosphere. Avoid gradients, glass, heavy shadows, and neon.
- Use one strong visual structure first: cards, map, annotated diff, table, timeline, or editor.
- Prose explains the visual. It should not dominate the first screen.

## Fonts

Use system fonts so the page works offline except for optional diagram libraries.

```css
--serif: ui-serif, Georgia, "Times New Roman", Times, serif;
--sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
```

- Serif: titles, card headings, display text.
- Sans: body copy, labels, controls.
- Mono: section numbers, filenames, counters, small metadata.

## Color Tokens

```css
:root {
  --ivory: #faf9f5;
  --paper: #ffffff;
  --ink: #141413;
  --clay: #d97757;
  --clay-dark: #b85c3e;
  --oat: #e3dacc;
  --olive: #788c5d;
  --mist: #f0eee6;
  --line: #d1cfc5;
  --muted: #87867f;
  --soft: #3d3d3a;
}
```

Use clay sparingly for section numbers, selected paths, risk marks, or primary emphasis. Use olive for secondary success/alternate path marks. Use ink for the one thing that needs maximum contrast.

## Layout

- Page wrapper: `max-width: 1120px`, centered, `32px` side padding.
- Masthead: large serif title plus optional visual figure.
- Sections: numbered index, serif title, small count pill.
- Cards: `border: 1.5px solid var(--line)`, `border-radius: 14px`, white background.
- Thumbnail panels: warm mist background, simple SVG line art, no stock imagery.
- Grids: `repeat(auto-fit, minmax(300px, 1fr))`.

## Card Anatomy

Each card should have:

1. A visual thumbnail or mini diagram.
2. A serif title.
3. A short plain-language description.
4. A mono footer: file name, command, status, or next action.

Cards may link, expand, or reveal details, but the default state should already be useful.

## Artifact Patterns

| Artifact | Layout |
|---|---|
| PR explainer | annotated diff cards plus severity labels and reviewer-focus list |
| Code understanding | module map, hot path, side-effect badges, import skeleton panel |
| Implementation plan | timeline, data-flow diagram, risk table, validation checklist |
| Comparison | option cards side by side with tradeoffs and copyable recommendation |
| Prompt tuner | editable prompt panel, live examples, counters, copy button |
| Report | section nav, evidence cards, charts/tables, concise executive summary |

## Motion

- Optional hover lift: `translateY(-3px)`.
- Transition duration: `120ms` to `180ms`.
- Shadow only on hover, and keep it soft.
- Always respect `prefers-reduced-motion`.

## Constraints

- Do not default to dark mode.
- Do not use large gradient backgrounds.
- Do not use decorative blobs, glass panels, or neon palettes.
- Do not hide the main idea below the fold.
- Do not fill the page with prose before the first visual.
- Never use `innerHTML` with user-provided content. Let Preact escape text or sanitize carefully.
