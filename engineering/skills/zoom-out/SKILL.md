---
name: zoom-out
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route unfamiliar-code orientation requests to the zoom-out module.
argument-hint: "[code area or question]"
---

# /engineering:zoom-out

Hidden wrapper for the `zoom-out` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../engineering/zoom-out.md`.
2. Treat `$ARGUMENTS` as the code area or question.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: return orientation sections, not implementation changes.

User input: $ARGUMENTS
