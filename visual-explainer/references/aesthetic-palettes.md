# Aesthetic Palettes

Ready-made `:root` variable blocks for each of the 9 aesthetics in SKILL.md. Each palette includes light + dark versions, a recommended font pairing, and usage guidance.

## 1. Monochrome Terminal

Green-on-black hacker terminal. Use for developer tool output, CLI visualizations, or retro-tech aesthetics.

**Font pairing:** JetBrains Mono for everything (heading, body, labels).

```css
/* Dark-first — terminal aesthetic is inherently dark */
:root {
  --font-heading: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  --font-body: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;

  --bg: #0a0a0a;
  --bg-secondary: #111111;
  --surface: #141414;
  --surface-elevated: #1a1a1a;
  --surface-recessed: #080808;

  --border: rgba(0, 255, 65, 0.12);
  --border-bright: rgba(0, 255, 65, 0.25);

  --text: #00ff41;
  --text-secondary: #00cc33;
  --text-dim: #008f24;

  --accent: #00ff41;
  --accent-dim: rgba(0, 255, 65, 0.08);

  --tint: #00ff41;
  --tint-dim: rgba(0, 255, 65, 0.06);

  --green: #00ff41;  --green-dim: rgba(0, 255, 65, 0.10);
  --red: #ff3333;    --red-dim: rgba(255, 51, 51, 0.10);
  --amber: #ffb000;  --amber-dim: rgba(255, 176, 0, 0.10);
  --blue: #00bfff;   --blue-dim: rgba(0, 191, 255, 0.10);
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f0f0f0;
    --bg-secondary: #e8e8e8;
    --surface: #f5f5f5;
    --surface-elevated: #ffffff;
    --surface-recessed: #e0e0e0;

    --border: rgba(0, 100, 25, 0.15);
    --border-bright: rgba(0, 100, 25, 0.30);

    --text: #0a3d0a;
    --text-secondary: #1a5c1a;
    --text-dim: #6b8f6b;

    --accent: #16a34a;
    --accent-dim: rgba(22, 163, 74, 0.08);

    --tint: #16a34a;
    --tint-dim: rgba(22, 163, 74, 0.06);

    --green: #16a34a;  --green-dim: rgba(22, 163, 74, 0.08);
    --red: #dc2626;    --red-dim: rgba(220, 38, 38, 0.08);
    --amber: #b45309;  --amber-dim: rgba(180, 83, 9, 0.08);
    --blue: #2563eb;   --blue-dim: rgba(37, 99, 235, 0.08);
  }
}
```

**Amber variant:** Replace all `#00ff41` greens with `#ffb000` amber for a warmer retro feel.

**Background atmosphere:** Faint dot grid or scanline overlay works well:
```css
body {
  background-image: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(0, 255, 65, 0.03) 2px, rgba(0, 255, 65, 0.03) 4px
  );
}
```

---

## 2. Editorial

The system default. White background, serif headings, generous whitespace. See existing templates (`data-table.html`, `mermaid-flowchart.html`, `walkthrough.html`) for complete implementations.

**Font pairing:** Merriweather (heading, 700/900) + Inter (body, 400-600) + JetBrains Mono (code).

Palette is defined in all existing templates and `css-patterns.md`. No need to duplicate here — use those as the source of truth.

---

## 3. Blueprint

Technical drawing on dark navy. Use for architecture diagrams, infrastructure layouts, and engineering schematics.

**Font pairing:** Sora (heading) + IBM Plex Mono (body + labels). The mono body text reinforces the technical precision feel.

