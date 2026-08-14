---
name: harness
disable-model-invocation: true
description: "Route agent-harness workflows through one scoped /harness command. Use guide for scenario-based first-audit, adoption, CI, self-review, and tune-up instructions; baseline to inventory production behavior at repo scale; docs for agent-ready guidance; doctor for verification-first readiness and diff audits; compliant for end-to-end remediation including dependency hardening; secure-dependencies for lockfile and supply-chain policy; capture to pin one behavior surface; onboard for provisional factory handoffs; evals for proof-menu seed proposals; and dogfood for skill hardening."
argument-hint: "[subcommand] [args] - e.g. guide, baseline, docs, doctor, compliant, secure-dependencies, capture, onboard, evals, dogfood"
metadata:
  version: "1.9.1"
---

# Harness Workflow Pack

This umbrella skill is the explicit, human-invoked entry point for agent harness work: the designed repository environment that lets coding agents find the right code, owner, invariant, and validation path quickly — and prove their work end-to-end. Verification loops are the product; docs are the routing layer.

Hidden wrappers stay out of model routing, menus, and flat-list installers.
Reach every workflow through this umbrella; the workflow modules referenced
below live beside this `SKILL.md` as flat support files.

## Subcommand invocation

Invoke a workflow by passing its name as the first argument to this umbrella — this is the access path on every surface: the Claude `/` menu shows only `/harness` (the per-command wrappers are hidden), and Codex has no `:` namespace. Both forms are equivalent and supported:

- `harness <subcommand> <args>` — e.g. `harness docs`
- `harness --<subcommand> <args>` — e.g. `harness --docs docs overhaul`

Parse `$ARGUMENTS`: take the first token, strip a leading `--` if present, resolve aliases (`overhaul` → `compliant`), and match it case-insensitively against the workflow names below. On a match, load the sibling module `./<subcommand>.md` and treat the remaining tokens as that workflow's input. Routing is complete when exactly one module is selected, loaded, and handed the remaining args. If the first token is not a known subcommand, treat the whole input as a natural-language harness request and route by intent.

Known subcommands: `guide`, `baseline`, `docs`, `doctor`, `compliant`, `secure-dependencies`, `capture`, `onboard`, `evals`, `dogfood`.

## Routing

- Use `guide.md` when a human or agent asks how to use Harness, what to run first, whether workflows differ, what belongs in CI, how to self-review, or when to run a tune-up. It selects a scenario and gives exact operations, human gates, expected artifacts, and done criteria without executing mutating workflows by default.
- Use `baseline.md` to prepare an existing production repo for agents at fleet scale: run a Gate 0 toolchain check, scout functionality and existing proof, create/refresh `docs/BEHAVIOR_INVENTORY.md`, stop for file-based human ratification, capture confirmed behavior into characterization tests/snapshots, and write `docs/BEHAVIOR_LEDGER.md`. Stage overrides: `status`, `scout`, `inventory`, `inventory --refresh`, `capture`.
- Use `docs.md` to make a repo ergonomic for agent-driven execution: the spec contract (`docs/SPEC_CONTRACT.md`), prose-to-enforcement conversion, a tiny `AGENTS.md` router with a `CLAUDE.md` shim, and earned doc surfaces. The module defines the full process. Per-task intake (interview-to-SPEC.md) happens outside the repo and is out of scope.
- Use `doctor.md` for readiness audits and diff-scoped self-review: it runs the external `harness-doctor` CLI when available, configures its Knip-backed dead-code pass through repository-owned Knip config, executes the repo's validation commands per its execution policy, checks spec-contract and behavior-ledger alignment, scores the seven dimensions (D1-D7, including D7 safety/blast-radius), and reports recommendation-first with finding IDs, tiers, and proof of what actually ran. `doctor diff` maps changed files to behavior IDs and required ledger proofs.
- Use `compliant.md` (aliases: `overhaul`; natural-language "make this repo harness compliant") for an end-to-end pass: audit with `doctor.md`, remediate guidance and enforcement with `docs.md`, apply `secure-dependencies.md`, then re-audit to verify.
- Use `secure-dependencies.md` to harden dependency resolution, lockfile use, update-bot cooldowns, lifecycle scripts, and CI install commands for the ecosystems actually present.
- Use `capture.md` to characterize one current behavior surface with tests/snapshots **before** an agent changes legacy or under-tested code — the safety net that lets an agent tell a fix from a regression. It also has row mode for `baseline.md` (`BehaviorRow` in, `LedgerRow` out). Standalone capture outputs a capture report and coverage-gap report; only row mode updates `docs/BEHAVIOR_LEDGER.md`.
- Use `onboard.md` to project an audited repo into a provisional `autonomous-ready` handoff for a downstream factory, gated on the loop-readiness verdict. Emits the proposed manifest plus an onboarding checklist. The unimplemented cross-system proposal lives in `./FACTORY_HANDOFFS.md`.
- Use `evals.md` to project spec-contract proof rows into provisional eval seed data. Produces seed specs; the runner/grader and supported contract live on the factory side.
- Use `dogfood.md` to harden a skill (or the harness) by running it under a sub-agent, reviewing the transcript for friction, and repairing the smallest durable surface until runs come out clean. Harness is the patchable target; automated feedback ingestion is the factory's job.

When a request names one workflow, load that module and follow it. Route
questions such as “what should I run?” or “how do I make this compliant?” to
`guide`; route imperatives such as “make this compliant” directly to the named
workflow. When intent remains ambiguous, ask one short clarifying question.

These workflows form the agent-driven pipeline end to end: `guide` selects the right entry point → `baseline` inventories and pins existing production behavior → `capture` pins one scoped behavior when needed → `docs`/`secure-dependencies`/`compliant` make the repo deterministic and ergonomic → `doctor` audits readiness and diff self-review → `onboard` emits the manifest and `evals` seeds the tests a factory runs → `dogfood` closes the loop by hardening the skills from real usage.
