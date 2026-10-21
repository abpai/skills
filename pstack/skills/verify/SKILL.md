---
name: verify
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route verification requests to the pstack verify module.
argument-hint: "[original request and implementation]"
---

# /pstack:verify

Hidden wrapper for the `verify` mode. Load the module and pass through the
user input.

1. Read the sibling module `../pstack/verify.md`.
2. Treat `$ARGUMENTS` as the original request and the implementation to
   inspect; if empty, use the current task.
3. Follow the module and the missing-input rules in `../pstack/SKILL.md`.
4. Stop and report if the module cannot be read; do not reconstruct the workflow from memory.

User input: $ARGUMENTS
