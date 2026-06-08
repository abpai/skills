---
name: harness
description: "Grouped agent-harness workflow pack. Invoke with a subcommand argument — never call the subcommand skills directly (they have disable-model-invocation). Subcommands: 'docs' (create progressive-disclosure repository docs — tiny AGENTS.md router, docs/ indexes, glossary, architecture/design/engineering, todo specs, per-domain code maps), 'doctor' (audit docs, AGENTS.md, glossary/todo specs, domain maps, and validation routes with Harness Doctor or a manual checklist)."
argument-hint: "[subcommand] [args] — e.g. docs, doctor, --docs docs overhaul"
metadata:
  version: "1.0.5"
---

# Harness Workflow Pack

This umbrella skill is the model-invocable entry point for agent harness work: the designed repository environment that lets coding agents find the right code, owner, invariant, and validation path quickly.

Each workflow also ships as its own `harness/skills/<name>/SKILL.md`, but those per-command skills set `disable-model-invocation: true`, `user-invocable: false`, and `metadata.internal: true`, so they stay out of the model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates of the umbrella), and out of flat-list installers like the `npx skills` installer used by Codex. Reach any workflow through this umbrella — the subcommand router below maps `/harness <name>` to the matching module. The workflow modules referenced below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/harness` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `harness <subcommand> <args>` — e.g. `harness docs`
- `harness --<subcommand> <args>` — e.g. `harness --docs docs overhaul`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it case-insensitively against the workflow names below. On a match, load `skills/harness/<subcommand>.md` and treat the remaining tokens as that workflow's input. If the first token is not a known subcommand, treat the whole input as a natural-language harness request and route by intent.

Known subcommands: `docs`, `doctor`.

Reserved future workflows: `testing`, `reflect`. Do not route to them until their modules exist. Evals stay outside the docs structure unless a dedicated workflow is added later.

## Routing

- Use `docs.md` for progressive-disclosure documentation systems: a tiny AGENTS.md router, repo-local docs as source of truth, glossary/architecture/design/engineering/todo indexes, per-domain code maps, invariants, and validation routes. Keep branch-local task plans, generated analysis, and tooling output temporary unless a durable follow-up belongs in `docs/todos`.
- Use `doctor.md` for Harness Doctor scans, docs/readiness scoring, Keep/Move/Delete audits, AGENTS.md line-quality gates, nested AGENTS decisions, and proof-backed remediation plans. Run the external CLI when available and fall back to the manual checklist.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
