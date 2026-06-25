---
name: improve-architecture
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route architecture-improvement requests to the deep-module review module.
argument-hint: "[codebase area or goal]"
---

# /engineering:improve-architecture

Hidden wrapper for the `improve-architecture` subcommand. Load the module and
pass through the user input.

1. Read the sibling module `../engineering/improve-architecture.md`.
2. Treat `$ARGUMENTS` as the codebase area or goal.
3. Follow the module's workflow and load only the references it calls for.
4. Stop before interface design unless the user selects a candidate for deeper work.

User input: $ARGUMENTS
