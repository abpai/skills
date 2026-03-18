# Mermaid Tips

## Syntax

**Quote labels with special characters.** Parentheses, colons, commas, and brackets break the parser:
```
A["handleRequest(ctx)"] --> B["DB: query users"]
```

**Simple alphanumeric node IDs.** Put readable names in labels, not IDs:
```
userSvc["User Service"] --> authSvc["Auth Service"]
```

**Max ~15 nodes per diagram.** Soft target 10–12. Use `subgraph` to group related nodes:
```
subgraph Auth
  login --> validate --> token
end
subgraph API
  gateway --> router --> handler
end
Auth --> API
```

**Prefer `flowchart TD` for 5+ nodes.** Top-down reads naturally. Use `flowchart LR` only for simple 3–4 node linear flows.

**`stateDiagram-v2` parser limitations.** Transition labels reject colons, parentheses, `<br/>`, and HTML entities. If labels need special characters, use `flowchart LR` with rounded nodes instead.

**Arrow semantics:**
| Arrow | Meaning |
|-------|---------|
| `-->` | Primary flow |
| `-.->` | Optional / async |
| `==>` | Critical path |
| `--x` | Rejected / blocked |

## CDN Import

```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
</script>
```

## Theming for Threaded

Use `theme: 'base'` — it is the only theme where `themeVariables` are fully customizable.

```js
const isDark = document.documentElement.classList.contains('dark');

mermaid.initialize({
  startOnLoad: true,
  theme: 'base',
  look: 'classic',
  themeVariables: {
    primaryColor:       isDark ? '#1e293b' : '#f1f5f9',
    primaryBorderColor: isDark ? '#f59e0b' : '#b45309',
    primaryTextColor:   isDark ? '#f1f5f9' : '#0f172a',
    lineColor:          isDark ? '#475569' : '#94a3b8',
    fontSize: '16px',
    fontFamily: "'Merriweather', Georgia, serif",
  },
});
```

**CSS overrides** for node and edge labels — required so text follows the page color scheme:

```css
.mermaid .nodeLabel { color: var(--text) !important; }
.mermaid .edgeLabel { color: var(--text-dim) !important; background-color: var(--bg) !important; }
.mermaid .edgeLabel rect { fill: var(--bg) !important; }
```
