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
2. Run the deterministic scan: prefer a repo-pinned `harness-doctor`; run `npx @andypai/harness-doctor@latest` only after confirming with the user. If the scanner is unavailable, warn, mark scanner-owned dimensions unreviewed, and label the score provisional — never hand-run the deterministic rule family.
3. Execute the repo's validation commands per the execution policy; mark irreversible commands inspected-not-run.
4. Check spec-contract supply/demand alignment and score the six dimensions.
5. Report recommendation-first: findings with IDs and concrete paths, Immediate/Near-term/Later tiers referencing IDs, and proof of what actually ran.

User input: $ARGUMENTS
