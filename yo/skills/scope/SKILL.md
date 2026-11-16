---
name: scope
disable-model-invocation: true
description: "Scope the work before it starts: ask me the key questions, each with a recommended answer, and build a Goal / Problems / Solutions / Validations / Impact outline."
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  internal: true
---

Before doing the work, inspect the relevant context, then help me scope it with this outline. It applies to any work: a bug, a feature, a decision, or a request to respond to.

```
# Goal
## Problems
## Solutions
### Big picture
### Specific changes
## Validations
## Impact
```

What each section holds:

- **Goal.** The outcome in one sentence, and who it is for.
- **Problems.** What stands between now and the goal, with evidence. For a defect, the root cause and not the symptom.
- **Big picture.** The approach, and the main alternative you would turn down.
- **Specific changes.** The concrete changes or actions. Each one answers a problem above, or it is cut.
- **Validations.** Pass/fail checks that someone other than the author could observe.
- **Impact.** What gets better if this works, and what else it touches or could break.

Scoping is a conversation, and the calls are mine. Under each section, write what the context already settles as a plain statement. Where a section turns on a choice that is mine to make, ask it as a question in that section instead of deciding it for me. Give every question your recommended answer and a one-line reason, so I can reply "yes" or correct it. Put each question in the section where it first matters, after that section's statements, and number the questions across the whole outline so I can answer by number.

Ask only the questions whose answer would change the outline. A section the context fully settles gets no question; a section you cannot fill gets a question, not a guess. Keep the outline short enough to read in a minute: a few lines per section, and one line where one line says it.

Do not start the work in this response. When I have answered, return the finished outline with my answers folded in and no open questions, then wait for my go-ahead.
