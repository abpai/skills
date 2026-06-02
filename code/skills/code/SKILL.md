---
name: code
description: Grouped coding workflow pack. Use /code:prepare-pr for full PR readiness, /code:review-and-commit for quick local review plus commit, and the internal finish-lane helper only from prepare-pr after code is working. Also use for /code:goal, /code:explain, /code:try, /code:walkthrough, /code:understand, /code:dead-code, /code:scratch, /code:secure-dependencies, and /code:handoff.
metadata:
  version: "1.8.0"
---

# Code Workflow Pack

This plugin exposes one public Codex skill surface for common code workflows. Claude Code also exposes command wrappers under `/code:*`. The workflow modules live beside this `SKILL.md` so they are bundled with the plugin without becoming separate installable skills or per-workflow folders.

## Routing

- Use `prepare-pr.md` for full PR readiness: finish-lane artifacts, quality gates, targeted QA, evidence, and PR narrative.
- Use `review-and-commit.md` for quick local review plus commit: inspect scope, fix real issues, run targeted checks, plan a commit, ask approval, then commit.
- Treat `finish-lane.md` as an internal helper used by `prepare-pr.md`, not as a public command route.
- Treat `review-patterns/` as the bundled detailed prompt library for `prepare-pr` gates. Load only the playbooks selected by the generated `review-patterns.md` index.
- Use `goal.md` for defining or auditing a coding goal so it has a verifier, bounded scope, context, stop conditions, and output shape.
- Use `explain.md` for dense technical explanations, tutorials, walkthrough prose, README guidance, or onboarding docs.
- Use `try.md` for evaluating a new library, tool, package, or GitHub repo before adoption.
- Use `walkthrough.md` to teach the owner a system or change to verified mastery: ground a checklist, then quiz one scenario at a time until every item has an unaided correct answer. It is a persistent comprehension goal, not a tour.
- Use `understand.md` for tracing a specific code path into a `.understand/<topic>.html` artifact with call graph, concrete values, side effects, and scratch skeleton imports.
- Use `dead-code.md` for conservative dead-code reachability audits and safe removal plans.
- Use `scratch.md` for hands-on codebase exploration with runnable `.scratch/` scripts.
- Use `secure-dependencies.md` for dependency resolution and supply-chain hardening in code repositories.
- Use `handoff.md` for creating a focused continuation prompt that lets a new coding session resume with live repo state, file refs, decisions, next steps, and verification.

When a request names one workflow, load that module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
