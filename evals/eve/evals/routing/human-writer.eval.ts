import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"
import { prompt } from "../support/text"

// Positive: make AI-sounding prose sound human. Not improve-prompt (prompt crafting).
export default defineEval({
  description: "human-writer loads to deslop AI-sounding prose; improve-prompt does not.",
  tags: ["live", "routing", "human-writer"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "This blog draft sounds like a model wrote it — generic and over-polished.",
        "Rewrite it so it reads like a specific person wrote it.",
      ),
    )
    t.loadedSkill("human-writer")
    t.check(turn.toolCalls, notLoadedSkill("improve-prompt"))
  },
})
