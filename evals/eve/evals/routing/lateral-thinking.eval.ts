import { defineEval } from "eve/evals"
import { notLoadedSkill } from "../support/loaded"

// Positive: stuck in local optima / cross-domain ideas → lateral-thinking.
// Prompt embeds a concrete problem skeleton so the model does not (a) park to
// ask for details or (b) load distill first "because the system is unclear."
export default defineEval({
  description: "lateral-thinking loads when stuck with failing obvious fixes; distill does not.",
  tags: ["live", "routing", "lateral-thinking"],
  async test(t) {
    const turn = await t.send(
      "The checkout inventory-reservation job is well understood: it locks stock " +
        "rows, calls the payment API, then commits. Under flash-sale load the locks " +
        "pile up, payments time out, and we retry — which makes lock contention worse. " +
        "We've already tried shorter lock TTLs, more retries with jitter, and a bigger " +
        "Redis cache in front of inventory reads; all three failed the same way. " +
        "Don't compress the architecture — generate non-obvious cross-domain hypotheses " +
        "for the underlying mechanism.",
    )
    t.loadedSkill("lateral-thinking")
    t.check(turn.toolCalls, notLoadedSkill("distill"))
  },
})
