---
name: code
description: Grouped coding workflow pack. Use when the user asks for /code:review-and-commit, /code:explain, /code:try, /code:simplify, /code:walkthrough, /code:understand, or wants code review and commits, technical explanation, library evaluation, behavior-preserving simplification, a paired architectural walkthrough, or a call-path understanding trace.
metadata:
  version: "1.0.0"
---

# Code Workflow Pack

This plugin exposes one public Codex skill surface for common code workflows. Claude Code also exposes command wrappers under `/code:*`. The individual workflow modules live as flat Markdown files under `internal/` so they are bundled with the plugin without becoming separate installable skills or per-workflow folders.

## Routing

- Use `../../internal/review-and-commit.md` for working-tree review, fixes, atomic commit planning, or committing after approval.
- Use `../../internal/explain.md` for dense technical explanations, tutorials, walkthrough prose, README guidance, or onboarding docs.
- Use `../../internal/try.md` for evaluating a new library, tool, package, or GitHub repo before adoption.
- Use `../../internal/simplify.md` for behavior-preserving simplification of recently changed code.
- Use `../../internal/walkthrough.md` for paired, source-grounded architectural walkthroughs that produce durable todos, memos, migration plans, and reframes.
- Use `../../internal/understand.md` for tracing a specific code path into a `.understand/<topic>.md` walkthrough with call stack, concrete values, side effects, and scratch skeleton imports.

When a request names one workflow, load that internal module and follow it. When the request is ambiguous, pick the nearest module from context or ask one short clarifying question.
