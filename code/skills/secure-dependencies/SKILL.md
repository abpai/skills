---
name: secure-dependencies
disable-model-invocation: true
description: Harden dependency resolution and supply-chain policy in the current repository.
argument-hint: "[repo path or hardening request]"
---

# /code:secure-dependencies

Use the `secure-dependencies` module.

1. Read `skills/code/secure-dependencies.md`.
2. Inspect manifests, lockfiles, CI install commands, and dependency bot config.
3. Apply only the ecosystem policies that match the repository.
4. Validate with the relevant locked or frozen install commands.

User input: $ARGUMENTS
