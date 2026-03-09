---
name: code-simplifier
description: Simplify and refactor code for clarity, consistency, and maintainability while preserving exact behavior. Use when code was just added or modified and needs readability-focused cleanup without changing outputs, side effects, or external interfaces.
---

# Code Simplifier

Refine code so it is easier to read, reason about, and maintain without changing what it does.

Source basis: adapted from Anthropic's `code-simplifier` skill:
`https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md`

## Core Rules

1. Preserve functionality exactly.
1. Keep public behavior, outputs, side effects, and interfaces unchanged.
1. Follow project-specific coding standards and patterns.
1. Prefer clarity over compactness.
1. Avoid clever rewrites that reduce debuggability.

## Simplification Targets

Improve code by:

- Reducing unnecessary nesting and branching complexity.
- Removing redundant abstractions and duplicate logic.
- Renaming unclear identifiers to improve intent readability.
- Splitting dense logic into coherent, single-purpose helpers.
- Replacing fragile one-liners with explicit, readable control flow.
- Removing comments that only restate obvious code behavior.

Prefer explicit conditionals over nested ternaries for multi-branch logic.

## Boundaries

Do not:

- Change business logic or edge-case behavior.
- Alter API contracts, data formats, or error semantics unless requested.
- Expand scope beyond recently touched code unless explicitly requested.
- Over-normalize style at the expense of local codebase conventions.

## Workflow

1. Identify files and sections changed in the current task.
1. Detect readability and maintainability issues in that scope.
1. Apply minimal, behavior-preserving refactors.
1. Re-check for regressions in logic, interfaces, and side effects.
1. Run available lint/test checks when practical.
1. Summarize only meaningful structural changes.

## Repeated Passes

If the user asks to simplify recursively, keep going until no changes remain, or uses command-like phrasing such as `/code-simplifier 5`, switch to loop mode instead of a single pass.

Loop mode workflow:

1. Parse an optional max iteration count from the request.
1. Default to `5` when no number is provided.
1. Execute the bundled runner script:
   `bash <skill_dir>/scripts/run-codex-simplifier-loop.sh --max-iterations <N>`
1. Prefer `--dry-run` only when the user asks for preview mode.
1. Report:
   - number of rounds attempted
   - whether each round changed files
   - whether loop stopped early due to no changes

Loop mode parameters:

- `--max-iterations N`: Maximum rounds to run (default `5`)
- `--codex-cmd "..."`: Optional custom Codex command (default `codex exec --full-auto`)
- `--prompt "..."`: Optional custom instruction prompt
- `--dry-run`: Print planned commands without executing Codex

## Decision Heuristics

- If two versions are equivalent, choose the one a new teammate can understand fastest.
- Keep useful abstractions; remove only those that add indirection without value.
- Prefer straightforward flow over reduced line count.
- Stop when readability gains flatten out.
- In loop mode, stop immediately when a round produces no working-tree changes.
