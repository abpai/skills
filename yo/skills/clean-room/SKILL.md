---
name: clean-room
disable-model-invocation: true
description: "Get an unbiased verdict on one decision from a fresh agent that never saw this conversation."
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  internal: true
---

# Clean room

This conversation has a point of view. Get a decision from an agent that does not share it.

1. Frame one decision. Keep whether to do something apart from how to do it.
2. Start a fresh agent, session, or thread that inherits none of this conversation: no fork, continuation, or handoff. Use the most capable isolated option available, especially when the decision is consequential or hard to reverse. Every rerun starts fresh and does not see earlier verdicts.
3. Write it a neutral brief: verified facts, fixed constraints, open questions, and enough direct evidence to check your summary, or a note that none exists beyond the stated facts. Leave out opinions, prior conclusions, and leading language. List the options in alphabetical order and treat them alike, adding "do nothing" last when there is a status quo to keep. Reread the brief: if a reader could guess the answer we hope for, rewrite it.
4. Ask the agent to think independently, challenge the premise, consider other options, gather missing facts from direct sources and label any claim it did not check, and look for evidence against its own conclusion. Require one verdict with reasons, the strongest opposing case, why that case loses, and what would change the verdict. Do not accept "it depends".
5. Return the verdict unchanged, even when it disagrees with you or me. If an unsupported assumption drives it, fix the brief and rerun with a new agent.
