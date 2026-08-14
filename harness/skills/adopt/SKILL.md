---
name: adopt
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: "Route end-to-end repository adoption to the Harness workflow module."
argument-hint: "[repository preparation goal]"
---

# /harness:adopt

1. Read `../harness/adopt.md`.
2. Treat `$ARGUMENTS` as the repository preparation goal.
3. Follow the module and stop if it cannot be read.
4. Preserve the invariant: inspect, remediate, and re-run Doctor before
   claiming adoption is complete.

User input: $ARGUMENTS
