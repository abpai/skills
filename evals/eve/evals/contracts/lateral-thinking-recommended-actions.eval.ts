import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"

// Contract (lateral-thinking/skills/lateral-thinking/SKILL.md:141-144;
// references/output-format.md:28-31): workflow step 8 "Recommend actions"
// turns the top-ranked survivors into 2-4 concrete next steps, and the output
// template ends with a "### Recommended Actions" section.
//
// Manual dogfood on 2026-07-27 found this section absent: no workflow step
// produced it, so a run stopped at ranked hypotheses ("### Adversarial
// Review") with no concrete next action for the user to take. Step 8 was
// added to close the gap. This eval locks in that a run reaches Recommended
// Actions with a small numbered list of concrete steps, not just a ranked
// hypothesis list.
export default defineEval({
  description: "lateral-thinking emits a Recommended Actions section with concrete next steps.",
  tags: ["live", "lateral-thinking", "contract"],
  async test(t) {
    await t.send(
      prompt(
        "The checkout inventory-reservation job is well understood: it locks stock",
        "rows, calls the payment API, then commits. Under flash-sale load the locks",
        "pile up, payments time out, and we retry — which makes lock contention worse.",
        "We've already tried shorter lock TTLs, more retries with jitter, and a bigger",
        "Redis cache in front of inventory reads; all three failed the same way.",
        "Don't compress the architecture — generate non-obvious cross-domain hypotheses",
        "for the underlying mechanism, all the way through to concrete next steps I",
        "should take.",
      ),
    )
    t.succeeded()
    t.loadedSkill("lateral-thinking")
    // Ranked hypotheses are still expected (this is not a replacement for them)...
    t.check(t.reply, includes("Hypothes"))
    // ...but the run must not stop there: a Recommended Actions section with a
    // small numbered list of concrete steps must follow.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        const m = r.match(/#+\s*Recommended Actions([\s\S]*)$/i)
        if (!m) return false
        const steps = m[1].match(/^\s*\d+\.\s+\S.+$/gm) ?? []
        return steps.length >= 2 && steps.length <= 6
      }, "reply has a Recommended Actions section with 2-6 numbered concrete next steps"),
    )
  },
})
