import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  captureState,
  checkUnchanged,
  mentionsAll,
  noReadMatching,
  packRepo,
  ranCommand,
  readFileMatching,
  seedRepo,
} from "../support/pstack"

// Contract (verify.md): success criteria come from the ORIGINAL REQUEST,
// "the plan may be wrong", and findings carry locations and evidence.
//
// Fixture pstack-v03-orders-export: the committed plan (docs/plans/export.md)
// leaves out `--since`; the uncommitted implementation follows the plan, so
// `export --since` is accepted and silently ignored. The unit tests pass. The
// request in the prompt names `--since`; nothing tells the model the plan is
// short of it.
export default defineEval({
  description: "pstack verify flags a requirement the supplied plan dropped, from the original request.",
  tags: ["live", "pstack", "routing", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-v03-orders-export", "orders-export")
    await seedRepo(t, repo)

    const turn = await t.send(
      prompt(
        "pstack verify Add orders export --format csv: a header row, one row per",
        "order, fields containing commas or quotes properly quoted, and it must",
        "respect the same --since and --status filters as orders list.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.toolCalls, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.verify, "read pstack/verify.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.auto, "did not read pstack/auto.md"))

    // Checks ran against the actual implementation.
    t.check(turn.toolCalls, ranCommand(/unittest|pytest/, "ran the test suite"))
    // The missed requirement, located.
    t.check(
      turn.message,
      mentionsAll([/--since|\bsince\b/, /cli\.py|cmd_export/], "reports the ignored --since filter at orders/cli.py"),
    )

    t.check(turn.toolCalls, ranCommand(/export[^\n]*--since|--since[^\n]*export/, "probed export with --since")).soft()
    t.judge.autoevals.closedQA(
      prompt(
        "Does the report treat the original request as the authority, say the",
        "plan itself omitted the --since requirement, and back the --since",
        "finding with executed or exactly traced evidence, without declaring the",
        "change done because it matches the plan and without inventing CSV",
        "quoting or format defects?",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(t, repo))
  },
})
