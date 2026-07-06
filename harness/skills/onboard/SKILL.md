---
name: onboard
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route autonomous-ready onboarding-manifest emission to the onboard module."
argument-hint: "[repo to onboard]"
---

# /harness:onboard

Hidden wrapper for the `onboard` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../harness/onboard.md`.
2. Treat `$ARGUMENTS` as the repo to onboard.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: audit first, populate every manifest field
   from evidence or a gap, and never assert an unearned `autonomous-ready`.

User input: $ARGUMENTS
