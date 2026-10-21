---
name: pstack
description: Research a coding task, select relevant principles, and write a concise implementation plan.
disable-model-invocation: true
argument-hint: "plan [task]"
license: MIT
metadata:
  author: Andy Pai
  version: "0.3.1"
  upstream_skill: "https://github.com/ericlitman/open-pstack/tree/9046eecb4ec4461374b1fd8cda7bd60abbaa6d9e/plugins/pstack/skills"
---

# pstack

Read the first argument as the mode, stripping an optional `--` prefix.
For `plan`, read [plan.md](plan.md) and use the remaining arguments or the
current task as the request. If neither supplies a task, ask for one.

With no mode or an unsupported mode, show `pstack plan [task]`.
If a required file cannot be read, report it and stop.
