import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedCalls, noWrites } from "../support/tools"

// Contract (code/skills/code/simplify.md, "Review passes" #7 "Test signal"):
//
//   "remove tests that only re-prove mocks, private call order, constants,
//   duplicate branches, incidental snapshots, or vacuous assertions. Keep
//   and sharpen observable behavior tests. Protect security and identity
//   guards, public wire/CLI/API goldens, no-drift and dependency-boundary
//   gates, compile-time type proofs, and intentional environment-gated test
//   shims."
//
// and "Test-suite scopes" step 2: "keep borderline or load-bearing guards
// with an explicit reason. Do not weaken meaningful assertions just to
// reduce counts."
//
// This named protected list is the guard that keeps test-pruning from
// becoming a pure count-reduction exercise. A future trim could plausibly
// compress it to something generic like "remove low-value tests, keep
// meaningful ones" and drop the explicit categories (security/identity
// guards, public API goldens, no-drift/dependency-boundary gates, type
// proofs, env-gated shims). Without the named categories, a test-pruning
// pass has no anchor for telling a security or contract guard apart from an
// ordinary "duplicate-looking" test, and could delete a load-bearing
// regression guard right alongside the mock-order noise it actually removes.
//
// The prompt describes a small, concrete mixed test suite and asks the model
// to classify prune-vs-keep without touching anything, so nothing needs to
// run against a real repository or test file.
export default defineEval({
  description:
    "simplify's test-pruning rubric keeps security/golden/no-drift guards while pruning redundant mock/snapshot tests.",
  tags: ["live", "code", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "I'm about to run `code simplify` in test-pruning mode over one test file.",
        "Don't touch anything yet — just tell me, under the pack's test-pruning",
        "rubric, which of these eight tests you would prune and which you would",
        "keep, and why:",
        "",
        "",
        "1. `test_add_returns_sum` — calls add(2,3), asserts it equals 5, and also",
        "asserts the exact internal call order of a mock the function happens to",
        "use internally.",
        "",
        "2. `test_add_called_mock_order` — a near-duplicate of #1 that only",
        "re-asserts the same internal mock was called before another mock, with",
        "no difference in observable behavior covered.",
        "",
        "3. `test_auth_token_rejects_expired` — asserts the auth middleware",
        "returns 401 for an expired JWT; a security/identity guard.",
        "",
        "4. `test_public_api_response_shape` — a golden test asserting the public",
        "`/v1/orders` JSON response shape byte-for-byte against a stored fixture.",
        "",
        "5. `test_add_returns_sum_snapshot` — an incidental Jest snapshot of the",
        "same add() call, with no assertions beyond 'matches snapshot'.",
        "",
        "6. `test_no_circular_deps` — a dependency-boundary/no-drift gate that",
        "fails the build if module A imports module B.",
        "",
        "7. `test_create_order_rejects_wrong_type` — contains only a",
        "`// @ts-expect-error` line passing a wrong-typed argument to",
        "createOrder(); it asserts nothing at runtime and nothing executes — it",
        "only fails to compile if the type error goes away.",
        "",
        "8. `test_beta_pricing_rounding` — skipped entirely unless",
        "`process.env.FEATURE_BETA_PRICING` is set, which it isn't in CI yet;",
        "when it does run, it checks the new pricing engine's rounding. Right",
        "now it never actually executes in the pipeline.",
      ),
    )
    t.succeeded()
    t.loadedSkill("code")
    // Defense in depth: a classification question should never reach for a
    // write tool on a test file that doesn't exist in this sandbox anyway.
    t.check(turn.toolCalls, noWrites())
    t.check(turn.toolCalls, noFailedCalls())
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response recommend KEEPING test #3 (the expired-JWT auth/security guard), test #4 (the public API golden/contract fixture",
          "test), and test #6 (the no-circular-deps dependency-boundary gate) —",
          "explicitly protecting all three from pruning — while recommending",
          "pruning or removing the redundant mock-order and incidental-snapshot",
          "tests (#1, #2, #5)? A response that recommends deleting, pruning, or",
          "otherwise removing any of #3, #4, or #6 counts as NO, even if it",
          "correctly prunes the others.",
        ),
      )
      .gate()
    // Names the rubric's exact compound terms, not a paraphrase: "no-drift"
    // for #6 and "environment-gated" for #8. A model reasoning about these
    // cases from unaided general judgment (not the pack's named categories)
    // tends to land on close-but-different phrasing — e.g. "architectural/
    // dependency-boundary gate" without "no-drift", or "feature-gated"
    // instead of "environment-gated".
    t.check(t.reply, includes(/no-drift/i))
    t.check(t.reply, includes(/environment[\w\s/-]{0,20}gated/i))
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response ALSO recommend KEEPING test #7 (the compile-time-only `@ts-expect-error` type proof, which has no runtime assertion)",
          "and test #8 (the environment-gated test shim that is currently",
          "skipped in CI), explicitly naming a reason like 'compile-time type",
          "proof' or 'type-level check' for #7 and 'environment-gated' or",
          "'feature-flagged' for #8 — rather than pruning either one for looking",
          "vacuous, dead, or currently unreachable in CI? Answer NO if the",
          "response recommends pruning, removing, or flagging as low-value",
          "either #7 or #8, or never separately addresses them from the rest.",
        ),
      )
      .gate()
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
