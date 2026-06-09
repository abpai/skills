---
name: review
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Run strict read-only Cursor Composer review on a diff or PR.
argument-hint: "[diff scope, PR URL/number, or model hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill. The Composer umbrella
# carries the union allowlist used by the routed /composer review workflow.
---

# /composer:review

Use the `review` module.

1. Read the review module: `../composer/review.md` when installed as this
   command wrapper, or `composer/skills/composer/review.md` in the repo.
2. Resolve the review target and prepare a strict read-only review prompt.
3. Run Composer review, verify findings, and return a findings-first verdict.
4. Keep the review read-only — Composer never writes. The write-capable tools
   above are reserved for a separate phase that runs only if the user explicitly
   asked to improve, update, or merge. In that case do those steps yourself
   after review; refresh against the current base and verify mergeability first.

User input: $ARGUMENTS
