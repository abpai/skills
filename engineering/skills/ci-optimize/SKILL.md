---
name: ci-optimize
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route measured CI cost and latency improvements through the engineering workflow pack.
argument-hint: "[repository or change] [review|plan|implement]"
---

# /engineering:ci-optimize

Hidden wrapper for the `ci-optimize` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../engineering/ci-optimize.md`.
2. Treat `$ARGUMENTS` as the repository or change scope and requested mode.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: reduce CI cost or latency without weakening required merge or release proof.

User input: $ARGUMENTS
