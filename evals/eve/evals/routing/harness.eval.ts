import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Positive: agent-harness readiness / first-audit intent → harness umbrella.
export default defineEval({
  description: "harness loads for an agent-readiness first audit; engineering/code do not.",
  tags: ["live", "routing", "harness"],
  async test(t) {
    const turn = await t.send(
      "Walk me through a first audit of this repo's agent harness — what should " +
        "I fix so coding agents can work here reliably?",
    )
    t.loadedSkill("harness")
    t.check(turn.toolCalls, notLoadedSkill("engineering"))
    t.check(turn.toolCalls, notLoadedSkill("code"))
  },
})
