---
name: docs
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route repo-docs harness work to the docs module."
argument-hint: "[repo docs goal]"
---

# /harness:docs

Hidden wrapper for the `docs` subcommand. Load the module and pass through the
user input.

1. Read the sibling module `../harness/docs.md`.
2. Treat `$ARGUMENTS` as the repo docs goal.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: separate the Keep/Move/Delete audit from any enforcement edits.

User input: $ARGUMENTS
