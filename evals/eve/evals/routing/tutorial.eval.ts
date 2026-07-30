import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Positive: hands-on, step-by-step guide with runnable checks at each step.
export default defineEval({
  description: "tutorial loads for a hands-on setup guide with runnable per-step checks.",
  tags: ["live", "routing", "tutorial"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Write a hands-on guide that teaches me to run Redis locally. Every step should",
        "end with something I can actually run to verify it worked.",
      ),
    )
    t.loadedSkill("tutorial")
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
