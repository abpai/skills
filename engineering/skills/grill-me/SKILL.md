---
name: grill-me
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route plan and design stress-tests to the grill-me module.
argument-hint: "[plan or design]"
---

# /engineering:grill-me

Hidden wrapper for the `grill-me` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../engineering/grill-me.md`.
2. Treat `$ARGUMENTS` as the plan or design input.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: ask one question at a time unless code inspection can answer it.

User input: $ARGUMENTS
