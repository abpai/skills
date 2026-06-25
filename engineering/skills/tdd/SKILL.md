---
name: tdd
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route behavior-first TDD requests to the engineering TDD module.
argument-hint: "[feature or bug]"
---

# /engineering:tdd

Hidden wrapper for the `tdd` subcommand. Load the module and pass through the
user input.

1. Read the sibling module `../engineering/tdd.md`.
2. Treat `$ARGUMENTS` as the feature or bug request.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: keep tests behavior-focused and avoid implementation-coupled mocks.

User input: $ARGUMENTS
