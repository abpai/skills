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
  readFileMatching,
  seedRepo,
} from "../support/pstack"

// Contract (verify.md): verify works from a pull request alone. With no plan
// supplied, the request comes from the PR's description, and the report says
// that this is the only statement of the request.
//
// Fixture pstack-v04-webhook-retries (shared with verify-broken-impl): the
// uncommitted change compiles and its tests pass, but the attempt cap allows a
// fourth attempt and the Idempotency-Key is regenerated per attempt. The PR
// description below states both requirements.
export default defineEval({
  description: "pstack verify reviews a pull request with no plan, from its description alone.",
  tags: ["live", "pstack", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-v04-webhook-retries", "webhook-retries")
    const session = await seedRepo(t, repo)

    const turn = await session.send(
      prompt(
        "pstack verify this pull request. Its change is the uncommitted diff in the",
        "working tree.",
        "",
        "Title: Add retries to webhook delivery",
        "Description: Webhook delivery now retries on 5xx responses and network",
        "errors with exponential backoff (200ms, 400ms, ...), up to 3 attempts in",
        "total. 4xx responses are not retried. Every attempt sends the same",
        "Idempotency-Key header so receivers can dedupe.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.verify, "read pstack/verify.md"))
    t.check(turn.toolCalls, readFileMatching(/src\/dispatch\.ts/, "inspected src/dispatch.ts"))

    t.check(turn.message, mentionsAll([WEBHOOK_EXTRA_ATTEMPT], "finds the attempt cap allows a fourth attempt"))
    t.check(turn.message, mentionsAll(WEBHOOK_KEY_CHANGES, "finds the idempotency key changes between attempts"))
    t.check(
      turn.message,
      mentionsAll(
        [/\b(PR|pull request)['’]?s?\b[^.\n]{0,40}\bdescription\b|\bdescription\b[^.\n]{0,40}\b(PR|pull request)\b/i],
        "says the requirements come from the pull request's description",
      ),
    )
    t.judge(
      prompt(
        "Does the report review the change without asking for a plan or a separate",
        "statement of the request, and does it note that the pull request's own",
        "description is the only statement of what was required?",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
