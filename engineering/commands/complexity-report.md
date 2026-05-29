---
description: Produce a read-only, evidence-ranked complexity and performance report.
argument-hint: "[repo path, area, or performance question]"
---

# /engineering:complexity-report

Use the `complexity-report` module in this plugin's `engineering` skill.

1. Read `skills/engineering/complexity-report.md`.
2. Keep the pass read-only; this command creates the decision report, not the patch.
3. Treat `$ARGUMENTS` as the target repository, area, route, or performance concern. If no path is provided, use the current repository.
4. Return stable finding IDs so the user can pick one in a later turn.

User input: $ARGUMENTS
