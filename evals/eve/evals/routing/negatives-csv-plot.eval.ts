import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Negative control: a CSV + bar-chart ask must NOT pull architecture/thinking skills.
export default defineEval({
  description: "CSV plot request does not load hexagon-audit, distill, or lateral-thinking.",
  tags: ["live", "routing", "negative"],
  async test(t) {
    const turn = await t.send("Read sales.csv and plot a bar chart of revenue by month.")
    t.succeeded()
    t.check(turn.toolCalls, notLoadedSkill("hexagon-audit"))
    t.check(turn.toolCalls, notLoadedSkill("distill"))
    t.check(turn.toolCalls, notLoadedSkill("lateral-thinking"))
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
