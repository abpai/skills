---
name: capture
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route behavior-capture (characterization safety net) work to the capture module."
argument-hint: "[behavior to pin before change]"
---

# /harness:capture

Hidden wrapper for the `capture` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../harness/capture.md`.
2. Treat `$ARGUMENTS` as the behavior surface to pin before change.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: capture what the code *does*, not what it
   *should* do, and confirm the net is green against the unchanged code.

User input: $ARGUMENTS
