import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"
import { prompt } from "../support/text"

// Positive: sharpen a vague ask into a reusable prompt template.
export default defineEval({
  description: "improve-prompt loads for a reusable prompt-template ask; human-writer does not.",
  tags: ["live", "routing", "improve-prompt"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "I have a rough ask: 'review this PR carefully'. Turn it into a reusable",
        "code-review prompt template I can drop into future sessions.",
      ),
    )
    t.loadedSkill("improve-prompt")
    t.check(turn.toolCalls, notLoadedSkill("human-writer"))
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
