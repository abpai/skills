import { defineEval } from "eve/evals"

// Positive: hands-on, step-by-step guide with runnable checks at each step.
export default defineEval({
  description: "tutorial loads for a hands-on setup guide with runnable per-step checks.",
  tags: ["live", "routing", "tutorial"],
  async test(t) {
    await t.send(
      "Write a hands-on guide that teaches me to run Redis locally. Every step should " +
        "end with something I can actually run to verify it worked.",
    )
    t.loadedSkill("tutorial")
  },
})
