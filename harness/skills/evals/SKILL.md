---
name: evals
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route proof-menu eval-seeding work to the evals module."
argument-hint: "[repo whose proof menu seeds evals]"
---

# /harness:evals

Hidden wrapper for the `evals` subcommand. Load the module and pass through the
user input.

1. Read the sibling module `../harness/evals.md`.
2. Treat `$ARGUMENTS` as the repo whose proof menu seeds evals.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: require a machine-readable proof menu, seed
   one eval per row, and never silently default a `human-gate` row to `auto`.

User input: $ARGUMENTS
