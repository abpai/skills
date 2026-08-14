import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

export default defineEval({
  description:
    "improve-prompt preserves deliberate placeholders and does not invent precision.",
  tags: ["live", "improve-prompt", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Improve this reusable prompt without filling unknown values:",
        "'Recommend a rollout plan for [TEAM_NAME]. Keep [RISK_LIMIT] as a",
        "placeholder because each team chooses it. Do not invent percentages or",
        "success metrics. Return the plan, assumptions, risks, and next decision.'",
      ),
    )

    t.loadedSkill("improve-prompt")
    t.check(turn.toolCalls, noFailedSkillLoads())
    t.check(
      t.reply,
      satisfies(
        (reply: unknown) =>
          typeof reply === "string" && reply.includes("[TEAM_NAME]") && reply.includes("[RISK_LIMIT]"),
        "reply preserves both deliberate placeholders",
      ),
    )
    t.check(
      t.reply,
      satisfies(
        (reply: unknown) => typeof reply === "string" && !/\b\d+(?:\.\d+)?%/.test(reply),
        "reply does not invent a percentage",
      ),
    )
  },
})
