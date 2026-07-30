import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (hexagon-audit/skills/hexagon-audit/SKILL.md:62-63): when the repo
// has no top-level `packages/` and `adapters/` directories the skill does not
// apply — it must SAY SO instead of guessing or fabricating a report.
export default defineEval({
  description: "hexagon-audit declines cleanly when packages/ + adapters/ are absent.",
  // QUARANTINED 2026-07-30: the non-applicability gate is a phrasing regex,
  // and the model periodically declines in words the regex does not cover
  // (failed CI run 30513482849 with the skill text unchanged). Still an
  // ablation detector via ablations/manifest.ts, which runs it by id. Run
  // manually: bunx eve eval contracts/hexagon-not-applicable
  tags: ["quarantine", "hexagon-audit", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Audit hexagonal boundaries in my repo. Its top level is just `src/`,",
        "`tests/`, and `docs/` — there is no `packages/` or `adapters/` directory.",
      ),
    )
    t.succeeded()
    t.loadedSkill("hexagon-audit")
    // States non-applicability rather than inventing violations.
    t.check(
      t.reply,
      satisfies(
        (r: unknown) =>
          typeof r === "string" && /(does not apply|not applicable|doesn't apply|no `?packages)/i.test(r),
        "states the skill does not apply to a non packages/adapters repo",
      ),
    )
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
