import { defineEval } from "eve/evals"
import { loadedNoSkills } from "../support/loaded"
import { noFailedSkillLoads } from "../support/tools"

// Negative control: a plain factual question should load nothing at all.
// Stronger than notLoadedSkill — reserve usedNoTools / loadedNoSkills for this
// case only.
export default defineEval({
  description: "Plain factual question loads no skills.",
  tags: ["live", "routing", "negative"],
  async test(t) {
    const turn = await t.send("What year was the Python programming language first released?")
    t.succeeded()
    t.check(turn.events, loadedNoSkills())
    t.usedNoTools()
    // Every skill load resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.events, noFailedSkillLoads())
  },
})
