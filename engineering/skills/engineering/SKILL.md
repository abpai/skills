---
name: engineering
description: Engineering-practice workflow pack (Matt Pocock-inspired). Use when the user asks for /engineering:grill-me, /engineering:tdd, /engineering:zoom-out, /engineering:improve-codebase-architecture, or wants to stress-test a plan, use TDD, zoom out on code, or improve codebase architecture.
metadata:
  version: "1.2.0"
---

# Engineering Workflow Pack

This plugin exposes one public Codex skill surface for a family of engineering-practice workflows (inspired by Matt Pocock). Claude Code also exposes command wrappers under `/engineering:*`. The individual workflow modules live as flat Markdown files under `internal/` so they are bundled with the plugin without becoming separate installable skills or per-workflow folders.

## Routing

- Use `../../internal/grill-me.md` for grill-me, plan grilling, or design stress-testing.
- Use `../../internal/tdd.md` for TDD, test-first work, or red-green-refactor loops.
- Use `../../internal/zoom-out.md` when the user wants to zoom out, map an unfamiliar code area, or go up a layer of abstraction.
- Use `../../internal/improve-codebase-architecture.md` for architecture improvement, deep modules, locality, leverage, testability, or AI-navigability.

When a request names one workflow, load that internal module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
