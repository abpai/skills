import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  atMostPrinciples,
  captureState,
  checkUnchanged,
  doesNotSelectPrinciple,
  packRepo,
  ranCommand,
  readFileMatching,
  seedRepo,
} from "../support/pstack"

// Contract (verify.md, principles.md): report concrete problems, not
// preferences; select only relevant principles. A correct change gets checks
// and evidence, not invented findings or a demand to apply every principle.
//
// Fixture pstack-v05-pagekit-slugs: the uncommitted slugify change meets the
// request, the tests pass, and the request's own examples hold. Refactoring
// principles (Model the domain, Type system discipline, Redesign, Minimize
// reader load) have no trigger here.
export default defineEval({
  description: "pstack verify on a correct small change runs checks and invents no findings.",
  tags: ["live", "pstack", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-v05-pagekit-slugs", "pagekit")
    const session = await seedRepo(t, repo)

    const turn = await session.send(
      prompt(
        "pstack verify Make slugify collapse runs of separators and trim leading",
        "and trailing hyphens: \"  Hello -- World! \" should become \"hello-world\"",
        "and \"C++ & Rust\" should become \"c-rust\". Non-ASCII letters should stay",
        "as they are today.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.verify, "read pstack/verify.md"))

    t.check(turn.toolCalls, ranCommand(/unittest|pytest/, "ran the test suite", { ok: true }))
    // The tests already pin both request examples, so a direct probe is extra.
    t.check(turn.toolCalls, ranCommand(/slugify/, "probed slugify directly")).soft()

    for (const slug of [
      "model-the-domain",
      "type-system-discipline",
      "redesign-from-first-principles",
      "minimize-reader-load",
      "exhaust-the-design-space",
    ] as const) {
      t.check(turn.message, doesNotSelectPrinciple(slug))
    }
    t.check(turn.message, atMostPrinciples(2)).soft()
    t.judge(
      prompt(
        "Does the report conclude the change meets the request with no blocking",
        "findings, label any extra observations as optional or informational, and",
        "avoid claiming defects (for example in non-ASCII handling, underscores,",
        "or empty slugs) that it did not demonstrate?",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
