---
name: reduce
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route plan-simplification requests to the reduce module.
argument-hint: "[goal, plan, or path to a plan/spec file]"
---

# /engineering:reduce

Hidden wrapper for the `reduce` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../engineering/reduce.md`.
2. Treat `$ARGUMENTS` as the goal, plan, or plan/spec file path.
3. Follow the module's gates and stop if the module cannot be read.
4. Preserve the wrapper invariant: inspect the codebase instead of asking when inspection can answer a question.

User input: $ARGUMENTS
