---
name: clean-code
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Scan for deterministic clean-code leads and guide agent review of judgment-heavy maintainability principles.
argument-hint: "[repo path, area, or clean-code concern]"
---

# /engineering:clean-code

Hidden wrapper for the `clean-code` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../engineering/clean-code.md`.
2. Treat `$ARGUMENTS` as the repo path, area, or clean-code concern.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: inspect surrounding code before promoting a scanner lead to a finding.

User input: $ARGUMENTS
