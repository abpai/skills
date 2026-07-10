---
name: simplify
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route scoped code simplification and whole-repository simplification proposals to the code workflow module.
argument-hint: "[path, symbol, file, or subsystem; omit for a whole-repo proposal]"
---

# /code:simplify

Hidden wrapper for the `simplify` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../code/simplify.md`.
2. Treat `$ARGUMENTS` as the requested scope.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the scope invariant: a named narrow scope may be edited; omitted or repository-root scope is proposal-only.

User input: $ARGUMENTS
