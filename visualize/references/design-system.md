# Threaded Design System

The visual identity for all generated HTML. Editorial, quiet, literary.

## Fonts

- **Serif** (headings, body content): `Merriweather`, Georgia, serif
- **Sans** (UI labels, controls, meta): `Inter`, system-ui, sans-serif

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
```

## Reading Typography

```css
/* Body prose */
font-family: 'Merriweather', Georgia, serif;
font-size: 1.125rem;   /* 18px */
line-height: 1.8;

/* Headings */
font-family: 'Merriweather', Georgia, serif;
font-weight: 700;
letter-spacing: -0.01em;
```

## Theme

Light is the default. Dark mode is class-based (`darkMode: 'class'` in Tailwind config) with a toggle button. Persist the user's choice to `localStorage`.

```js
// Inline in <head> before Tailwind loads (prevents flash)
(function() {
  var stored = localStorage.getItem('theme');
  if (stored === 'dark') document.documentElement.classList.add('dark');
})();
```

## Color Tokens

Light palette is the primary aesthetic. Dark values use Tailwind `dark:` prefix classes.

| Token | Light | Dark |
|-------|-------|------|
| bg | `#ffffff` (white) | `#020617` (slate-950) |
| surface | `#f8fafc` (slate-50) | `#0f172a` (slate-900) |
| border | `#e2e8f0` (slate-200) | `#1e293b` (slate-800) |
| text | `#0f172a` (slate-900) | `#f1f5f9` (slate-100) |
| text-secondary | `#475569` (slate-600) | `#94a3b8` (slate-400) |
| text-dim | `#94a3b8` (slate-400) | `#475569` (slate-600) |
| accent | `#b45309` (amber-700) | `#f59e0b` (amber-500) |
| accent-light | `#fef3c7` (amber-100) | `#78350f` (amber-900) |

## Layout

- Centered column: `max-w-2xl mx-auto px-6 py-16`
- Visual area: `bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-10`
- Card: `rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm`
- Spacing follows an 8px grid

## Motion

- Duration: 150–300ms
- Easing: `ease` or `cubic-bezier(0.16, 1, 0.3, 1)`
- fadeIn: opacity 0→1 + translateY(4px→0)
- fadeInSoft: opacity 0→1 only
- Respect `prefers-reduced-motion: reduce`

## Constraints

- `rounded-xl` or `rounded-2xl` on cards — no sharp corners
- Restrained shadows: `shadow-sm` only, never `shadow-lg`
- No gradients on backgrounds — whitespace is the atmosphere
- Borders are low-opacity: `border-slate-200` light, `border-slate-800` dark
- Selection color matches accent: `::selection { background: #fef3c7; }`
