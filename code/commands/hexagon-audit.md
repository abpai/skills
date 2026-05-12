---
description: Audit Ports & Adapters (Hexagonal Architecture) compliance in a packages/ + adapters/ monorepo.
argument-hint: "[repo path, domain group, or empty for a full audit]"
---

# /code:hexagon-audit

Use the `hexagon-audit` module.

1. Read `skills/code/hexagon-audit.md`.
2. Run the deterministic scanner first, then focused `rg` spot checks.
3. Classify each finding as hard violation, soft smell, or clean.
4. Produce the markdown report; only change code if the user explicitly asks.

User input: $ARGUMENTS
