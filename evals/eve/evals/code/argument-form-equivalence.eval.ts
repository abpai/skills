import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"

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
  // QUARANTINED 2026-07-30: noFailedActions fails on sandbox infrastructure
  // noise, not the contract — CI run 30513851355 flagged a glob tool call that
  // died on "rg: /proc/…: Permission denied" inside the Eve sandbox. The
  // routing gates themselves were green. The real fix is an infra-aware
  // failed-action gate. Run manually:
  //   bunx eve eval code/argument-form-equivalence
  tags: ["quarantine", "code", "routing"],
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
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
