---
name: setup
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Verify Cursor Composer and OpenAI Codex CLI auth for planner/executor workflows.
argument-hint: "[--smoke or env-file hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill. The Composer umbrella
# carries the union allowlist used by the routed /composer setup workflow.
---

# /composer:setup

Hidden wrapper for the `setup` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../composer/setup.md`.
2. Treat `$ARGUMENTS` as the smoke-test or env-file hint.
3. Follow the module's workflow and stop if the module cannot be read.
4. Report Cursor, Composer model, and Codex readiness without printing secrets.

User input: $ARGUMENTS
