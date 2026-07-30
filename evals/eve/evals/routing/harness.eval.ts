import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Positive: agent-harness readiness / first-audit intent → harness umbrella.
export default defineEval({
  description: "harness loads for an agent-readiness first audit; engineering/code do not.",
  tags: ["live", "routing", "harness"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Walk me through a first audit of this repo's agent harness — what should",
        "I fix so coding agents can work here reliably?",
      ),
    )
    t.loadedSkill("harness")
    t.check(turn.toolCalls, notLoadedSkill("engineering"))
    t.check(turn.toolCalls, notLoadedSkill("code"))
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
