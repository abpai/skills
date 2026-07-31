---
name: understand
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route code-path understanding requests to the HTML-map and runnable real-code snippet module.
argument-hint: "[symbol, feature, or file/module path] [--snippet]"
---

# /code:understand

Hidden wrapper for the `understand` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/understand.md`.
2. Treat `$ARGUMENTS` as the requested symbol, feature, or file/module path,
   plus an optional `--snippet` flag.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: in default mode, write both
   `.understand/<topic>/index.html` and a runnable
   `.understand/<topic>/how_<topic>_works.<ext>`; with `--snippet`, write only
   the runnable snippet. Never render the HTML in chat.

User input: $ARGUMENTS
