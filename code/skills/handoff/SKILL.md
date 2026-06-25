---
name: handoff
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route coding-work handoff requests to the continuation-prompt module.
argument-hint: "[next goal, follow-up task, or empty to continue current work]"
---

# /code:handoff

Hidden wrapper for the `handoff` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../code/handoff.md`.
2. Treat `$ARGUMENTS` as the next goal or follow-up task.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: the output must be a self-contained continuation prompt, not implementation of the follow-up task.

User input: $ARGUMENTS
