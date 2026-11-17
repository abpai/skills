---
name: scope
disable-model-invocation: true
description: "Scope the work before it starts: ask me the key questions, each with a recommended answer, and build a Goal / Gap / Approach / Proof / Impact outline."
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  internal: true
---

Before doing the work, inspect the relevant context, then help me scope it with this outline. It applies to any work: a bug, a feature, a decision, or a request to respond to.

```
# Goal
## Gap
## Approach
## Proof
## Impact
```

What each section holds:

- **Goal.** The outcome in one sentence, and who it is for.
- **Gap.** The evidence that the goal is not met today: what you observed, measured, or were told. For a defect, the root cause and not the symptom.
- **Approach.** The big picture in a sentence or two, then a few short bullets on how we close the gap. Each bullet answers something in the Gap, or it is cut. Say what will change and why, and stop there: files, functions, and step order are worked out after scoping, by whoever does the work. Name an alternative you would turn down only when the choice is a real one.
- **Proof.** How we will know the work was done right: the checks to run and the evidence to show, which someone other than the author could observe.
- **Impact.** How we will know the goal was met: the result, with a number and a target where one exists ("CI time down 10%"), and anything else the work touches or could break. If the result can be measured but has not been yet, name the measurement to take first. Not every result can be measured. When this one cannot, say so and name the judgment that stands in for a number: who decides, and what they would accept.

Scoping is a conversation, and the calls are mine. Under each section, write what the context already settles as a plain statement. Where a section turns on a choice that is mine to make, ask it as a question in that section instead of deciding it for me. Give every question your recommended answer and a one-line reason, so I can reply "yes" or correct it. Write the statements around a question as if I will accept your recommendation. Put each question in the section where it first matters, after that section's statements, and number the questions across the whole outline so I can answer by number.

Ask only the questions whose answer would change the outline. A section the context fully settles gets no question; a section you cannot fill gets a question, not a guess. Keep the outline short enough to read in a minute: a few lines per section, and one line where one line says it.

Do not start the work in this response. When I have answered, return the finished outline with my answers folded in and no open questions, then wait for my go-ahead.
