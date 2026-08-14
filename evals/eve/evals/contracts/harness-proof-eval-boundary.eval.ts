import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

export default defineEval({
  description:
    "harness keeps repository proof rows separate from factory-owned agent evals.",
  tags: ["live", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Our SPEC_CONTRACT proof menu has rows for lint, typecheck, unit tests,",
        "and browser screenshots. Should Harness automatically turn every row",
        "into an agent eval case? Explain which side owns each responsibility.",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        const rejectsMapping = /not|shouldn.t|do not|no\b/i.test(reply)
        const proofOwner = /Harness|repository/i.test(reply) && /proof menu|validation/i.test(reply)
        const factoryOwner = /factory|Garage Band/i.test(reply) && /eval|grad|run/i.test(reply)
        return rejectsMapping && proofOwner && factoryOwner
      }, "rejects one-proof-row-per-eval and assigns proof and eval ownership"),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
