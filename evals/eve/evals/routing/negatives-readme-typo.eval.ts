import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { notLoadedSkill } from "../support/loaded"
import { noFailedSkillLoads } from "../support/tools"

// Negative control: light copyedit is explicitly out of scope for improve-prompt
// and is not a human-writer deslop request.
export default defineEval({
  description: "README typo fix does not load improve-prompt or human-writer.",
  // Back in the live lane 2026-07-30: its flake was the subject parking on a
  // request for the (absent) README, which the success gate now tolerates —
  // routing is decided before any parking.
  tags: ["live", "routing", "negative"],
  async test(t) {
    const turn = await t.send("Fix the typo on line 12 of the README.")
    // Parking is legitimate here: there is no README in the sandbox, so asking
    // for it is correct behavior. The contract under test is only which skills
    // load. Guard against hard failure, not against parking.
    t.check(
      turn.status,
      satisfies((s: unknown) => s !== "failed", "run completed or parked, not failed"),
    )
    t.check(turn.toolCalls, notLoadedSkill("improve-prompt"))
    t.check(turn.toolCalls, notLoadedSkill("human-writer"))
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
