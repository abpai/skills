# Karpathy Guidelines

Source: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
Examples source: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/EXAMPLES.md
Upstream license: MIT.

Use this as a coding guardrail when writing, reviewing, or refactoring code. It is an overlay on the active task, not a replacement for repo-specific instructions.

## Use When

- The user asks for Karpathy-style guidelines, restraint, simplicity, surgical edits, or verification discipline.
- A coding task is likely to invite overengineering, broad refactors, hidden assumptions, or weak stopping criteria.
- A review should focus on whether the proposed change is smaller, clearer, and better verified.

## Don't Use When

- The user explicitly asks for a specialized workflow such as `/code:understand`, `/code:simplify`, or `/code:review-and-commit`; use that workflow first and apply these guardrails only as a secondary check.
- The task needs domain-specific guidance that conflicts with this module; follow the domain workflow and name the tradeoff.

## Operating Rules

1. Think before coding.
   - State assumptions when they affect the implementation.
   - If multiple interpretations are viable, name the tradeoff.
   - Ask only when ambiguity blocks a safe implementation; otherwise proceed with the smallest reasonable assumption.

2. Keep it simple.
   - Solve only the requested problem.
   - Do not add abstractions, configuration, extension points, or broad error handling unless the task requires them.
   - If the implementation starts getting large, pause and look for the smaller shape before continuing.

3. Make surgical changes.
   - Touch only files and lines that trace to the user's request.
   - Match the surrounding style even when you would normally choose differently.
   - Clean up imports, variables, helpers, or files made unused by your own change.
   - Mention unrelated dead code or cleanup opportunities instead of editing them.

4. Drive toward verification.
   - Turn the request into concrete success criteria before or during implementation.
   - For multi-step work, keep a short plan shaped like `step -> verify: check`.
   - Run the narrowest meaningful checks, then report what passed and what could not be run.

## Compact Examples

- Hidden assumptions: "export user data" might mean different scopes, fields, formats, and privacy constraints. Name the assumptions before touching code if the answer changes the implementation.
- Over-abstraction: "calculate discount" usually wants one clear function, not a strategy hierarchy. Add structure only when the current requirement needs it.
- Drive-by refactor: "fix empty emails crashing validation" should change the email path and related tests, not username validation, quote style, comments, or unrelated formatting.
- Style drift: "add logging" should match the surrounding style. Do not add type hints, docstrings, or rewrites merely because they look nicer.
- Vague goals: "fix authentication" is not a success criterion. Pin down the concrete failing behavior, reproduce it if practical, then fix and verify that behavior.
- Multi-step work: "add rate limiting" should be broken into independently verifiable increments, with the smallest useful first step and clear checks before expanding scope.

## Final Pass

Before finishing, ask:

- Does every changed line trace back to the request?
- Is there speculative flexibility that can be removed?
- Did I verify the behavior at the right scope?
- Did I clearly report assumptions, skipped checks, or residual risk?
