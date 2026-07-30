import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Positive: ask what a past Claude session decided. Sibling session skill must not load.
export default defineEval({
  description: "claude-session loads for a Claude session UUID question; codex-session does not.",
  tags: ["live", "routing", "claude-session"],
  async test(t) {
    const turn = await t.send(
      "Summarize what my Claude session a1b2c3d4-0000-4000-8000-000000000001 decided about the migration.",
    )
    t.loadedSkill("claude-session")
    t.check(turn.toolCalls, notLoadedSkill("codex-session"))
  },
})
