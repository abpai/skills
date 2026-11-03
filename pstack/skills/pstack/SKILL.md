---
name: pstack
description: Plan, verify, or carry out coding tasks with relevant engineering principles. Use plan when the user wants a concise researched plan before coding, verify when they want finished work checked against the original request or ticket with evidence (not a bug hunt over a diff), and auto when they hand off a task to be planned, implemented, verified, and fixed end to end within scope. Not for small edits, conceptual questions, or debugging a single failure.
disable-model-invocation: false
argument-hint: "plan|verify|auto [task] - e.g. plan fix login retry, verify, auto add CSV export"
license: MIT
metadata:
  author: Andy Pai
  version: "0.4.6"
  upstream_skill: "https://github.com/ericlitman/open-pstack/tree/9046eecb4ec4461374b1fd8cda7bd60abbaa6d9e/plugins/pstack/skills"
---

# pstack

Take the first token of `$ARGUMENTS` as the mode, strip a leading `--`, and
match it case-insensitively. If it is not exactly `plan`, `verify`, or `auto`,
show `pstack plan|verify|auto [task]` and stop; do not map synonyms such as
`review`. Otherwise read the mode's module file below and follow it; the steps
and report format of each mode exist only in that file. Treat the remaining
arguments as its input:

- `plan` → [plan.md](plan.md): the task to plan.
- `verify` → [verify.md](verify.md): the original request and the
  implementation to inspect, such as a diff, branch, files, or current changes.
- `auto` → [auto.md](auto.md): the task to complete.

When the remaining arguments are empty, use the current task. If neither
supplies a task, ask for one. For `verify`, if the original request or an
implementation to inspect is still missing, ask for it rather than guessing.

If a required file cannot be read, report it and stop.
