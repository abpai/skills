# agent-browser

Browser automation CLI for AI agents.

```
  agent-browser open <url>
       │
       v
  snapshot -i          → @e1 [input "Email"]
       │                 @e2 [input "Password"]
       v                 @e3 [button "Submit"]
  fill @e1 "user@example.com"
  fill @e2 "password"
  click @e3
       │
       v
  wait --load networkidle
  snapshot -i          → new refs for new page
```

## Core Loop

1. **Open** a page (fresh browser or connect to existing Chrome)
2. **Snapshot** to get interactive element refs (`@e1`, `@e2`, ...)
3. **Interact** using refs (click, fill, select, scroll)
4. **Re-snapshot** after any navigation or DOM change

Refs are invalidated on page changes — always re-snapshot.

## Connection Modes

```bash
agent-browser open <url>                        # Fresh headless browser
agent-browser --headed open <url>               # Fresh visible browser
agent-browser connect "${AGENT_BROWSER_CDP_PORT:-9222}"  # Reuse existing Chrome
```

## Key Commands

| Command | What it does |
|---|---|
| `open <url>` | Navigate to URL |
| `snapshot -i` | List interactive elements with refs |
| `click @e1` | Click element |
| `fill @e1 "text"` | Clear and type into input |
| `screenshot` | Capture page image |
| `screenshot --annotate` | Screenshot with numbered element labels |
| `wait --load networkidle` | Wait for page to settle |
| `eval 'js expression'` | Run JavaScript in browser |
| `diff snapshot` | Compare current vs last snapshot |

## Prerequisites

- `agent-browser` CLI (`npm install -g agent-browser`)
- For iOS testing: macOS with Xcode + Appium
