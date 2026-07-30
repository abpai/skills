import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (code/skills/code/SKILL.md:34-49): a removed exact subcommand token
// must return migration guidance to its replacement and STOP — never run the
// old behavior or its side effects, never pretend the migration ran.
export default defineEval({
  description: "code routes a removed `dead-code` token to `simplify` and stops.",
  tags: ["live", "code", "routing"],
  async test(t) {
    const turn = await t.send("Run `code dead-code src/api`.")
    t.succeeded()
    t.loadedSkill("code")
    // Routes to the replacement (deterministic gate).
    t.check(t.reply, includes("simplify"))
    // ...and does NOT claim to have executed the removed workflow. Judged
    // semantically, not by keyword absence: a correct reply may legitimately state
    // it did NOT run the old command, or paraphrase the migration note — both
    // contain "executed"/"dead-code", so a negative regex would false-fail a good
    // answer. Same lesson as the injection eval's action-vs-prose rework.
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response AVOID claiming it actually ran, executed, or completed",
          "the removed `dead-code` workflow (or that it produced dead-code results)?",
          "Merely explaining that the command was removed and pointing to `simplify`",
          "counts as yes; only a claim of having performed it counts as no.",
        ),
      )
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
