---
name: review-and-commit
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route quick local review-and-commit work to the code workflow module.
argument-hint: "[scope or message hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill and its allowed-tools
# would be dead config. The allowlist lives on the umbrella code/skills/code/SKILL.md.
---

# /code:review-and-commit

Hidden wrapper for the `review-and-commit` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/review-and-commit.md`.
2. Treat `$ARGUMENTS` as the scope or message hint.
3. Follow the module's workflow and stop if the module cannot be read.
4. If the user asks for PR readiness, push, or PR text, stop this shim and route to `../code/prepare-pr.md`.
5. Preserve the wrapper invariant: ask before staging or committing.

User input: $ARGUMENTS
