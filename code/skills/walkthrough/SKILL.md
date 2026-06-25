---
name: walkthrough
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route codebase mastery walkthroughs to the source-grounded quiz module.
argument-hint: "[codebase area, change, or question]"
---

# /code:walkthrough

Hidden wrapper for the `walkthrough` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/walkthrough.md`.
2. Treat `$ARGUMENTS` as the codebase area, change, or question.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: checklist items must be grounded in real source evidence, and the loop asks one question at a time (`AskUserQuestion` in Claude Code; one concise question and wait in Codex).

User input: $ARGUMENTS
