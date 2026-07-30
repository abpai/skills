import { defineEval } from "eve/evals"
import { noFailedSkillLoads } from "../support/tools"

// Negative control: a plain factual question should load nothing at all.
// Stronger than notLoadedSkill — reserve usedNoTools / notCalledTool(load_skill)
// for this case only.
export default defineEval({
  description: "Plain factual question loads no skills.",
  tags: ["live", "routing", "negative"],
  async test(t) {
    const turn = await t.send("What year was the Python programming language first released?")
    t.succeeded()
    t.notCalledTool("load_skill")
    t.usedNoTools()
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
