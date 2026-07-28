import { defineEval } from "eve/evals"

// Negative control: a plain factual question should load nothing at all.
// Stronger than notLoadedSkill — reserve usedNoTools / notCalledTool(load_skill)
// for this case only.
export default defineEval({
  description: "Plain factual question loads no skills.",
  tags: ["live", "routing", "negative"],
  async test(t) {
    await t.send("What year was the Python programming language first released?")
    t.succeeded()
    t.notCalledTool("load_skill")
    t.usedNoTools()
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
