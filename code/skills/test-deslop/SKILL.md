---
name: test-deslop
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route test-suite deslopification requests to the code workflow module.
argument-hint: "[test scope or pruning request]"
---

# /code:test-deslop

Hidden wrapper for the `test-deslop` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../code/test-deslop.md`.
2. Treat `$ARGUMENTS` as the test scope, pruning request, or naming-standardization request.
3. Follow the module's contract, workflow, rubric, and verification requirements.
4. Preserve the wrapper invariant: baseline CI before pruning, and never touch source code or shared helpers as part of a deslop pass.
5. Stop and report if the module cannot be read; do not reconstruct the workflow from memory.

User input: $ARGUMENTS
