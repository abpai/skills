---
name: code
description: Grouped coding workflow pack. Use when the user asks for /code:goal, /code:review-and-commit, /code:explain, /code:try, /code:simplify, /code:walkthrough, /code:understand, /code:dead-code, /code:scratch, /code:socratic-owner, /code:secure-dependencies, /code:hexagon-audit, /code:karpathy, or wants verifiable goal definition, code review, technical explanation, library evaluation, simplification, walkthroughs, call-path traces, HTML review artifacts, dead-code audits, runnable codebase exploration, owner briefings, dependency hardening, a Ports & Adapters / hexagonal-architecture compliance audit, or simple/surgical/verified coding guardrails.
metadata:
  version: "1.5.0"
---

# Code Workflow Pack

This plugin exposes one public Codex skill surface for common code workflows. Claude Code also exposes command wrappers under `/code:*`. The workflow modules live beside this `SKILL.md` so they are bundled with the plugin without becoming separate installable skills or per-workflow folders.

## Routing

- Use `review-and-commit.md` for working-tree review, fixes, atomic commit planning, or committing after approval.
- Use `goal.md` for defining or auditing a coding goal so it has a verifier, bounded scope, context, stop conditions, and output shape.
- Use `explain.md` for dense technical explanations, tutorials, walkthrough prose, README guidance, or onboarding docs.
- Use `try.md` for evaluating a new library, tool, package, or GitHub repo before adoption.
- Use `simplify.md` for behavior-preserving simplification of recently changed code.
- Use `walkthrough.md` for paired, source-grounded architectural walkthroughs that produce durable todos, memos, migration plans, and reframes.
- Use `understand.md` for tracing a specific code path into a `.understand/<topic>.html` artifact with call graph, concrete values, side effects, and scratch skeleton imports.
- Use `dead-code.md` for conservative dead-code reachability audits and safe removal plans.
- Use `scratch.md` for hands-on codebase exploration with runnable `.scratch/` scripts.
- Use `socratic-owner.md` for scenario-based owner briefings that quiz the developer on code, architecture, or a plan.
- Use `secure-dependencies.md` for dependency resolution and supply-chain hardening in code repositories.
- Use `hexagon-audit.md` for auditing Ports & Adapters / hexagonal compliance in a `packages/` + `adapters/` monorepo (it ships a deterministic scanner under `scripts/`).
- Use `karpathy.md` for applying simple, surgical, verified coding guardrails while writing, reviewing, or refactoring code.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
