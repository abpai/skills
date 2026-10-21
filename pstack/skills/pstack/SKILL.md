---
name: pstack
description: Plan, verify, or carry out coding tasks with relevant engineering principles. Use plan for a concise researched plan, verify for an evidence-backed review of an implementation against the original request, and auto to plan, implement, verify, and fix within scope.
disable-model-invocation: true
argument-hint: "plan|verify|auto [task] - e.g. plan fix login retry, verify, auto add CSV export"
license: MIT
metadata:
  author: Andy Pai
  version: "0.4.0"
  upstream_skill: "https://github.com/ericlitman/open-pstack/tree/9046eecb4ec4461374b1fd8cda7bd60abbaa6d9e/plugins/pstack/skills"
---

# pstack

Take the first token of `$ARGUMENTS` as the mode, strip a leading `--`, and
match it case-insensitively. Load the sibling module and treat the remaining
arguments as its input:

- `plan` → [plan.md](plan.md): the task to plan.
- `verify` → [verify.md](verify.md): the original request and the
  implementation to inspect, such as a diff, branch, files, or current changes.
- `auto` → [auto.md](auto.md): the task to complete.

When the remaining arguments are empty, use the current task. If neither
supplies a task, ask for one. For `verify`, if the original request or an
implementation to inspect is still missing, ask for it rather than guessing.

With no mode or an unsupported mode, show `pstack plan|verify|auto [task]`.
If a required file cannot be read, report it and stop.
