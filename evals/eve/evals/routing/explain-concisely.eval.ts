import { defineEval } from "eve/evals"

// Positive: concise / low-cognitive-load rewrite of a long explanation.
export default defineEval({
  description: "explain-concisely loads for an action-first, scannable rewrite.",
  tags: ["live", "routing", "explain-concisely"],
  async test(t) {
    await t.send(
      "I have a long debugging writeup. Rewrite it into a brief, action-first answer " +
        "I can scan quickly without losing the safety warnings.",
    )
    t.loadedSkill("explain-concisely")
  },
})
