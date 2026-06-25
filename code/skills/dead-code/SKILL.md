---
name: dead-code
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route dead-code reachability audits to the code workflow module.
argument-hint: "[scope or codebase area]"
---

# /code:dead-code

Hidden wrapper for the `dead-code` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../code/dead-code.md`.
2. Treat `$ARGUMENTS` as the scope or codebase area.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: identify live entry points before listing candidates.

User input: $ARGUMENTS
