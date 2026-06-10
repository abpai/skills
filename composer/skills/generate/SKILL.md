---
name: generate
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Delegate a bounded implementation task to Cursor Composer from a planner-written brief.
argument-hint: "[implementation brief, branch/worktree, model, or PR instruction]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill. The Composer umbrella
# carries the union allowlist used by the routed /composer generate workflow.
---

# /composer:generate

Use the `generate` module.

1. Read the implementation module: `../composer/generate.md` when installed as
   this command wrapper, or `composer/skills/composer/generate.md` in the repo.
2. Turn the planner brief into a bounded Composer prompt.
3. Run Composer in the requested branch/worktree.
4. Inspect the diff, validate it, and open a draft PR when requested.

User input: $ARGUMENTS
