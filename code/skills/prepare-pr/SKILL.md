---
name: prepare-pr
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route full PR-readiness work to the prepare-pr module.
argument-hint: "[scope or message hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill and its allowed-tools
# would be dead config. The allowlist lives on the umbrella code/skills/code/SKILL.md.
---

# /code:prepare-pr

Hidden wrapper for the `prepare-pr` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/prepare-pr.md`.
2. Treat `$ARGUMENTS` as the scope or message hint.
3. Follow the module's Workflow, Stop Conditions, and Output Contract.
4. Stop and report if the module cannot be read; do not reconstruct the workflow from memory.

User input: $ARGUMENTS
