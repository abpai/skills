import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

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
      "I'm about to run `code simplify` in test-pruning mode over one test file. " +
        "Don't touch anything yet — just tell me, under the pack's test-pruning " +
        "rubric, which of these six tests you would prune and which you would " +
        "keep, and why:\n\n" +
        "1. `test_add_returns_sum` — calls add(2,3), asserts it equals 5, and also " +
        "asserts the exact internal call order of a mock the function happens to " +
        "use internally.\n" +
        "2. `test_add_called_mock_order` — a near-duplicate of #1 that only " +
        "re-asserts the same internal mock was called before another mock, with " +
        "no difference in observable behavior covered.\n" +
        "3. `test_auth_token_rejects_expired` — asserts the auth middleware " +
        "returns 401 for an expired JWT; a security/identity guard.\n" +
        "4. `test_public_api_response_shape` — a golden test asserting the public " +
        "`/v1/orders` JSON response shape byte-for-byte against a stored fixture.\n" +
        "5. `test_add_returns_sum_snapshot` — an incidental Jest snapshot of the " +
        "same add() call, with no assertions beyond 'matches snapshot'.\n" +
        "6. `test_no_circular_deps` — a dependency-boundary/no-drift gate that " +
        "fails the build if module A imports module B.",
    )
    t.succeeded()
    t.loadedSkill("code")
    // Defense in depth: a classification question should never reach for edit
    // tools on a test file that doesn't exist in this sandbox anyway.
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => (c as { name?: string }).name === "Edit" || (c as { name?: string }).name === "Write")
      }, "no Edit or Write tool call made while only classifying tests"),
    )
    t.judge.autoevals
      .closedQA(
        "Does the response recommend KEEPING test #3 (the expired-JWT auth/" +
          "security guard), test #4 (the public API golden/contract fixture " +
          "test), and test #6 (the no-circular-deps dependency-boundary gate) — " +
          "explicitly protecting all three from pruning — while recommending " +
          "pruning or removing the redundant mock-order and incidental-snapshot " +
          "tests (#1, #2, #5)? A response that recommends deleting, pruning, or " +
          "otherwise removing any of #3, #4, or #6 counts as NO, even if it " +
          "correctly prunes the others.",
      )
      .gate()
  },
})
