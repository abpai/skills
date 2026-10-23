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
// Iteration 3 (fdc6b1eb): selected in 1 of 2 full runs (and in 2 of 2
// missing-state ablation votes); the miss listed Model the domain instead and
// compared no strategies.
export default defineEval({
  description:
    "pstack plan selects Exhaust the design space and Prioritize usability for a novel conflict-handling decision.",
  // Quarantined 2026-10-21: iteration 1 run 2 chose "preserve both" without
  // saying how sync can tell a two-sided edit from a one-sided one (no
  // last-synced record exists). Back in `live` after 221737ac added "state the
  // approach depends on that the code does not keep yet" to plan.md: 6 of 6
  // runs at that snapshot named the missing state and selected both
  // principles (iteration 2: two full runs, the ablate baseline, three votes;
  // the baseline run first failed on a too-narrow regex, widened below).
  tags: ["live", "pstack", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-p12-notes-sync", "notes-sync")
    const session = await seedRepo(t, repo)

    const turn = await session.send(
      prompt(
        "pstack plan Two people lost edits because they changed the same note on",
        "their laptop and their phone before syncing, and jot sync silently kept",
        "whichever copy was newer. Plan how jot sync should handle conflicting",
        "edits instead.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.plan, "read pstack/plan.md"))
    t.check(turn.toolCalls, readFileMatching(/jot\/sync\.py/, "researched jot/sync.py"))

    // Researched prerequisites, from the code and README.
    t.check(
      turn.message,
      mentionsAll(
        // Iteration 2 (ablate baseline) wrote "The current code has no record
        // of a previous shared version" and missed the narrower alternatives.
        [/\bbase(line)?\b|last[- ]?sync|common ancestor|merge[- ]base|three[- ]way|\bhistory\b|(version|sync) (metadata|record)|record of (a|the) (previous|prior|last)|(previous|prior|last)[- ](shared|synced|common) (version|copy|state)/i],
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

    t.judge(
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
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
