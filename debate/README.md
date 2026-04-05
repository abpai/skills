# debate

Structured architecture debate with adversarial review.

```
  You                Claude               Codex
   |                   |                    |
   |── question ──────>|                    |
   |                   |── read codebase    |
   |                   |── propose ─────────|── critique
   |                   |<── attacks + alts ─|
   |                   |── synthesize       |
   |<── ADR + next ────|                    |
```

Claude proposes an opinionated architecture recommendation. Codex attacks it on
five vectors (hidden coupling, migration traps, auth edge cases, operational
complexity, elegant-but-wrong abstractions) — every criticism must include a
concrete alternative. Claude synthesizes the final decision, picking sides
rather than averaging.

## Usage

```bash
/debate Should we split the API into microservices or keep the monolith?
```

## Output

- Final recommendation with concrete next steps
- ADR (Architecture Decision Record)
- Unresolved tensions that need human judgment

## Prerequisites

- `codex` CLI for independent critique (falls back to single-model if unavailable)
