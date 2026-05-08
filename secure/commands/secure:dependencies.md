---
description: Harden dependency resolution and supply-chain policy in the current repository
argument-hint: "[repo path or hardening request]"
---

# /secure:dependencies

Use the dependency hardening module in this plugin.

1. Read `skills/hardening-dependency-resolution/SKILL.md`.
2. Follow its workflow exactly, including the ecosystem-specific reference load.
3. Treat `$ARGUMENTS` as the target repository path or extra hardening request. If no path is provided, use the current repository.
4. Keep scope to dependency resolution and supply-chain hardening. For unrelated security work, name the future `/secure:*` module that should own it instead of broadening this command.

User input: $ARGUMENTS
