---
name: review-and-commit
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Quickly review local changes, run targeted checks, and create an approved commit without the full PR-prep lane.
argument-hint: "[scope or message hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill and its allowed-tools
# would be dead config. The allowlist lives on the umbrella code/skills/code/SKILL.md.
---

# /code:review-and-commit

Use the `review-and-commit` module.

1. Read `skills/code/review-and-commit.md`.
2. Inspect the working tree, staged changes, and untracked files.
3. Review the diff, apply scoped fixes, and run targeted validation.
4. Propose the exact files and commit message.
5. Ask for approval before staging or committing.
6. Do not run the full finish lane or draft PR text unless the user asks for PR readiness.

User input: $ARGUMENTS
