import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Positive: ask what a past Codex session contained. Sibling session skill must not load.
export default defineEval({
  description: "codex-session loads for a Codex session UUID question; claude-session does not.",
  tags: ["live", "routing", "codex-session"],
  async test(t) {
    const turn = await t.send(
      "What did Codex session 0f3a9c22-0000-4000-8000-000000000000 decide about the auth rewrite?",
    )
    t.loadedSkill("codex-session")
    t.check(turn.toolCalls, notLoadedSkill("claude-session"))
  },
})
