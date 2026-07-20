import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

// Contract (hexagon-audit/skills/hexagon-audit/SKILL.md:62-63): when the repo
// has no top-level `packages/` and `adapters/` directories the skill does not
// apply — it must SAY SO instead of guessing or fabricating a report.
export default defineEval({
  description: "hexagon-audit declines cleanly when packages/ + adapters/ are absent.",
  tags: ["live", "hexagon-audit", "contract"],
  async test(t) {
    await t.send(
      "Audit hexagonal boundaries in my repo. Its top level is just `src/`, " +
        "`tests/`, and `docs/` — there is no `packages/` or `adapters/` directory.",
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
  },
})
