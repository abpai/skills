---
name: secure-dependencies
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Route repository dependency and supply-chain hardening to the harness workflow module.
argument-hint: "[repo path or hardening concern]"
---

# /harness:secure-dependencies

Hidden wrapper for the `secure-dependencies` subcommand.

1. Read the sibling module `../harness/secure-dependencies.md`.
2. Treat `$ARGUMENTS` as the repository path or hardening concern.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve existing registries, package managers, and lockfiles; never invent ecosystem policy from memory when the bundled reference applies.

User input: $ARGUMENTS
