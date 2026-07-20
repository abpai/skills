import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"

// Contract (code/skills/code/SKILL.md:34-49): a removed exact subcommand token
// must return migration guidance to its replacement and STOP — never run the
// old behavior or its side effects, never pretend the migration ran.
export default defineEval({
  description: "code routes a removed `dead-code` token to `simplify` and stops.",
  tags: ["live", "code", "routing"],
  async test(t) {
    await t.send("Run `code dead-code src/api`.")
    t.succeeded()
    t.loadedSkill("code")
    // Routes to the replacement...
    t.check(t.reply, includes("simplify"))
    // ...and does NOT claim to have executed the removed workflow.
    t.check(
      t.reply,
      satisfies(
        (r: unknown) =>
          typeof r === "string" &&
          !/\bran\b|executed|completed the|dead[- ]code (report|analysis)/i.test(r),
        "does not claim the removed dead-code workflow ran",
      ),
    )
  },
})
