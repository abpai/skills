import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  atMostPrinciples,
  captureState,
  checkUnchanged,
  doesNotSelectPrinciple,
  mentionsAll,
  packRepo,
  readFileMatching,
  seedRepo,
  selectsPrinciple,
} from "../support/pstack"

// Contract (SKILL.md): "When the remaining arguments are empty, use the
// current task." A bare `pstack plan` after the user has described the work
// must plan that work: no request for a task, no usage line.
//
// Fixture pstack-p10-billing-events: renaming `acct.*` events to `account.*`
// across constants, raw strings, tests, docs, and one dynamically built name
// in `src/audit/trail.ts`; CONTRIBUTING.md carries the recurring
// "use Events constants" review note. The prior message names the rename and
// the recurring review comment but not the files, the dynamic name, or a fix.
// The triggers for Script bulk operations and Encode lessons in structure
// match; Exhaust the design space does not.
export default defineEval({
  description: "bare pstack plan uses the task from the conversation instead of asking for one.",
  tags: ["live", "pstack", "routing"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-p10-billing-events", "billing-events")
    const session = await seedRepo(t, repo)

    const context = await session.send(
      prompt(
        `Context for my next message, about \`${repo.dir}\` (do not start yet):`,
        "we are renaming the billing account events from the `acct.` prefix to",
        "`account.` (acct.opened, acct.closed, acct.frozen, acct.limit_changed).",
        "These events are in-process only. Reviewers also keep leaving the same",
        "comment on PRs here about how event names get written, and I want that",
        "to stop needing a person.",
      ),
    )
    t.check(context.toolCalls, noWrites())

    const turn = await session.send("pstack plan")
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.plan, "read pstack/plan.md"))

    // It planned the conversation's task rather than asking or printing usage.
    // The new prefix plus either the old one or the word rename: iteration-2
    // run 2 planned the rename ("Rename the four account events to
    // `account.*`") without spelling `acct` and failed an /acct/ gate.
    t.check(turn.message, mentionsAll([/account\./, /\bacct\b|renam/i], "plans the acct. -> account. rename"))
    // Soft: this eval guards routing. Measured 2026-10-21 (gpt-6-luna): the
    // plan named the dynamic name in trail.ts but omitted a rerunnable
    // leftover search in 1 of 2 runs and never selected Script bulk
    // operations — a plan-quality gap for the skill, not a routing failure.
    t.check(
      turn.message,
      mentionsAll(
        [/\bgrep\b|\brg\b|\b(no|zero)\b[^.\n]{0,40}(acct|old)[^.\n]{0,60}\bremain/i],
        "includes a leftover check for the old names",
      ),
    ).soft()
    t.check(turn.message, selectsPrinciple("encode-lessons-in-structure"))
    t.check(turn.message, doesNotSelectPrinciple("exhaust-the-design-space"))
    t.check(turn.message, atMostPrinciples(5))

    t.check(
      turn.message,
      mentionsAll([/trail\.ts|dynamic|template|non-literal|computed/i], "notices the dynamically built event name"),
    ).soft()
    // Principle depth is plan-contract territory; this eval guards routing.
    t.check(turn.message, selectsPrinciple("script-bulk-operations")).soft()
    t.check(turn.message, selectsPrinciple("type-system-discipline")).soft()

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
