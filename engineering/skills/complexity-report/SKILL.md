---
name: complexity-report
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Produce a read-only, evidence-ranked complexity and performance report.
argument-hint: "[repo path, area, or performance question]"
---

# /engineering:complexity-report

Hidden wrapper for the `complexity-report` subcommand. Load the module and
pass through the user input.

1. Read the sibling module `../engineering/complexity-report.md`.
2. Treat `$ARGUMENTS` as the target repository, area, route, or performance concern.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariants: keep the pass read-only and return stable finding IDs.

User input: $ARGUMENTS
