# try

Evaluate a library, tool, or repo before adopting it.

```
  User: "try better-auth"
           │
           v
  ┌─── Setup ───────────────────────────────┐
  │  try CLI workspace or /tmp fallback      │
  └──────────────┬──────────────────────────┘
                 v
  ┌─── Recon ───────────────────────────────┐
  │  README → exports → examples → tests    │
  │  Produce primitive inventory (5-8)      │
  └──────────────┬──────────────────────────┘
                 v
  ┌─── Primitive Scripts ───────────────────┐
  │  One script per primitive               │
  │  Write → Run → Observe → Note findings  │
  └──────────────┬──────────────────────────┘
                 v
  ┌─── Composition ─────────────────────────┐
  │  Wire 2-4 primitives into a real use    │
  │  case (targets user's specific goal)    │
  └──────────────┬──────────────────────────┘
                 v
  ┌─── Tutorial.md ─────────────────────────┐
  │  Verdict, gotchas, maturity, API        │
  │  ergonomics, honest recommendation      │
  └─────────────────────────────────────────┘
```

## Usage

```bash
/try ComposioHQ/agent-orchestrator
/try https://github.com/some/repo — help me build X
/try langgraph  # focus on state machine primitives
```

## Output

All artifacts land in `explorations/` inside the workspace:
- Numbered primitive scripts (`01-*.ts`, `02-*.ts`, ...)
- Composition script (`99-compose.ts`)
- `Tutorial.md` with honest verdict and gotchas

## Prerequisites

- `try` CLI for workspace management (optional — falls back to `/tmp`)
