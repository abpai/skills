---
name: baseline
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route fleet-scale behavior-baseline work to the baseline module."
argument-hint: "[stage or repo baseline goal]"
---

# /harness:baseline

Hidden wrapper for the `baseline` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../harness/baseline.md`.
2. Treat `$ARGUMENTS` as the stage override or repo baseline goal.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: baseline is resumable from on-disk artifacts;
   do not rely on chat memory across the human ratification gap.

User input: $ARGUMENTS
