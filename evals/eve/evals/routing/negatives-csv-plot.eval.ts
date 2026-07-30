import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { notLoadedSkill } from "../support/loaded"
import { noFailedSkillLoads } from "../support/tools"

// Negative control: a CSV + bar-chart ask must NOT pull architecture/thinking skills.
export default defineEval({
  description: "CSV plot request does not load hexagon-audit, distill, or lateral-thinking.",
  tags: ["live", "routing", "negative"],
  async test(t) {
    const turn = await t.send("Read sales.csv and plot a bar chart of revenue by month.")
    // Parking is legitimate here: sales.csv does not exist in the sandbox, so
    // asking the user for it is correct behavior (CI run 30514699398 parked on
    // exactly that). The contract under test is only which skills load, and
    // the routing decision is made before any parking. Guard against hard
    // failure, not against parking.
    t.check(
      turn.status,
      satisfies((s: unknown) => s !== "failed", "run completed or parked, not failed"),
    )
    t.check(turn.toolCalls, notLoadedSkill("hexagon-audit"))
    t.check(turn.toolCalls, notLoadedSkill("distill"))
    t.check(turn.toolCalls, notLoadedSkill("lateral-thinking"))
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