```css
/* Dark-first — blueprint is inherently dark */
:root {
  --font-heading: 'Sora', system-ui, sans-serif;
  --font-body: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
  --font-mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;

  --bg: #0a1628;
  --bg-secondary: #0f1d32;
  --surface: #132240;
  --surface-elevated: #1a2d52;
  --surface-recessed: #081220;

  --border: rgba(100, 180, 255, 0.12);
  --border-bright: rgba(100, 180, 255, 0.25);

  --text: #c8ddf5;
  --text-secondary: #8baac8;
  --text-dim: #5a7a9b;

  --accent: #60a5fa;
  --accent-dim: rgba(96, 165, 250, 0.10);

  --tint: #38bdf8;
  --tint-dim: rgba(56, 189, 248, 0.08);

  --green: #4ade80;  --green-dim: rgba(74, 222, 128, 0.10);
  --red: #f87171;    --red-dim: rgba(248, 113, 113, 0.10);
  --amber: #fbbf24;  --amber-dim: rgba(251, 191, 36, 0.10);
  --blue: #60a5fa;   --blue-dim: rgba(96, 165, 250, 0.10);
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f0f5ff;
    --bg-secondary: #e5edfa;
    --surface: #f5f8ff;
    --surface-elevated: #ffffff;
    --surface-recessed: #dce5f5;

    --border: rgba(30, 64, 120, 0.12);
    --border-bright: rgba(30, 64, 120, 0.25);

    --text: #0f2550;
    --text-secondary: #3b5580;
    --text-dim: #7a90aa;

    --accent: #2563eb;
    --accent-dim: rgba(37, 99, 235, 0.08);

    --tint: #0284c7;
    --tint-dim: rgba(2, 132, 199, 0.06);

    --green: #16a34a;  --green-dim: rgba(22, 163, 74, 0.08);
    --red: #dc2626;    --red-dim: rgba(220, 38, 38, 0.08);
    --amber: #d97706;  --amber-dim: rgba(217, 119, 6, 0.08);
    --blue: #2563eb;   --blue-dim: rgba(37, 99, 235, 0.08);
  }
}
```

