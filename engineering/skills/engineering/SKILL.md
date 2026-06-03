---
name: engineering
description: Engineering-practice workflow pack. Use when the user asks for /engineering:grill-me, /engineering:tdd, /engineering:zoom-out, /engineering:improve-architecture, /engineering:defined-terms, /engineering:complexity-report, or wants to stress-test a plan, use TDD, zoom out on code, improve codebase architecture, build a DDD ubiquitous-language glossary, or produce a read-only complexity/performance report with stable finding IDs.
argument-hint: "[subcommand] [args] — e.g. tdd add retries, --grill-me, complexity-report src/"
metadata:
  version: "1.7.0"
---

# Engineering Workflow Pack

This umbrella skill is the model-invocable entry point for a family of engineering-practice workflows (inspired by Matt Pocock). Each public workflow also ships as its own `engineering/skills/<name>/SKILL.md` so it surfaces as a namespaced `/engineering:<name>` command (those per-command skills set `disable-model-invocation: true` and `metadata.internal: true`, so only the user invokes them directly while the model routes through this umbrella, and agents that flatten every `SKILL.md` into one list — e.g. the `npx skills` installer used by Codex — hide the per-command wrappers and surface only this pack). The workflow modules referenced below live beside this `SKILL.md` (with shared docs under `references/`) as flat support files.

## Subcommand invocation

On surfaces without `/engineering:<name>` namespacing (e.g. Codex), invoke a workflow by passing its name as the first argument. Both forms are equivalent and supported:

- `engineering <subcommand> <args>` — e.g. `engineering tdd add retries`
- `engineering --<subcommand> <args>` — e.g. `engineering --tdd add retries`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it (case-insensitive) against the workflow names below. On a match, load `skills/engineering/<subcommand>.md` and treat the remaining tokens as that workflow's input. If the first token is not a known subcommand, treat the whole input as a natural-language request and route by intent. Known subcommands: `grill-me`, `tdd`, `zoom-out`, `improve-architecture`, `defined-terms`, `complexity-report`.

## Routing

- Use `grill-me.md` for grill-me, plan grilling, or design stress-testing.
- Use `tdd.md` for TDD, test-first work, or red-green-refactor loops.
- Use `zoom-out.md` when the user wants to zoom out, map an unfamiliar code area, or go up a layer of abstraction.
- Use `improve-architecture.md` for architecture improvement, deep modules, locality, leverage, testability, or AI-navigability.
- Use `defined-terms.md` for extracting a DDD-style ubiquitous-language glossary from the conversation into `DEFINED_TERMS.md`, flagging ambiguities and synonyms.
- Use `complexity-report.md` for read-only complexity and performance reports, evidence-ranked findings, stable finding IDs, proof obligations, and next-turn implementation guidance.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
