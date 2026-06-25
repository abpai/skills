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

Hidden wrapper for the `review` subcommand. Load the module and pass through
the user input.

1. Read the sibling module `../composer/review.md`.
2. Treat `$ARGUMENTS` as the diff scope, PR URL/number, or model hint.
3. Follow the module's workflow and stop if the module cannot be read.
4. Return a findings-first verdict after verifying Composer's findings.
5. Keep the review read-only — Composer never writes. The write-capable tools
   above are reserved for a separate phase that runs only if the user explicitly
   asked to improve, update, or merge. In that case do those steps yourself
   after review; refresh against the current base and verify mergeability first.

User input: $ARGUMENTS
