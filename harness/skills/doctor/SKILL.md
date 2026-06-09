---
name: doctor
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Audit repo readiness for agent-driven development: run the harness-doctor scanner when available, execute the repo's validation commands (never irreversible ones), check spec-contract alignment, score six verification-first dimensions (0-4) into a 0-100 readiness score, and report recommendation-first with finding IDs, severity, tiers, and proof."
argument-hint: "[repo audit goal]"
---

# /harness:doctor

Use the `doctor` module.

1. Read `skills/harness/doctor.md`.
2. Run `npx harness-doctor@latest --json --verbose --diff` or a full scan; fall back to the manual checks if unavailable.
3. Execute the repo's validation commands per the execution policy; mark irreversible commands inspected-not-run.
4. Check spec-contract supply/demand alignment and score the six dimensions.
5. Report recommendation-first: findings with IDs and concrete paths, Immediate/Near-term/Later tiers referencing IDs, and proof of what actually ran.

User input: $ARGUMENTS
