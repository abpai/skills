---
name: engineering
description: Engineering-practice workflow pack. Use when the user asks for /engineering:grill-me, /engineering:tdd, /engineering:zoom-out, /engineering:improve-architecture, /engineering:defined-terms, /engineering:complexity-report, or wants to stress-test a plan, use TDD, zoom out on code, improve codebase architecture, build a DDD ubiquitous-language glossary, or produce a read-only complexity/performance report with stable finding IDs.
metadata:
  version: "1.5.0"
---

# Engineering Workflow Pack

This plugin exposes one public Codex skill surface for a family of engineering-practice workflows (inspired by Matt Pocock). Claude Code also exposes command wrappers under `/engineering:*`. The workflow modules live beside this `SKILL.md` (with shared docs under `references/`) so the skill is self-contained when installed on its own.

## Routing

- Use `grill-me.md` for grill-me, plan grilling, or design stress-testing.
- Use `tdd.md` for TDD, test-first work, or red-green-refactor loops.
- Use `zoom-out.md` when the user wants to zoom out, map an unfamiliar code area, or go up a layer of abstraction.
- Use `improve-architecture.md` for architecture improvement, deep modules, locality, leverage, testability, or AI-navigability.
- Use `defined-terms.md` for extracting a DDD-style ubiquitous-language glossary from the conversation into `DEFINED_TERMS.md`, flagging ambiguities and synonyms.
- Use `complexity-report.md` for read-only complexity and performance reports, evidence-ranked findings, stable finding IDs, proof obligations, and next-turn implementation guidance.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
