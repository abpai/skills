---
name: scope
disable-model-invocation: true
description: "Scope the work before it starts: goal, gap, worth it, done criteria, options, blast radius, stop rule."
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  internal: true
---

Before doing the work, inspect the relevant context and scope it in a short brief, in this order. It applies to any work: a bug, a feature, a decision, or a request to respond to.

1. **Goal.** The outcome in one sentence and who it is for. Add non-goals: what this work will not touch.
2. **Gap.** What stands between now and the goal, with evidence. For a defect, separate root cause from symptom. For a decision, name what must be decided and the constraints. Keep only gaps that block the goal.
3. **Worth it.** Expected payoff against cost, and an appetite: how much time or effort this deserves. Doing nothing is an option.
4. **Done means.** Pass/fail checks that someone other than the author could observe.
5. **Options.** The approach you recommend, the alternatives you rejected and why, then the specific changes or actions. Each one traces to a gap in step 2, or it is cut.
6. **Blast radius.** What else this touches, and what could break or be left unowned.
7. **Stop rule.** Stop when the checks in step 4 pass. New ideas go to a parking lot, not into this work. After two attempts that do not pass the checks, return to step 2 instead of trying a third. When the appetite is spent, return to step 3 instead of continuing. State these in the task's own terms.

Scale the brief to the task: for a small one, one line per step is enough, and a step with nothing to say gets "none". When a step cannot be filled from what you know, say what is missing instead of guessing; a blocked step is a finding. Do not start the work in this response. End with what you need from me, if anything, and ask whether I agree. Once I agree, hold the work to this brief and apply the stop rule.
