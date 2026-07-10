---
name: guide
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route scenario-based Harness onboarding, CI, self-review, and maintenance tutorials to the guide module."
argument-hint: "[first-audit|adopt-existing|ci|self-review|tune-up|risky-change|docs-only|secure-dependencies|fleet-triage|onboard|evals|status]"
---

# /harness:guide

Hidden wrapper for the `guide` subcommand. Load the module and pass through the
user input.

1. Read the sibling module `../harness/guide.md`.
2. Treat `$ARGUMENTS` as the scenario or natural-language usage question.
3. Follow the module and stop if it cannot be read.
4. Preserve the wrapper invariant: guide inspects and teaches by default; do not
   execute a mutating Harness workflow without an explicit request.

User input: $ARGUMENTS
