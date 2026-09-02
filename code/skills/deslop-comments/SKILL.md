---
name: deslop-comments
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route repository comment cleanup through the code workflow module.
argument-hint: "[repository path, area, or current diff]"
---

# /code:deslop-comments

Hidden wrapper for the `deslop-comments` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/deslop-comments.md`.
2. Treat `$ARGUMENTS` as the maintained cleanup scope; omitted scope means the
   current repository.
3. Follow the module's scope contract, invariants, and evidence requirements.
4. Stop and report if the module cannot be read; do not reconstruct the
   workflow from memory.

User input: $ARGUMENTS
