import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedCalls } from "../support/tools"
import { fixtureFile, verifyPruning } from "../support/outcome"

// The discriminating outcome eval. Its sibling
// (code-simplify-preserves-behavior) proved the machinery but measured the base
// model: with `code` omitted entirely, every one of its outcome gates still
// passed, because any competent model tidies a small module correctly.
//
// This fixture targets the opposite: a decision where the base model's ordinary
// judgment is WRONG and only the skill's rule saves it.
//
// Contract (code/skills/code/simplify.md, "Review passes" #7 Test signal):
// "Protect security and identity guards, public wire/CLI/API goldens, no-drift
// and dependency-boundary gates, compile-time type proofs, and intentional
// environment-gated test shims."
//
// Two of those categories look like dead weight to anyone judging by "does this
// assert anything useful":
//
//   - the `@ts-expect-error` type proof asserts nothing at runtime
//   - the beta-pricing test is skipped unless a flag is set, so it never runs
//     in CI as configured
//
// Deleting them is the reasonable-looking call. The named protected list is
// what makes it the wrong one.
//
// Grading is by MUTATION SCORE, not by which test names survived — that would
// grade the model's naming rather than its judgement. Three faults are planted
// in the module under test, each guarded by one protected test. A pruned suite
// that dropped a guard goes green against its fault, and that is the failure.
//
// Validated offline before use:
//
//   full suite,  clean source     green
//   full suite,  each mutant      all 3 killed
//   naive prune (drops #6 and #7) beta-rounding SURVIVES — the eval fails
//
// The env flag is set during verification on purpose: a test skipped in CI
// today is still a real guard when the flag turns on, and pruning it because it
// "never runs" is precisely the mistake being measured.
// ---------------------------------------------------------------------------
// MEASURED 2026-07-28. This eval is RED on purpose, and the failure is real.
//
//   with `code` present, 3 runs   the env-gated shim SURVIVES, the noise is
//                                 pruned, every planted fault stays caught —
//                                 but the @ts-expect-error type proof is
//                                 DELETED, 3 times out of 3
//   with `code` omitted           the same deletion, plus the mechanical
//                                 skill-absent failures
//
// So `simplify`'s protected-category list does not, in practice, save a
// compile-time type proof. The prose eval for the same contract
// (contracts/code-simplify-protects-load-bearing-tests) passes: asked to
// CLASSIFY the eight tests, the model correctly says it would keep the type
// proof. Asked to actually prune, it deletes it.
//
// That gap between what the skill can recite and what it does is the entire
// reason this lane exists. Do not "fix" this eval by softening the gate. Either
// simplify.md needs to make the type-proof category survive a real pruning
// pass, or the category should be dropped as unenforceable.
//
// Note the fixture originally labelled each test `// N. PROTECTED —` and
// `// N. NOISE —`, which handed the model the answer and made both the skill
// and the omit control pass everything. Fixtures must not narrate their own
// grading.
// ---------------------------------------------------------------------------
const FIXTURE = "prune-tests"

/** Text that must survive pruning. The type proof has no runtime signal. */
const REQUIRED_MARKERS = ["@ts-expect-error"]

/** Genuine noise: a duplicate, an incidental snapshot, an assertion-free smoke. */
const NOISE_NAMES = [
  "add called its internal helper before the other helper",
  "add snapshot",
  "module loads",
]

export default defineEval({
  description:
    "code simplify prunes redundant tests while every planted fault stays caught — the protected guards survive.",
  tags: ["live", "code", "outcome"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Use `code simplify` in test-pruning mode on this test file. Return the",
        "complete pruned test file as one JavaScript code block, ready to run.",
        "Remove what is genuinely redundant. Keep the file importing from",
        "`./source.js` and keep it passing.",
        "",
        "",
        "Here is the module under test, for context — do not modify it:",
        "",
        "```javascript",
        fixtureFile(FIXTURE, "source.js"),
        "```",
        "",
        "And here is the test file to prune:",
        "",
        "```javascript",
        fixtureFile(FIXTURE, "input.test.js"),
        "```",
      ),
    )
    t.succeeded()
    t.loadedSkill("code")
    t.check(turn.toolCalls, noFailedCalls())

    const result = verifyPruning(FIXTURE, t.reply ?? "", {
      requiredMarkers: REQUIRED_MARKERS,
      noiseNames: NOISE_NAMES,
    })

    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).extracted,
        `reply contains a fenced code block${result.error ? ` (${result.error})` : ""}`,
      ),
    )
    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).suiteGreen,
        "the pruned suite still passes against the unmutated module",
      ),
    )
    // The load-bearing gate. Every planted fault must still be caught.
    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).survived.length === 0,
        result.survived.length > 0
          ? `every planted fault stays caught — undetected after pruning: ${result.survived.join(", ")}`
          : "every planted fault stays caught",
      ),
    )
    // The type proof has no runtime signal, so mutation cannot speak for it.
    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).missingMarkers.length === 0,
        `the compile-time type proof survives (missing: ${result.missingMarkers.join(", ") || "none"})`,
      ),
    )
    // Without this, keeping all eight tests would pass everything above.
    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).noiseKept.length === 0,
        `the redundant tests are gone (still present: ${result.noiseKept.join(", ") || "none"})`,
      ),
    )
    t.noFailedActions()
  },
})
