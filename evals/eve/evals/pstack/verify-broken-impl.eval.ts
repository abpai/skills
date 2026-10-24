import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  WEBHOOK_EXTRA_ATTEMPT,
  WEBHOOK_KEY_CHANGES,
  captureState,
  checkUnchanged,
  mentionsAll,
  packRepo,
  ranCommand,
  readFileMatching,
  seedRepo,
} from "../support/pstack"

// Contract (verify.md): review the actual implementation, choose checks that
// can expose incorrect behavior, and report concrete findings with locations
// and evidence — beyond "it compiles and its own tests pass".
//
// Fixture pstack-v04-webhook-retries: the uncommitted retry change compiles
// and its tests pass, but the loop bound allows one attempt too many and the
// idempotency key is generated inside the loop, so it changes per attempt.
// The request in the prompt states both requirements; the tests check neither.
export default defineEval({
  description: "pstack verify finds both seeded defects in a plausible retry implementation.",
  tags: ["live", "pstack", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-v04-webhook-retries", "webhook-retries")
    const session = await seedRepo(t, repo)

    const turn = await session.send(
      prompt(
        "pstack verify Add retries to webhook delivery: retry on 5xx responses and",
        "network errors with exponential backoff (200ms, 400ms, ...), at most 3",
        "attempts in total, never retry 4xx, and send the same Idempotency-Key",
        "header on every attempt so receivers can dedupe.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.verify, "read pstack/verify.md"))
    t.check(turn.toolCalls, readFileMatching(/src\/dispatch\.ts/, "inspected src/dispatch.ts"))

    t.check(turn.message, mentionsAll([/dispatch\.ts/], "locates findings in src/dispatch.ts"))
    t.check(
      turn.message,
      mentionsAll([WEBHOOK_EXTRA_ATTEMPT], "finds the attempt cap allows a fourth attempt"),
    )
    t.check(
      turn.message,
      mentionsAll(WEBHOOK_KEY_CHANGES, "finds the idempotency key changes between attempts"),
    )

    t.check(turn.toolCalls, ranCommand(/\bbun\b|\bnode\b|\bnpx\b|\btsx\b/, "executed a check")).soft()
    t.judge(
      prompt(
        "Does the report say the existing tests would not catch these problems,",
        "list the checks it ran, and keep invented issues (for example header",
        "name casing) out of its requirement findings?",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
