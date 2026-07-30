import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Negative control: light copyedit is explicitly out of scope for improve-prompt
// and is not a human-writer deslop request.
export default defineEval({
  description: "README typo fix does not load improve-prompt or human-writer.",
  // QUARANTINED 2026-07-30: the subject sometimes parks on a request for the
  // README's contents instead of finishing the turn, and the gates flap on
  // that variance rather than on routing behavior. Run manually:
  //   bunx eve eval routing/negatives-readme-typo
  tags: ["quarantine", "routing", "negative"],
  async test(t) {
    const turn = await t.send("Fix the typo on line 12 of the README.")
    t.succeeded()
    t.check(turn.toolCalls, notLoadedSkill("improve-prompt"))
    t.check(turn.toolCalls, notLoadedSkill("human-writer"))
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
