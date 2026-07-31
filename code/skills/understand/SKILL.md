---
name: understand
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route code-path understanding requests to the runnable real-code snippet module, with an optional HTML map.
argument-hint: "[symbol, feature, or file/module path] [--map]"
---

# /code:understand

Hidden wrapper for the `understand` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/understand.md`.
2. Treat `$ARGUMENTS` as the requested symbol, feature, or file/module path,
   plus an optional `--map` flag.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: default writes only the runnable
   `.understand/<topic>/how_<topic>_works.<ext>`; with `--map`, also write
   `.understand/<topic>/index.html`. Never render the HTML in chat.

User input: $ARGUMENTS
