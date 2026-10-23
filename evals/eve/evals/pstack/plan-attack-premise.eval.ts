import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  atMostPrinciples,
  captureState,
  checkUnchanged,
  doesNotSelectPrinciple,
  linksPrincipleFiles,
  mentionsAll,
  noReadMatching,
  packRepo,
  readFileMatching,
  seedRepo,
  selectsPrinciple,
  staysShort,
} from "../support/pstack"

// Contract (pstack/skills/pstack/SKILL.md routing; plan.md): `pstack plan X`
// loads plan.md, researches the repository, drafts the smallest approach,
// selects only relevant principles, and returns a short plan without editing.
//
// Fixture pstack-p01-tenant-reports: a "flaky" test already patched three times
// with timing workarounds. The prompt names the test and the workarounds but
// not the cause, so naming `src/reports.ts` is evidence of research. The
// trigger for Attack the premise ("repeated fixes share an assumption and keep
// failing") matches; Separate before serializing shared state does not —
// nothing here is concurrent — and Exhaust the design space has no novel
// decision to explore. Those two are the "must NOT select" direction, and
// plan-design-space is the eval where Exhaust the design space must appear.
export default defineEval({
  description:
    "pstack plan routes to plan.md, researches the repo, and selects Attack the premise without padding.",
  tags: ["live", "pstack", "routing", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-p01-tenant-reports", "tenant-reports")
    const session = await seedRepo(t, repo)

    const turn = await session.send(
      prompt(
        "pstack plan The \"writes one report per tenant\" test in tests/reports.test.ts",
        "fails on CI every few runs. We already bumped its timeout to 10s, wrapped",
        "it in a 3-attempt retry, and added a 50ms delay after each write in",
        "writeTenantReports so the filesystem can flush. It still flakes. Plan a",
        "proper fix.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())

    // Routing: the plan module, and only the plan module.
    t.check(turn.toolCalls, readFileMatching(MODULE.plan, "read pstack/plan.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.verify, "did not read pstack/verify.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.auto, "did not read pstack/auto.md"))

    // Research before planning: the code under test, not just the test.
    t.check(turn.toolCalls, readFileMatching(/src\/reports\.ts/, "researched src/reports.ts"))
    t.check(turn.message, mentionsAll([/reports\.ts|fileNameFor/], "plan points at the naming code in src/reports.ts"))

    // Principle selection from the index, linked, focused.
    t.check(turn.toolCalls, readFileMatching(MODULE.principles, "read pstack/principles.md"))
    t.check(turn.message, linksPrincipleFiles())
    t.check(turn.message, selectsPrinciple("attack-the-premise"))
    t.check(turn.message, doesNotSelectPrinciple("separate-before-serializing-shared-state"))
    t.check(turn.message, doesNotSelectPrinciple("exhaust-the-design-space"))
    t.check(turn.message, atMostPrinciples(5))
    t.check(turn.message, staysShort(450))

    // Soft evidence: the cause itself, and a root-cause principle.
    t.check(
      turn.message,
      mentionsAll([/fileNameFor|file ?name|collid|collision|overwrit/i], "names the file-name collision"),
    ).soft()
    t.check(turn.message, selectsPrinciple("fix-root-causes")).soft()
    t.judge(
      prompt(
        "Is this a plan (not an implementation) that rejects the timing/flush",
        "explanation shared by the earlier fixes, fixes the cause at its source",
        "rather than in the test alone, and removes the delay, retry, and timeout",
        "workarounds? Answer NO if it proposes another timing mitigation (longer",
        "delays, fsync, more retries, serial tests, larger timeouts) or locking",
        "as the fix.",
      ),
      { on: turn.message },
    )

    // Plan never edits.
    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
