---
name: plan
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route planning requests to the pstack plan module.
argument-hint: "[task]"
---

# /pstack:plan

Hidden wrapper for the `plan` mode. Load the module and pass through the user
input.

1. Read the sibling module `../pstack/plan.md`.
2. Treat `$ARGUMENTS` as the task to plan; if empty, use the current task.
3. Follow the module and the missing-input rules in `../pstack/SKILL.md`.
4. Stop and report if the module cannot be read; do not reconstruct the workflow from memory.

User input: $ARGUMENTS
