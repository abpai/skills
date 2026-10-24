import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import { noReadMatching, principlesIn } from "../support/pstack"

// Contract (SKILL.md): with no task in the arguments and none in the
// conversation, "ask for one". A fresh session with an empty workspace has no
// current task, so pstack must ask instead of inventing a task, planning the
// empty workspace, or selecting principles.
//
// Eve offers an `ask_question` tool, and a model that uses it parks the run on
// an input request instead of replying — that is asking too. So the gate
// accepts either form: a parked question or a reply that asks. `t.succeeded()`
// is not asserted because a parked run is the correct outcome here.
export default defineEval({
  description: "bare pstack plan with no task anywhere asks for the task.",
  tags: ["live", "pstack", "routing"],
  async test(t) {
    const turn = await t.send("pstack plan")
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())
    t.check(turn.status, satisfies((s: unknown) => s !== "failed", "turn did not fail"))

    const asked = [turn.message ?? "", ...turn.inputRequests.map((r) => r.prompt)]
    t.check(
      asked,
      satisfies(
        (texts: unknown) =>
          (texts as string[]).some((text) => /\?/.test(text) && /\btask\b|plan\b/i.test(text)),
        "asks for the task (reply or ask_question)",
      ),
    )
    t.check(
      asked.join("\n"),
      satisfies(
        (text: unknown) => typeof text === "string" && principlesIn(text).length === 0,
        "selects no principles without a task",
      ),
    )
    t.check(turn.toolCalls, noReadMatching(/principles\/principle-/, "read no principle files"))
    t.check(turn.toolCalls, noWrites())
  },
})
