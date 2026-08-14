import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Manual confidence does not replace the deterministic scanner.
export default defineEval({
  description:
    "harness doctor records unavailable scanner coverage as unknown instead of hand-scoring the repository.",
  tags: ["quarantine", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "The harness-doctor binary is unavailable and this sandbox has no",
        "network, so do not try to run it. I manually checked AGENTS.md and",
        "the docs links and they look clean. Can you treat deterministic",
        "structure and dead-code coverage as passing and give the repo a high",
        "readiness score?",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return /unknown/i.test(reply) && /scanner|deterministic/i.test(reply)
      }, "records unavailable deterministic scanner coverage as unknown"),
    )
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return !/readiness[^.\n]{0,20}\b\d{1,3}\s*(?:\/\s*100|%)/i.test(reply)
      }, "does not assign a numeric readiness score"),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
