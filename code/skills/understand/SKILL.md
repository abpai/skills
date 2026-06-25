---
name: understand
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route code-path understanding requests to the traced-map module.
argument-hint: "[symbol, feature, or file/module path]"
---

# /code:understand

Hidden wrapper for the `understand` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/understand.md`.
2. Treat `$ARGUMENTS` as the requested symbol, feature, or file/module path.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: write the artifact to `.understand/<topic>.html`; do not render it in chat.

User input: $ARGUMENTS
