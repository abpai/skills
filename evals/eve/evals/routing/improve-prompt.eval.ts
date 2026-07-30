import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Positive: sharpen a vague ask into a reusable prompt template.
export default defineEval({
  description: "improve-prompt loads for a reusable prompt-template ask; human-writer does not.",
  tags: ["live", "routing", "improve-prompt"],
  async test(t) {
    const turn = await t.send(
      "I have a rough ask: 'review this PR carefully'. Turn it into a reusable " +
        "code-review prompt template I can drop into future sessions.",
    )
    t.loadedSkill("improve-prompt")
    t.check(turn.toolCalls, notLoadedSkill("human-writer"))
  },
})
