import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

export default defineEval({
  description:
    "harness adopt composes baseline, concise guidance, reproducible execution, and a final Doctor result without skipping the human behavior gate.",
  tags: ["live", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "We have an existing production repository and want to make it ready",
        "for our software factory. Describe the Harness workflow and its human",
        "gate. This is a process question; do not inspect or edit this checkout.",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return (
          /adopt/i.test(reply) &&
          /baseline|behavior inventory/i.test(reply) &&
          /human.{0,30}(ratif|confirm|review)/i.test(reply) &&
          /proof menu|spec contract/i.test(reply) &&
          /doctor/i.test(reply)
        )
      }, "describes the adoption lifecycle and its human baseline gate"),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
