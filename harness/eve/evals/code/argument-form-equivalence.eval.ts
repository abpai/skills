import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"

// Contract (code/skills/code/SKILL.md:32): the router strips a leading `--`, so
// `code --understand X` and `code understand X` resolve to the same workflow
// with the same remaining args. Two independent sessions, same routing.
export default defineEval({
  description: "code treats `--understand` and `understand` as the same route.",
  tags: ["live", "code", "routing"],
  async test(t) {
    const plain = await t.send("Run `code understand src/api`.")
    t.succeeded()
    t.loadedSkill("code")
    t.check(plain.message, includes("understand"))

    const dashed = t.newSession()
    const dashedTurn = await dashed.send("Run `code --understand src/api`.")
    dashed.succeeded()
    dashed.loadedSkill("code")
    t.check(dashedTurn.message, includes("understand"))
  },
})
