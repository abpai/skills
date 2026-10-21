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
  packRepo,
  readFileMatching,
  seedRepo,
  selectsPrinciple,
  staysShort,
} from "../support/pstack"

// Contract (plan.md step 3, principles.md triggers): select a principle when
// its trigger matches. This is the positive direction for Exhaust the design
// space ("a novel UI interaction or architectural decision has no useful
// precedent"), which plan-attack-premise and plan-dashed-migration must NOT
// select, and for Prioritize usability.
//
// Fixture pstack-p12-notes-sync: `jot sync` resolves conflicting edits by
// mtime, keeps no record of the last-synced version, and mostly runs
// unattended (README). Neither fact is in the prompt. Type system discipline
// is the negative control: this is Python with no signature design at stake.
//
// MEASURED 2026-10-21 (gpt-6-luna, pstack 0.4.0): Exhaust the design space
// was selected in 1 of 5 runs; in another the model read its file and
// compared two approaches in the plan body but did not list it. The gate is the positive half of
// the both-directions principle check, so it stays a gate: a red result here
// is a principle-selection finding for the skill, not grader noise.
export default defineEval({
  description:
    "pstack plan selects Exhaust the design space and Prioritize usability for a novel conflict-handling decision.",
  tags: ["live", "pstack", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-p12-notes-sync", "notes-sync")
    await seedRepo(t, repo)

    const turn = await t.send(
      prompt(
        "pstack plan Two people lost edits because they changed the same note on",
        "their laptop and their phone before syncing, and jot sync silently kept",
        "whichever copy was newer. Plan how jot sync should handle conflicting",
        "edits instead.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.toolCalls, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.plan, "read pstack/plan.md"))
    t.check(turn.toolCalls, readFileMatching(/jot\/sync\.py/, "researched jot/sync.py"))

    // Researched prerequisites, from the code and README.
    t.check(
      turn.message,
      mentionsAll(
        [/\bbase(line)?\b|last[- ]?sync|common ancestor|merge[- ]base|three[- ]way|\bhistory\b|(version|sync) (metadata|record)/i],
        "names the missing last-synced/base state needed to detect a conflict",
      ),
    )
    t.check(
      turn.message,
      mentionsAll([/unattended|cron|launchd|background|non-?interactive/i], "accounts for unattended sync runs"),
    ).soft()

    t.check(turn.message, linksPrincipleFiles())
    t.check(turn.message, selectsPrinciple("exhaust-the-design-space"))
    t.check(turn.message, selectsPrinciple("prioritize-usability"))
    t.check(turn.message, doesNotSelectPrinciple("type-system-discipline"))
    t.check(turn.message, doesNotSelectPrinciple("migrate-callers-then-delete-legacy-apis"))
    t.check(turn.message, atMostPrinciples(5))
    t.check(turn.message, staysShort(500))

    t.judge.autoevals.closedQA(
      prompt(
        "Does this plan compare two or more meaningfully different conflict",
        "strategies before choosing one, and choose for user experience: no lost",
        "data, works without a person present, conflicts visible and easy to",
        "resolve? Answer NO if it keeps newest-wins with only a warning, or",
        "jumps to an interactive prompt as the only path.",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(t, repo))
  },
})
