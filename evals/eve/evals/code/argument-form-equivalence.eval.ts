import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"
import { noFailedSkillLoads } from "../support/tools"

// Contract (code/skills/code/SKILL.md:32): the router strips a leading `--`, so
// `code --understand X` and `code understand X` resolve to the same workflow
// with the same remaining args. Two independent sessions, same routing.
//
// NOTE: intentionally smoke-level. It proves both forms load `code` and surface
// the `understand` route, but does not yet prove route *equivalence* in detail.
// A stricter check (asserting the route-specific `.understand/<topic>/` output
// path in both replies) waits for the first live run to establish the model's
// actual routing reply shape — asserting a token the model may not emit would
// only trade a weak check for a false-fail.
export default defineEval({
  description: "code treats `--understand` and `understand` as the same route.",
  // Back in the live lane 2026-07-30: its one flake (CI run 30513851355) was
  // the blanket failed-action gate dying on sandbox noise ("rg: /proc/…:
  // Permission denied"), replaced suite-wide by noFailedSkillLoads.
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
    // Every load_skill call resolved, in both sessions. The blanket
    // noFailedActions gate this replaces graded sandbox probe noise — see
    // noFailedSkillLoads in support/tools.
    t.check(plain.toolCalls, noFailedSkillLoads())
    t.check(dashedTurn.toolCalls, noFailedSkillLoads())
  },
})
