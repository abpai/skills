import { defineEval } from "eve/evals"

// Positive: triage many similar keep/cut items one-by-one with evidence.
// Items are inlined so the skill does not park asking for the list.
// No t.succeeded(): worksheet skills may still ask one setup question.
export default defineEval({
  description: "decision-worksheet loads for a multi-item keep/cut triage worksheet.",
  tags: ["live", "routing", "decision-worksheet"],
  async test(t) {
    await t.send(
      "Build me a keep/cut decision worksheet for these newsletters (rationale + evidence " +
        "per item): Stratechery, The Diff, Dense Discovery, TLDR, Morning Brew, " +
        "Bytes.dev, Pointer, Sidebar, Javascript Weekly, Python Weekly. " +
        "I have about thirty more in the same vein — same worksheet shape.",
    )
    t.loadedSkill("decision-worksheet")
  },
})
