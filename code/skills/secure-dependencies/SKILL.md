---
name: secure-dependencies
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route dependency and supply-chain hardening requests to the code workflow module.
argument-hint: "[repo path or hardening request]"
---

# /code:secure-dependencies

Hidden wrapper for the `secure-dependencies` subcommand. Load the module and
pass through the user input.

1. Read the sibling module `../code/secure-dependencies.md`.
2. Treat `$ARGUMENTS` as the repository path or hardening request.
3. Follow the module's Workflow, Stop Conditions, and Output Contract.
4. Stop and report if the module cannot be read; do not reconstruct the workflow from memory.

User input: $ARGUMENTS
