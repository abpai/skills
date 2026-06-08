---
name: harness
description: Agent harness workflow pack. Use /harness:docs in Claude or $harness docs in Codex to create progressive-disclosure repository docs; use /harness:doctor or $harness doctor to audit docs, agent guidance, todo specs, glossary/routes, and validation paths with Harness Doctor or a manual checklist.
argument-hint: "[subcommand] [args] - e.g. docs, doctor, --docs docs overhaul"
metadata:
  version: "1.0.4"
---

# Harness Workflow Pack

This umbrella skill is the model-invocable entry point for agent harness work: the designed repository environment that lets coding agents find the right code, owner, invariant, and validation path quickly.

Each public workflow also ships as its own `harness/skills/<name>/SKILL.md` so it surfaces as a namespaced `/harness:<name>` command in Claude. Those per-command skills set `disable-model-invocation: true` and `metadata.internal: true`, so model routing stays here while flat-list installers such as Codex surface only this pack. The workflow modules referenced below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

On surfaces without `/harness:<name>` namespacing, invoke a workflow by passing its name as the first argument. Both forms are equivalent and supported:

- `harness <subcommand> <args>` - e.g. `harness docs`
- `harness --<subcommand> <args>` - e.g. `harness --docs docs overhaul`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it case-insensitively against the workflow names below. On a match, load `skills/harness/<subcommand>.md` and treat the remaining tokens as that workflow's input. If the first token is not a known subcommand, treat the whole input as a natural-language harness request and route by intent.

Known subcommands: `docs`, `doctor`.

Reserved future workflows: `testing`, `reflect`. Do not route to them until their modules exist. Evals stay outside the docs structure unless a dedicated workflow is added later.

## Routing

- Use `docs.md` for progressive-disclosure documentation systems: a tiny AGENTS.md router, repo-local docs as source of truth, glossary/architecture/design/engineering/todo indexes, per-domain code maps, invariants, and validation routes. Keep branch-local task plans, generated analysis, and tooling output temporary unless a durable follow-up belongs in `docs/todos`.
- Use `doctor.md` for Harness Doctor scans, docs/readiness scoring, Keep/Move/Delete audits, AGENTS.md line-quality gates, nested AGENTS decisions, and proof-backed remediation plans. Run the external CLI when available and fall back to the manual checklist.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