**Background atmosphere:** Grid pattern reinforces the blueprint feel:
```css
body {
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

---

## 4. Neon Dashboard

Saturated accents on deep dark. Use for monitoring dashboards, real-time data, and high-energy presentations.

**Font pairing:** Outfit (heading, 500-700) + Space Mono (body + labels).

```css
/* Dark-first — neon requires dark background */
:root {
  --font-heading: 'Outfit', system-ui, sans-serif;
  --font-body: 'Outfit', system-ui, sans-serif;
  --font-mono: 'Space Mono', 'SF Mono', Consolas, monospace;

  --bg: #0a0a1a;
  --bg-secondary: #10102a;
  --surface: #141430;
  --surface-elevated: #1a1a3a;
  --surface-recessed: #080818;

  --border: rgba(120, 80, 255, 0.15);
  --border-bright: rgba(120, 80, 255, 0.30);

  --text: #f0f0ff;
  --text-secondary: #b0b0d0;
  --text-dim: #6a6a90;

  --accent: #00f0ff;
  --accent-dim: rgba(0, 240, 255, 0.10);

  --tint: #c850ff;
  --tint-dim: rgba(200, 80, 255, 0.10);

  --green: #00ff88;  --green-dim: rgba(0, 255, 136, 0.10);
  --red: #ff4088;    --red-dim: rgba(255, 64, 136, 0.10);
  --amber: #ffcc00;  --amber-dim: rgba(255, 204, 0, 0.10);
  --blue: #00f0ff;   --blue-dim: rgba(0, 240, 255, 0.10);
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #fafafe;
    --bg-secondary: #f0f0f8;
    --surface: #ffffff;
    --surface-elevated: #ffffff;
    --surface-recessed: #e8e8f5;

    --border: rgba(80, 40, 180, 0.10);
    --border-bright: rgba(80, 40, 180, 0.20);

    --text: #1a1a3a;
    --text-secondary: #4a4a6a;
    --text-dim: #8a8aa0;

    --accent: #0891b2;
    --accent-dim: rgba(8, 145, 178, 0.08);

    --tint: #7c3aed;
    --tint-dim: rgba(124, 58, 237, 0.08);

    --green: #16a34a;  --green-dim: rgba(22, 163, 74, 0.08);
    --red: #dc2626;    --red-dim: rgba(220, 38, 38, 0.08);
    --amber: #d97706;  --amber-dim: rgba(217, 119, 6, 0.08);
    --blue: #2563eb;   --blue-dim: rgba(37, 99, 235, 0.08);
  }
}
```

**Background atmosphere:** Gradient mesh with glowing focal points:
```css
body {
  background-image:
    radial-gradient(at 20% 30%, rgba(0, 240, 255, 0.08) 0%, transparent 50%),
    radial-gradient(at 80% 60%, rgba(200, 80, 255, 0.06) 0%, transparent 50%);
}
```

**Glow border pattern** for cards:
```css
.node { border-color: rgba(0, 240, 255, 0.2); box-shadow: 0 0 20px rgba(0, 240, 255, 0.05); }
```

---

## 5. Paper / Ink

Warm cream background with dark ink text. Use for documentation, reports, proposals, and anything that should feel printed.

**Font pairing:** Crimson Pro (heading, 600-800) + Noto Sans Mono (labels) + Inter (body).

```css
/* Light-first — paper aesthetic is inherently light */
:root {
  --font-heading: 'Crimson Pro', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'Noto Sans Mono', 'SF Mono', Consolas, monospace;

  --bg: #faf8f5;
  --bg-secondary: #f5f0ea;
  --surface: #ffffff;
  --surface-elevated: #ffffff;
  --surface-recessed: #f0ece5;

  --border: #e0d8cc;
  --border-bright: #c8bfb0;

  --text: #2a2520;
  --text-secondary: #5c5650;
  --text-dim: #9a918a;

  --accent: #8b5c2a;
  --accent-dim: rgba(139, 92, 42, 0.08);

  --tint: #8b5c2a;
  --tint-dim: rgba(139, 92, 42, 0.06);

  --green: #3d7a40;  --green-dim: rgba(61, 122, 64, 0.08);
  --red: #a83232;    --red-dim: rgba(168, 50, 50, 0.08);
  --amber: #8b6c2a;  --amber-dim: rgba(139, 108, 42, 0.08);
  --blue: #3d5a8b;   --blue-dim: rgba(61, 90, 139, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1814;
    --bg-secondary: #22201a;
    --surface: #2a2620;
    --surface-elevated: #33302a;
    --surface-recessed: #141210;

    --border: rgba(255, 240, 220, 0.10);
    --border-bright: rgba(255, 240, 220, 0.18);

    --text: #e8e0d8;
    --text-secondary: #b0a898;
    --text-dim: #7a7068;

    --accent: #d4a050;
    --accent-dim: rgba(212, 160, 80, 0.10);

    --tint: #d4a050;
    --tint-dim: rgba(212, 160, 80, 0.08);

    --green: #6bba6e;  --green-dim: rgba(107, 186, 110, 0.10);
    --red: #e07070;    --red-dim: rgba(224, 112, 112, 0.10);
    --amber: #d4a050;  --amber-dim: rgba(212, 160, 80, 0.10);
    --blue: #7090c0;   --blue-dim: rgba(112, 144, 192, 0.10);
  }
}
```

**Background atmosphere:** Flat cream — whitespace IS the atmosphere, same as editorial. No patterns needed.

---

## 6. Hand-drawn / Sketch

Soft, informal, whiteboard feel. Pairs with Mermaid `look: 'handDrawn'`. Use for brainstorming, ideation, informal explanations.

**Font pairing:** Bricolage Grotesque (heading, 600-800) + Fragment Mono (labels) + Inter (body).

```css
/* Light-first — sketch aesthetic works best on light backgrounds */
:root {
  --font-heading: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'Fragment Mono', 'SF Mono', Consolas, monospace;

  --bg: #fefdfb;
  --bg-secondary: #f8f6f2;
  --surface: #ffffff;
  --surface-elevated: #ffffff;
  --surface-recessed: #f2f0ec;

  --border: #ddd8d0;
  --border-bright: #c5bfb5;

  --text: #33302a;
  --text-secondary: #666058;
  --text-dim: #99928a;

  --accent: #e07040;
  --accent-dim: rgba(224, 112, 64, 0.08);

  --tint: #e07040;
  --tint-dim: rgba(224, 112, 64, 0.06);

  --green: #55a060;  --green-dim: rgba(85, 160, 96, 0.08);
  --red: #d05050;    --red-dim: rgba(208, 80, 80, 0.08);
  --amber: #c08830;  --amber-dim: rgba(192, 136, 48, 0.08);
  --blue: #5080c0;   --blue-dim: rgba(80, 128, 192, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1918;
    --bg-secondary: #222120;
    --surface: #2a2928;
    --surface-elevated: #333230;
    --surface-recessed: #141312;

    --border: rgba(255, 250, 240, 0.10);
    --border-bright: rgba(255, 250, 240, 0.18);

    --text: #e8e4e0;
    --text-secondary: #a8a4a0;
    --text-dim: #787470;

    --accent: #f09060;
    --accent-dim: rgba(240, 144, 96, 0.10);

    --tint: #f09060;
    --tint-dim: rgba(240, 144, 96, 0.08);

    --green: #70c080;  --green-dim: rgba(112, 192, 128, 0.10);
    --red: #e07070;    --red-dim: rgba(224, 112, 112, 0.10);
    --amber: #d0a050;  --amber-dim: rgba(208, 160, 80, 0.10);
    --blue: #70a0e0;   --blue-dim: rgba(112, 160, 224, 0.10);
  }
}
```

**Mermaid config:** Always use `look: 'handDrawn'` with this palette.

**Background atmosphere:** Faint dot grid to suggest graph paper:
```css
body {
  background-image: radial-gradient(circle, var(--border) 0.5px, transparent 0.5px);
  background-size: 20px 20px;
}
```

---

## 7. IDE-inspired

Borrow a real editor color scheme. Four popular options below — pick one and commit.

**Font pairing:** Plus Jakarta Sans (heading, 600-700) + Azeret Mono (code/labels) + Inter (body). Or go full monospace for a pure IDE feel.

### Dracula

```css
:root {
  --font-heading: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'Azeret Mono', 'SF Mono', Consolas, monospace;

  --bg: #282a36;
  --bg-secondary: #21222c;
  --surface: #2d2f3d;
  --surface-elevated: #343746;
  --surface-recessed: #1e1f29;

  --border: rgba(248, 248, 242, 0.08);
  --border-bright: rgba(248, 248, 242, 0.14);

  --text: #f8f8f2;
  --text-secondary: #bfbfb8;
  --text-dim: #6272a4;

  --accent: #8be9fd;
  --accent-dim: rgba(139, 233, 253, 0.10);

  --tint: #bd93f9;
  --tint-dim: rgba(189, 147, 249, 0.10);

  --green: #50fa7b;  --green-dim: rgba(80, 250, 123, 0.10);
  --red: #ff5555;    --red-dim: rgba(255, 85, 85, 0.10);
  --amber: #f1fa8c;  --amber-dim: rgba(241, 250, 140, 0.10);
  --blue: #8be9fd;   --blue-dim: rgba(139, 233, 253, 0.10);
}
```

### Nord

```css
:root {
  --bg: #2e3440;
  --bg-secondary: #282d38;
  --surface: #3b4252;
  --surface-elevated: #434c5e;
  --surface-recessed: #272c36;

  --border: rgba(216, 222, 233, 0.08);
  --border-bright: rgba(216, 222, 233, 0.14);

  --text: #eceff4;
  --text-secondary: #d8dee9;
  --text-dim: #616e88;

  --accent: #88c0d0;
  --accent-dim: rgba(136, 192, 208, 0.10);

  --tint: #81a1c1;
  --tint-dim: rgba(129, 161, 193, 0.10);

  --green: #a3be8c;  --green-dim: rgba(163, 190, 140, 0.10);
  --red: #bf616a;    --red-dim: rgba(191, 97, 106, 0.10);
  --amber: #ebcb8b;  --amber-dim: rgba(235, 203, 139, 0.10);
  --blue: #5e81ac;   --blue-dim: rgba(94, 129, 172, 0.10);
}
```

### Catppuccin (Mocha)

```css
:root {
  --bg: #1e1e2e;
  --bg-secondary: #181825;
  --surface: #252536;
  --surface-elevated: #2d2d44;
  --surface-recessed: #141422;

  --border: rgba(205, 214, 244, 0.08);
  --border-bright: rgba(205, 214, 244, 0.14);

  --text: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-dim: #585b70;

  --accent: #89dceb;
  --accent-dim: rgba(137, 220, 235, 0.10);

  --tint: #cba6f7;
  --tint-dim: rgba(203, 166, 247, 0.10);

  --green: #a6e3a1;  --green-dim: rgba(166, 227, 161, 0.10);
  --red: #f38ba8;    --red-dim: rgba(243, 139, 168, 0.10);
  --amber: #f9e2af;  --amber-dim: rgba(249, 226, 175, 0.10);
  --blue: #89b4fa;   --blue-dim: rgba(137, 180, 250, 0.10);
}
```

### Solarized Dark

```css
:root {
  --bg: #002b36;
  --bg-secondary: #073642;
  --surface: #0a3d4a;
  --surface-elevated: #134852;
  --surface-recessed: #002028;

  --border: rgba(131, 148, 150, 0.12);
  --border-bright: rgba(131, 148, 150, 0.22);

  --text: #fdf6e3;
  --text-secondary: #93a1a1;
  --text-dim: #586e75;

  --accent: #2aa198;
  --accent-dim: rgba(42, 161, 152, 0.10);

  --tint: #268bd2;
  --tint-dim: rgba(38, 139, 210, 0.10);

  --green: #859900;  --green-dim: rgba(133, 153, 0, 0.10);
  --red: #dc322f;    --red-dim: rgba(220, 50, 47, 0.10);
  --amber: #b58900;  --amber-dim: rgba(181, 137, 0, 0.10);
  --blue: #268bd2;   --blue-dim: rgba(38, 139, 210, 0.10);
}
```

**Note:** IDE themes are dark-first. For light mode, either invert to the light variant (e.g., Solarized Light, Catppuccin Latte) or use a subtle light adaptation that preserves the accent colors.

---

## 8. Data-dense

Maximum information per pixel. Small type, tight spacing, no decorative elements. Use for audit reports, dependency matrices, large tables, and monitoring views.

**Font pairing:** Inter (heading, 600) + JetBrains Mono (body + labels). Body at 12px, headings at 14-16px.

```css
/* Light-first — data density works better on light backgrounds for readability */
:root {
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;

  --bg: #fafafa;
  --bg-secondary: #f5f5f5;
  --surface: #ffffff;
  --surface-elevated: #ffffff;
  --surface-recessed: #f0f0f0;

  --border: #e0e0e0;
  --border-bright: #c0c0c0;

  --text: #1a1a1a;
  --text-secondary: #555555;
  --text-dim: #999999;

  --accent: #2563eb;
  --accent-dim: rgba(37, 99, 235, 0.06);

  --tint: #2563eb;
  --tint-dim: rgba(37, 99, 235, 0.04);

  --green: #16a34a;  --green-dim: rgba(22, 163, 74, 0.06);
  --red: #dc2626;    --red-dim: rgba(220, 38, 38, 0.06);
  --amber: #d97706;  --amber-dim: rgba(217, 119, 6, 0.06);
  --blue: #2563eb;   --blue-dim: rgba(37, 99, 235, 0.06);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111111;
    --bg-secondary: #1a1a1a;
    --surface: #1e1e1e;
    --surface-elevated: #252525;
    --surface-recessed: #0e0e0e;

    --border: rgba(255, 255, 255, 0.08);
    --border-bright: rgba(255, 255, 255, 0.15);

    --text: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-dim: #666666;

    --accent: #60a5fa;
    --accent-dim: rgba(96, 165, 250, 0.08);

    --tint: #60a5fa;
    --tint-dim: rgba(96, 165, 250, 0.06);

    --green: #4ade80;  --green-dim: rgba(74, 222, 128, 0.08);
    --red: #f87171;    --red-dim: rgba(248, 113, 113, 0.08);
    --amber: #fbbf24;  --amber-dim: rgba(251, 191, 36, 0.08);
    --blue: #60a5fa;   --blue-dim: rgba(96, 165, 250, 0.08);
  }
}
```

**Key overrides** for data-dense pages:
```css
body { font-size: 12px; line-height: 1.45; padding: 16px; }
h1 { font-size: 16px; font-weight: 600; }
.node { padding: 8px 12px; border-radius: 4px; }
.kpi-card { padding: 10px 12px; }
.kpi-card__value { font-size: 24px; }
.data-table td { padding: 6px 10px; }
```

**Background atmosphere:** Flat — no patterns, no gradients. Every pixel is for data.

---

## 9. Gradient Mesh

Bold gradients, glassmorphism, modern SaaS feel. Use for product launches, feature announcements, landing-page-style explainers.

**Font pairing:** Fraunces (heading, 700-900) + Source Code Pro (labels) + Inter (body).

```css
/* Light-first — gradient mesh works well in both modes */
:root {
  --font-heading: 'Fraunces', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'Source Code Pro', 'SF Mono', Consolas, monospace;

  --bg: #fafafa;
  --bg-secondary: #f0f0f5;
  --surface: rgba(255, 255, 255, 0.7);
  --surface-elevated: rgba(255, 255, 255, 0.85);
  --surface-recessed: rgba(240, 240, 245, 0.6);

  --border: rgba(0, 0, 0, 0.06);
  --border-bright: rgba(0, 0, 0, 0.12);

  --text: #1a1a2e;
  --text-secondary: #4a4a6a;
  --text-dim: #8a8aa0;

  --accent: #6366f1;
  --accent-dim: rgba(99, 102, 241, 0.08);

  --tint: #ec4899;
  --tint-dim: rgba(236, 72, 153, 0.08);

  --green: #10b981;  --green-dim: rgba(16, 185, 129, 0.08);
  --red: #ef4444;    --red-dim: rgba(239, 68, 68, 0.08);
  --amber: #f59e0b;  --amber-dim: rgba(245, 158, 11, 0.08);
  --blue: #3b82f6;   --blue-dim: rgba(59, 130, 246, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a1a;
    --bg-secondary: #111128;
    --surface: rgba(30, 30, 60, 0.6);
    --surface-elevated: rgba(40, 40, 80, 0.7);
    --surface-recessed: rgba(15, 15, 35, 0.5);

    --border: rgba(255, 255, 255, 0.06);
    --border-bright: rgba(255, 255, 255, 0.12);

    --text: #f0f0ff;
    --text-secondary: #b0b0d0;
    --text-dim: #6a6a90;

    --accent: #818cf8;
    --accent-dim: rgba(129, 140, 248, 0.10);

    --tint: #f472b6;
    --tint-dim: rgba(244, 114, 182, 0.10);

    --green: #34d399;  --green-dim: rgba(52, 211, 153, 0.10);
    --red: #f87171;    --red-dim: rgba(248, 113, 113, 0.10);
    --amber: #fbbf24;  --amber-dim: rgba(251, 191, 36, 0.10);
    --blue: #60a5fa;   --blue-dim: rgba(96, 165, 250, 0.10);
  }
}
```

**Background atmosphere:** Multi-point gradient mesh is the signature:
```css
body {
  background-image:
    radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
    radial-gradient(at 100% 0%, rgba(236, 72, 153, 0.10) 0%, transparent 50%),
    radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.08) 0%, transparent 50%);
}
```

**Glassmorphism card pattern:**
```css
.node {
  background: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 12px;
}
```
