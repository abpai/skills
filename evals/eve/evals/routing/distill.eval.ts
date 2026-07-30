import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Positive: compress a system to essential primitives (distill), not a line-by-line tour.
export default defineEval({
  description: "distill loads for a compressed mental-model request; lateral-thinking does not.",
  tags: ["live", "routing", "distill"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Compress our payment-orchestration service down to the essential primitives",
        "I need to hold in my head — not a file-by-file walkthrough.",
      ),
    )
    t.loadedSkill("distill")
    t.check(turn.toolCalls, notLoadedSkill("lateral-thinking"))
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
