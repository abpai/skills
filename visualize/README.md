# visualize

Generate self-contained HTML visualizations that explain systems, plans, code flows, and concepts. Each output is a single `.html` file with an ivory/clay editorial gallery style inspired by the unreasonable-effectiveness-of-HTML examples — no build step, just open it in a browser.

## Install

```bash
# Claude Code
git clone https://github.com/abpai/skills.git ~/.claude/skills/visualize --no-checkout && \
  cd ~/.claude/skills/visualize && git sparse-checkout set visualize && git checkout

# Other agents — point at the directory containing SKILL.md,
# or paste its contents into your system prompt
```

## Usage

```
> visualize the auth flow in src/auth/
> walk me through how the build pipeline works
> explain the data model visually
> diagram the deployment architecture
```

Output goes to `~/.agent/diagrams/` and opens in the browser automatically.

## How It Works

```
SKILL.md (workflow + principles)
    ↓
templates/base.html         ← agent reads before each generation
references/design-system.md ← HTML-effectiveness color/type/layout tokens
references/mermaid-tips.md  ← syntax + theming for diagrams
    ↓
~/.agent/diagrams/filename.html → opens in browser
```

The agent reads the base template to absorb the Preact + CSS + HTML-effectiveness structure, then adapts it for the specific visualization type (module map, annotated diff, comparison grid, Mermaid diagram, table, timeline, editor, etc.).

## Limitations

- Requires a browser to view — no inline terminal rendering
- Mermaid diagrams use the color scheme detected at page load; refresh after a theme change
- Results vary by model capability

## Credits

Adapted from [visual-explainer](https://github.com/nicobailon/visual-explainer) by Nico Bailon.

## License

MIT
