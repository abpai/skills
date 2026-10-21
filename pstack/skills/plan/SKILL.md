---
name: plan
description: Research a task and produce a concise pstack plan.
disable-model-invocation: true
user-invocable: false
argument-hint: "[task]"
metadata:
  internal: true
---

Read `../pstack/plan.md` and follow it for `$ARGUMENTS` or the current task.
If neither supplies a task, ask for one. If the file cannot be read, report it
and stop.
