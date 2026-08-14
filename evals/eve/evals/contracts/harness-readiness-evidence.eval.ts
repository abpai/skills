import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Missing evidence remains unknown. Doctor does not manufacture an onboarding
// manifest, readiness score, or autonomous-ready assertion.
export default defineEval({
  description:
    "harness readiness output preserves unknown evidence and does not invent a second onboarding verdict.",
  tags: ["live", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Show how Harness should represent repository readiness when no Doctor",
        "scan or validation command has run and the revision, bootstrap, proof",
        "menu, safety boundaries, and parallel-worktree behavior are all",
        "unverified. This is a process question; do not inspect the current",
        "checkout or run tools.",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return /unknown/i.test(reply) && /nextAction|next action/i.test(reply)
      }, "represents missing evidence as unknowns with next actions"),
    )
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return !/readinessScore|autonomous-ready|D[1-7]\s*[:=]/i.test(reply)
      }, "does not invent a score, dimensions, or autonomous-ready verdict"),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
