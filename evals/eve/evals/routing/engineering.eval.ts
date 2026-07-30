import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"
import { prompt } from "../support/text"

// Positive: stress-test a plan before building (grill-me via engineering).
// No t.succeeded(): grill-me's contract is to ask design questions, which parks
// the turn on an input request — that is correct skill behavior, not a routing miss.
export default defineEval({
  description: "engineering loads to stress-test a plan; code/harness do not.",
  tags: ["live", "routing", "engineering"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Stress-test this plan before I build it: we'll put the billing webhook",
        "handler in the same process as the public API and share its DB pool.",
      ),
    )
    t.loadedSkill("engineering")
    t.check(turn.toolCalls, notLoadedSkill("harness"))
    t.check(turn.toolCalls, notLoadedSkill("code"))
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
