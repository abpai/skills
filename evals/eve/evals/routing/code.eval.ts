import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"
import { prompt } from "../support/text"

// Positive: natural intent for the code umbrella (understand workflow). Sibling
// umbrellas must not load. Intentionally no t.succeeded(): with an empty
// sandbox the skill correctly parks to ask for a code path — routing already
// happened (loadedSkill). Grade the load action, not turn completion.
export default defineEval({
  description: "code loads for an HTML code-map + runnable-snippet request; sibling umbrellas do not.",
  tags: ["live", "routing", "code"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "I want the code pack's understand workflow for the checkout payment",
        "confirmation path — an HTML code map plus a runnable snippet that imports real code.",
      ),
    )
    t.loadedSkill("code")
    t.check(turn.toolCalls, notLoadedSkill("engineering"))
    t.check(turn.toolCalls, notLoadedSkill("harness"))
  },
})
