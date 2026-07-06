---
name: dogfood
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route skill-hardening dogfood loops to the dogfood module."
argument-hint: "[skill to harden under review]"
---

# /harness:dogfood

Hidden wrapper for the `dogfood` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../harness/dogfood.md`.
2. Treat `$ARGUMENTS` as the skill to harden under review.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: repair the smallest durable surface, not
   an appended warning, and loop until consecutive clean runs.

User input: $ARGUMENTS
