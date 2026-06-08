---
name: doctor
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Run or manually apply the Harness Doctor audit workflow: deterministic docs scanner results, progressive-disclosure findings, Keep/Move/Delete doc review, AGENTS.md line gate, readiness triage, and proof-backed next steps."
argument-hint: "[repo audit goal]"
---

# /harness:doctor

Use the `doctor` module.

1. Read `skills/harness/doctor.md`.
2. Run `npx harness-doctor@latest --json --verbose --diff` or a full scan when appropriate.
3. Fall back to the manual checklist if the scanner is unavailable.
4. Triage findings as Critical, High, and Medium.
5. Recommend Immediate, Near-term, and Later fixes with proof of what was checked.

User input: $ARGUMENTS
