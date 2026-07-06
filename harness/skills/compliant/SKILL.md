---
name: compliant
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route end-to-end harness-compliance overhauls to the compliant module."
argument-hint: "[repo overhaul goal]"
---

# /harness:compliant

Hidden wrapper for the `compliant` subcommand (alias: `overhaul`). Load the
module and pass through the user input.

1. Read the sibling module `../harness/compliant.md`.
2. Treat `$ARGUMENTS` as the repo overhaul goal.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: audit, remediate, then re-audit — never claim
   compliance from a single pass.

User input: $ARGUMENTS
