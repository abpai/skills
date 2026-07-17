---
name: prepare-pr
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route effort-scaled PR-readiness work through validation, commit, seal, push, and PR update.
argument-hint: "[--effort low|medium|high] [scope or message hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill and its allowed-tools
# would be dead config. The allowlist lives on the umbrella code/skills/code/SKILL.md.
---

# /code:prepare-pr

Hidden wrapper for the `prepare-pr` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../code/prepare-pr.md`.
2. Treat `$ARGUMENTS` as the effort, scope, and message hint; `low` is the default effort.
3. Follow the module's phases, bright-line rules, and output format.
4. Stop and report if the module cannot be read; do not reconstruct the workflow from memory.

User input: $ARGUMENTS
