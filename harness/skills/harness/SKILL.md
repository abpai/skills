---
name: harness
description: "Route agent-harness workflows through one scoped /harness command. Use docs to make a repo ergonomic for agent-driven development, doctor for a verification-first readiness audit, compliant to overhaul a repo end-to-end, capture to pin current behavior with tests before changing it, onboard to emit an autonomous-ready manifest for a factory to consume, evals to seed eval cases from the proof menu, and dogfood to harden a skill by using it under review."
argument-hint: "[subcommand] [args] - e.g. docs, doctor, compliant, capture, onboard, evals, dogfood"
metadata:
  version: "1.5.1"
---

# Harness Workflow Pack

This umbrella skill is the model-invocable entry point for agent harness work: the designed repository environment that lets coding agents find the right code, owner, invariant, and validation path quickly — and prove their work end-to-end. Verification loops are the product; docs are the routing layer.

Hidden wrappers stay out of model routing, menus, and flat-list installers.
Reach every workflow through this umbrella; the workflow modules referenced
below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/harness` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `harness <subcommand> <args>` — e.g. `harness docs`
- `harness --<subcommand> <args>` — e.g. `harness --docs docs overhaul`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, resolve aliases (`overhaul` → `compliant`), and match it case-insensitively against the workflow names below. On a match, load the sibling module `./<subcommand>.md` and treat the remaining tokens as that workflow's input. Routing is complete when exactly one module is selected, loaded, and handed the remaining args. If the first token is not a known subcommand, treat the whole input as a natural-language harness request and route by intent.

Known subcommands: `docs`, `doctor`, `compliant`, `capture`, `onboard`, `evals`, `dogfood`.

## Routing

- Use `docs.md` to make a repo ergonomic for agent-driven execution: the spec contract (`docs/SPEC_CONTRACT.md`), prose-to-enforcement conversion, a tiny `AGENTS.md` router with a `CLAUDE.md` shim, and earned doc surfaces. The module defines the full process. Per-task intake (interview-to-SPEC.md) happens outside the repo and is out of scope.
- Use `doctor.md` for readiness audits: it runs the external `harness-doctor` CLI when available, executes the repo's validation commands per its execution policy, checks spec-contract alignment, scores the seven dimensions (D1-D7, including D7 safety/blast-radius), and reports recommendation-first with finding IDs, tiers, and proof of what actually ran.
- Use `compliant.md` (aliases: `overhaul`; natural-language "make this repo harness compliant") for an end-to-end pass that chains both modules: audit with `doctor.md`, remediate the findings with `docs.md`, then re-audit to verify. This is the route for "bring this repo up to standard" requests that map to neither audit-only nor author-only.
- Use `capture.md` to characterize a repo's current behavior with tests/snapshots **before** an agent changes legacy or under-tested code — the safety net that lets an agent tell a fix from a regression. Outputs a behavior ledger and a coverage-gap report.
- Use `onboard.md` to project an audited repo into a machine-readable `autonomous-ready` manifest a downstream factory can consume, gated on the loop-readiness verdict. Emits the manifest plus an onboarding checklist. Schema in `./INTERFACES.md` in installed skills, with `../../INTERFACES.md` as the source-checkout mirror.
- Use `evals.md` to seed eval cases from the spec-contract proof menu — one gradeable eval seed per proof row. Produces seed specs; the runner/grader lives on the factory side.
- Use `dogfood.md` to harden a skill (or the harness) by running it under a sub-agent, reviewing the transcript for friction, and repairing the smallest durable surface until runs come out clean. Harness is the patchable target; automated feedback ingestion is the factory's job.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.

These workflows form the agent-driven pipeline end to end: `capture` pins current behavior → `docs`/`compliant` make the repo ergonomic → `doctor` audits readiness → `onboard` emits the manifest and `evals` seeds the tests a factory runs → `dogfood` closes the loop by hardening the skills from real usage.
