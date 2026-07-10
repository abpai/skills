---
name: engineering
description: "Route engineering-practice workflows through one scoped /engineering command. Use grill-me to stress-test a plan, tdd for behavior-first red/green/refactor, zoom-out for orientation, improve-architecture for deeper modules, defined-terms for DDD glossaries, complexity-report for read-only complexity findings, and reduce for plan simplification."
argument-hint: "[subcommand] [args] - e.g. tdd add retries, complexity-report src/, reduce ship onboarding"
metadata:
  version: "2.0.0"
---

# Engineering Workflow Pack

This umbrella skill is the model-invocable entry point for the engineering
workflow pack and the single scoped `/engineering` command users see in the `/`
menu. Hidden wrappers stay out of model routing, menus, and flat-list
installers; reach every workflow through `/engineering <name>`.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/engineering` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `engineering <subcommand> <args>` — e.g. `engineering tdd add retries`
- `engineering --<subcommand> <args>` — e.g. `engineering --tdd add retries`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it (case-insensitive) against the workflow names below. On a match, load the sibling module `./<subcommand>.md` and treat the remaining tokens as that workflow's input. Routing is complete when exactly one module is selected, loaded, and handed the remaining args. If the first token is not a known subcommand, treat the whole input as a natural-language request and route by intent. Known subcommands: `grill-me`, `tdd`, `zoom-out`, `improve-architecture`, `defined-terms`, `complexity-report`, `reduce`.

Before natural-language fallback, detect the removed exact token `clean-code` and
return its migration to `code simplify [scope]` (requires the code plugin;
warning: clean-code was a review-only report, while a scoped `simplify` applies
edits — omit the scope for a proposal-only ranking). Carry the user's remaining
arguments into the suggestion. Stop after the guidance; do not pretend the
replacement ran.

## Routing

- Use `grill-me.md` for grill-me, plan grilling, or design stress-testing.
- Use `tdd.md` for TDD, test-first work, or red-green-refactor loops.
- Use `zoom-out.md` when the user wants to zoom out, map an unfamiliar code area, or go up a layer of abstraction.
- Use `improve-architecture.md` for architecture improvement, deep modules, locality, leverage, testability, or AI-navigability.
- Use `defined-terms.md` for extracting a DDD-style ubiquitous-language glossary from the conversation into `DEFINED_TERMS.md`, flagging ambiguities and synonyms.
- Use `complexity-report.md` for read-only complexity and performance reports, evidence-ranked findings, stable finding IDs, proof obligations, and next-turn implementation guidance.
- Use `reduce.md` to optimize a plan, goal, or plan file with a gated five-step first-principles sequence.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
