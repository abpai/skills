---
name: engineering
disable-model-invocation: true
description: "Route engineering-practice workflows through one scoped /engineering command. Use grill-me to stress-test a plan, tdd for behavior-first red/green/refactor, zoom-out for orientation, improve-architecture for deeper modules, defined-terms for DDD glossaries, complexity-report for read-only complexity findings, and reduce for plan simplification."
argument-hint: "[subcommand] [args] - e.g. tdd add retries, complexity-report src/, reduce ship onboarding"
metadata:
  version: "2.1.0"
---

# Engineering Workflow Pack

This umbrella skill is the explicit, human-invoked entry point for the
engineering workflow pack — the single scoped `/engineering` command users see
in the `/` menu (`disable-model-invocation: true`; Codex
`policy.allow_implicit_invocation: false`). Per-command wrappers stay hidden
from menus and flat-list installers; reach every workflow through
`/engineering <name>`.

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

- `grill-me.md` — stress-test a plan or design.
- `tdd.md` — behavior-first, red/green/refactor work.
- `zoom-out.md` — orient in an unfamiliar code area.
- `improve-architecture.md` — deepen shallow modules.
- `defined-terms.md` — build a DDD glossary from the conversation.
- `complexity-report.md` — read-only complexity/performance report.
- `reduce.md` — gated five-step plan simplification.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
