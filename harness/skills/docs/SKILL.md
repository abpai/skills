---
name: docs
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Make a repository ergonomic for agent-driven development: author docs/SPEC_CONTRACT.md from real validation surfaces, convert prose rules into tests/lints/CI gates per the enforcement hierarchy, keep AGENTS.md a tiny router with a CLAUDE.md shim, and create earned doc surfaces (glossary, todos, domains, design) only on demonstrated need."
argument-hint: "[repo docs goal]"
---

# /harness:docs

Use the `docs` module.

1. Read `skills/harness/docs.md`.
2. Inventory current guidance and validation surfaces (scripts, CI, tests, lints).
3. Run the Keep/Move/Delete audit and convert prose rules to enforcement.
4. Author `docs/SPEC_CONTRACT.md` with a proof menu derived from the validation inventory.
5. Rewrite `AGENTS.md` as a tiny router; verify structure with the `harness-doctor` scanner, and run every documented command.

User input: $ARGUMENTS
