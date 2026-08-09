---
name: explain-diff
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route multi-language and React code-change walkthroughs to aligned before-and-after call paths.
argument-hint: "[working tree, base...head, commit, or PR] [entry point or behavior]"
---

# /code:explain-diff

Hidden wrapper for the `explain-diff` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/explain-diff.md`.
2. Treat `$ARGUMENTS` as the diff scope plus an optional entry point or behavior.
3. Follow the module's read-only workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: explain verified execution-path changes and
   label parser output or unresolved dynamic dispatch as evidence, not fact.

User input: $ARGUMENTS
