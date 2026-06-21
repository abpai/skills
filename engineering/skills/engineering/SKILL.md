---
name: engineering
description: "Grouped engineering-practice workflow pack. Invoke with a subcommand argument — never call the subcommand skills directly (they have disable-model-invocation). Subcommands: 'grill-me' (stress-test plans), 'tdd' (test-first loops), 'zoom-out' (map unfamiliar code), 'improve-architecture' (deep modules/leverage), 'defined-terms' (DDD glossary), 'complexity-report' (read-only complexity report), 'reduce' (optimize a plan with Elon's five-step delete-first algorithm)."
argument-hint: "[subcommand] [args] — e.g. tdd add retries, --grill-me, complexity-report src/, reduce ship onboarding"
metadata:
  version: "1.9.0"
---

# Engineering Workflow Pack

This umbrella skill is the model-invocable entry point for a family of engineering-practice workflows (inspired by Matt Pocock), and the single scoped `/engineering` command users see in the `/` menu. Each workflow also ships as its own `engineering/skills/<name>/SKILL.md`, but those per-command skills set `disable-model-invocation: true`, `user-invocable: false`, and `metadata.internal: true`, so they stay out of the model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates of the umbrella), and out of flat-list installers like the `npx skills` installer used by Codex. Reach any workflow through this umbrella — the subcommand router below maps `/engineering <name>` to the matching module. The workflow modules referenced below live beside this `SKILL.md` (with shared docs under `references/`) as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/engineering` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `engineering <subcommand> <args>` — e.g. `engineering tdd add retries`
- `engineering --<subcommand> <args>` — e.g. `engineering --tdd add retries`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it (case-insensitive) against the workflow names below. On a match, load `skills/engineering/<subcommand>.md` and treat the remaining tokens as that workflow's input. If the first token is not a known subcommand, treat the whole input as a natural-language request and route by intent. Known subcommands: `grill-me`, `tdd`, `zoom-out`, `improve-architecture`, `defined-terms`, `complexity-report`, `reduce`.

## Routing

- Use `grill-me.md` for grill-me, plan grilling, or design stress-testing.
- Use `tdd.md` for TDD, test-first work, or red-green-refactor loops.
- Use `zoom-out.md` when the user wants to zoom out, map an unfamiliar code area, or go up a layer of abstraction.
- Use `improve-architecture.md` for architecture improvement, deep modules, locality, leverage, testability, or AI-navigability.
- Use `defined-terms.md` for extracting a DDD-style ubiquitous-language glossary from the conversation into `DEFINED_TERMS.md`, flagging ambiguities and synonyms.
- Use `complexity-report.md` for read-only complexity and performance reports, evidence-ranked findings, stable finding IDs, proof obligations, and next-turn implementation guidance.
- Use `reduce.md` to optimize a plan (or goal, or plan file) with Elon Musk's five-step first-principles algorithm — question the requirements, delete, simplify, accelerate, automate — gating on the question and delete steps, debating each step across two providers (Claude ⇄ Codex), and rendering the reworked plan via the `visualize` skill.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
