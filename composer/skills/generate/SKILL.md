---
name: generate
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route bounded Cursor Composer implementation requests to the generate module.
argument-hint: "[implementation brief, branch/worktree, model, or PR instruction]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill. The Composer umbrella
# carries the union allowlist used by the routed /composer generate workflow.
---

# /composer:generate

Hidden wrapper for the `generate` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../composer/generate.md`.
2. Treat `$ARGUMENTS` as the implementation brief, branch/worktree, model, or PR instruction.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: inspect the Composer diff and validate before opening a draft PR when requested.

User input: $ARGUMENTS
