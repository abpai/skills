import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  captureState,
  checkUnchanged,
  didNotRun,
  noReadMatching,
  packRepo,
  principlesIn,
  seedRepo,
} from "../support/pstack"

// Contract (SKILL.md): "With no mode or an unsupported mode, show
// `pstack plan|verify|auto [task]`." `review` is not a mode.
//
// Fixture pstack-v05-pagekit-slugs carries an uncommitted slugify change, so
// reviewing it anyway is the tempting wrong answer. A pointer to `verify` is
// fine; loading a module, running checks, or selecting principles is not.
//
// MEASURED 2026-10-21 (gpt-6-luna, pstack 0.4.0): the model treated `review`
// as verify and reviewed the change in 2 of 4 runs — a routing finding for
// the skill, which this gate exists to catch.
export default defineEval({
  description: "pstack with an unsupported mode shows usage instead of reviewing anyway.",
  // Quarantined 2026-10-21 after red runs (2 of 4 authoring, 1 of 2
  // iteration 1) at the old SKILL.md. Back in `live` after 221737ac made the
  // unsupported-mode rule explicit ("not exactly plan, verify, or auto ...
  // stop; do not map synonyms such as review"): 6 of 6 green at that snapshot
  // (iteration 2: two full runs, the ablate baseline, three votes), and
  // ablating that sentence turns it red 2 of 2 (pstack-route-unsupported-stop).
  tags: ["live", "pstack", "routing"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-v05-pagekit-slugs", "pagekit")
    await seedRepo(t, repo)

    const turn = await t.send("pstack review the slugify change")
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.toolCalls, noFailedSkillLoads())

    t.check(
      turn.message,
      satisfies(
        (reply: unknown) =>
          typeof reply === "string" &&
          /\bplan\b/i.test(reply) &&
          /\bverify\b/i.test(reply) &&
          /\bauto\b/i.test(reply),
        "shows the supported modes plan, verify, and auto",
      ),
    )
    t.check(turn.toolCalls, noReadMatching(MODULE.plan, "did not load pstack/plan.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.verify, "did not load pstack/verify.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.auto, "did not load pstack/auto.md"))
    t.check(turn.toolCalls, noReadMatching(/principles\/principle-/, "read no principle files"))
    t.check(turn.toolCalls, didNotRun(/unittest|pytest|slugify/, "ran no review checks"))
    t.check(
      turn.message,
      satisfies(
        (reply: unknown) => typeof reply === "string" && principlesIn(reply).length === 0,
        "selects no principles",
      ),
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(t, repo))
  },
})
