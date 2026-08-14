import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

export default defineEval({
  description:
    "harness adopt assess performs a read-only readiness gap analysis without creating adoption artifacts.",
  tags: ["live", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "I want to assess whether an existing production repo is ready for",
        "Harness adoption, but this pass must be read-only. Which Harness mode",
        "should I use, and what must it stop before doing? This is a process",
        "question; do not inspect or edit the current checkout.",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return /adopt assess/i.test(reply) && /read[-\s]?only/i.test(reply) && /do not|without|stop before/i.test(reply)
      }, "routes to adopt assess and preserves the read-only boundary"),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
