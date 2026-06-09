---
name: harness
description: "Grouped agent-harness workflow pack. Invoke with a subcommand argument — never call the subcommand skills directly (they have disable-model-invocation). Subcommands: 'docs' (make a repo ergonomic for agent-driven development — author docs/SPEC_CONTRACT.md from real validation surfaces, convert prose rules into tests/lints/CI gates, keep AGENTS.md a tiny router, create earned doc surfaces only on demonstrated need), 'doctor' (verification-first readiness audit — runs the repo's validation commands, checks spec-contract alignment, scores six dimensions (0-4) into a 0-100 readiness score, reports recommendation-first with finding IDs and proof)."
argument-hint: "[subcommand] [args] — e.g. docs, doctor, --docs docs overhaul"
metadata:
  version: "1.1.0"
---

# Harness Workflow Pack

This umbrella skill is the model-invocable entry point for agent harness work: the designed repository environment that lets coding agents find the right code, owner, invariant, and validation path quickly — and prove their work end-to-end. Verification loops are the product; docs are the routing layer.

Each workflow also ships as its own `harness/skills/<name>/SKILL.md`, but those per-command skills set `disable-model-invocation: true`, `user-invocable: false`, and `metadata.internal: true`, so they stay out of the model's auto-invocation, out of the `/` menu (no unscoped `/<name>` duplicates of the umbrella), and out of flat-list installers like the `npx skills` installer used by Codex. Reach any workflow through this umbrella — the subcommand router below maps `/harness <name>` to the matching module. The workflow modules referenced below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/harness` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `harness <subcommand> <args>` — e.g. `harness docs`
- `harness --<subcommand> <args>` — e.g. `harness --docs docs overhaul`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, and match it case-insensitively against the workflow names below. On a match, load `skills/harness/<subcommand>.md` and treat the remaining tokens as that workflow's input. If the first token is not a known subcommand, treat the whole input as a natural-language harness request and route by intent.

Known subcommands: `docs`, `doctor`.

Reserved future workflows: `testing`, `reflect`. Do not route to them until their modules exist. Evals stay outside the docs structure unless a dedicated workflow is added later.

## Routing

- Use `docs.md` to make a repo ergonomic for agent-driven execution: the spec contract (`docs/SPEC_CONTRACT.md`), prose-to-enforcement conversion, a tiny `AGENTS.md` router with a `CLAUDE.md` shim, and earned doc surfaces. The module defines the full process. Per-task intake (interview-to-SPEC.md) happens outside the repo and is out of scope.
- Use `doctor.md` for readiness audits: it runs the external `harness-doctor` CLI when available, executes the repo's validation commands per its execution policy, checks spec-contract alignment, scores the six dimensions, and reports recommendation-first with finding IDs, tiers, and proof of what actually ran.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
