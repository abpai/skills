---
name: mp
description: Matt Pocock-inspired workflow pack. Use when the user asks for /mp:grill-me, /mp:tdd, /mp:zoom-out, /mp:improve-codebase-architecture, or wants to stress-test a plan, use TDD, zoom out on code, or improve codebase architecture.
metadata:
  version: "1.1.0"
---

# MP Workflow Pack

This plugin exposes one public Codex skill surface for the Matt Pocock-inspired workflow family. Claude Code also exposes command wrappers under `/mp:*`. The individual workflow modules live under `internal/` so they are bundled with the plugin without becoming separate installable skills.

## Routing

- Use `../../internal/grill-me/README.md` for grill-me, plan grilling, or design stress-testing.
- Use `../../internal/tdd/README.md` for TDD, test-first work, or red-green-refactor loops.
- Use `../../internal/zoom-out/README.md` when the user wants to zoom out, map an unfamiliar code area, or go up a layer of abstraction.
- Use `../../internal/improve-codebase-architecture/README.md` for architecture improvement, deep modules, locality, leverage, testability, or AI-navigability.

When a request names one workflow, load that internal module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
