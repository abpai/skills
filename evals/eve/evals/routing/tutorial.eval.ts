import { defineEval } from "eve/evals"
import { prompt } from "../support/text"

// Positive: hands-on, step-by-step guide with runnable checks at each step.
export default defineEval({
  description: "tutorial loads for a hands-on setup guide with runnable per-step checks.",
  tags: ["live", "routing", "tutorial"],
  async test(t) {
    await t.send(
      prompt(
        "Write a hands-on guide that teaches me to run Redis locally. Every step should",
        "end with something I can actually run to verify it worked.",
      ),
    )
    t.loadedSkill("tutorial")
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
