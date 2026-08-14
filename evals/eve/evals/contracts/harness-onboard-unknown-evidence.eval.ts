import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (harness/skills/harness/onboard.md, "2. Derive the manifest fields"
// and FACTORY_HANDOFFS.md): unavailable audit evidence stays null/unknown and
// receives a gap. It must not be converted into false, none, empty strings, or
// empty arrays, which would assert a negative finding that the audit never made.
export default defineEval({
  description:
    "harness onboard preserves unknown evidence in provisional factory handoffs instead of fabricating concrete negative or empty values.",
  tags: ["live", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Show a compact provisional harness onboard manifest excerpt for a",
        "repository where no factory reader or schema version policy exists",
        "and no doctor dimensions, allowed refs, bootstrap, proof menu, human",
        "gates, safety posture, or parallel-safety fields have been reviewed.",
        "Do not run an audit. I only need to see how those unavailable values",
        "should be represented today.",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        const fabricated = [
          /secretsExposedToAgent\s*[:=]\s*false/i,
          /writeScopeBounded\s*[:=]\s*false/i,
          /freshWorktreeSafe\s*[:=]\s*false/i,
          /allowedRefs\s*[:=]\s*\[\s*\]/i,
          /healthSmoke\s*[:=]\s*["']{2}/i,
          /humanGates\s*[:=]\s*\[\s*\]/i,
        ]
        return !fabricated.some((pattern) => pattern.test(r))
      }, "does not turn unreviewed fields into false, empty strings, or empty arrays"),
    )
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        return (
          /schemaVersion\s*[:=]\s*null/i.test(r) &&
          /reviewedWeight\s*[:=]\s*null/i.test(r) &&
          /secretsExposedToAgent\s*[:=]\s*null/i.test(r) &&
          /productionDataReach\s*[:=]\s*["']?unknown/i.test(r)
        )
      }, "uses explicit null or unknown states for unavailable proposal and audit evidence"),
    )
    t.judge.autoevals.closedQA(
      prompt(
        "Does the response clearly say the handoff is provisional and",
        "non-consumable, represent unreviewed values as null or unknown, and",
        "list missing evidence as gaps instead of claiming negative findings?",
      ),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
