import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"

export default defineEval({
  description:
    "status-update labels stale worker claims unverified instead of presenting them as active work.",
  tags: ["live", "status-update", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Give me a status update from this evidence only:",
        "- Yesterday a worker said it had started the migration.",
        "- There has been no terminal output, task update, commit, or runtime",
        "  evidence since then, and current state cannot be inspected.",
        "- The migration and its verification are still required.",
      ),
    )

    t.loadedSkill("status-update")
    t.check(turn.toolCalls, noWrites())
    t.check(turn.toolCalls, noFailedSkillLoads())
    t.check(
      t.reply,
      satisfies(
        (reply: unknown) => typeof reply === "string" && /unverified/i.test(reply),
        "reply marks the stale claim unverified",
      ),
    )
    t.check(
      t.reply,
      satisfies(
        (reply: unknown) =>
          typeof reply === "string" && !/active now[\s\S]{0,200}migration is (running|active)/i.test(reply),
        "reply does not promote the stale claim to active work",
      ),
    )
  },
})
