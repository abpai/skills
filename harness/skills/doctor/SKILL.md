---
name: doctor
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route verification-first repo readiness and diff self-review audits to the doctor module."
argument-hint: "[repo audit goal or diff]"
---

# /harness:doctor

Hidden wrapper for the `doctor` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../harness/doctor.md`.
2. Treat `$ARGUMENTS` as the repo audit goal.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: report proof of what actually ran, mark unavailable scanner coverage provisional, and in diff scope list impacted behavior-ledger proofs.

User input: $ARGUMENTS
