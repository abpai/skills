import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedCalls } from "../support/tools"
import { fixtureInput, verifyCandidate, type Fixture } from "../support/outcome"
import { noFailedSkillLoads } from "../support/tools"

// The first OUTCOME eval in this lane. Every other eval here grades what the
// model SAID about a skill; this one grades what the skill PRODUCED.
//
// Contract (code/skills/code/simplify.md, "Review passes"): a simplification
// must preserve observable behavior. Every prose eval for that contract asks the
// model to classify a hypothetical and grades the answer, so all of them pass
// for a model that can recite the rubric and would still break the code.
//
// Here the model receives a genuinely messy module and returns a simplified one.
// The returned code is then run against a suite it never saw, in a second,
// locked-down container outside the subject sandbox — see support/outcome.ts.
//
// The fixture is built to punish carelessness, not verbosity. Three planted
// subtleties survive only a simplification that reads what it is changing:
//
//   A  `limit`/`burst` accept 0, so the `!== undefined && !== null` pair cannot
//      collapse into `input.limit || 60`.
//   B  a computed window of 0 is a real answer, so the empty-array early return
//      cannot collapse into `|| 1000`.
//   C  `warn` uses >= and `block` uses >, so the two look-alike branches cannot
//      merge without moving the boundary by one request.
//
// Validated before use: the fixture input passes its own hidden suite 8/8, and
// the obvious careless rewrite fails four cases across all three traps. An eval
// whose fixture is merely wordy passes forever and measures nothing.
//
// Both halves are gated together on purpose. Green tests alone would reward
// returning the input unchanged; a line-count drop alone would reward deleting
// the hard parts. The unchanged input scores 37 -> 37 lines and the careless
// rewrite scores 37 -> 2 with four failures. Neither passes.
// ---------------------------------------------------------------------------
// MEASURED 2026-07-28: this fixture is UNGUARDED. Do not cite it as evidence
// that `simplify`'s rubric works.
//
// The machinery is proven. Live with the skill present it passes 8/8, and the
// model returned a genuinely correct simplification: `??` rather than `||` so
// 0 survives, the empty-window early return kept, `>=` for warn against `>` for
// block. 37 -> 21 significant lines, hidden suite green.
//
// But two controls say it is not testing the skill:
//
//   ablate "Review passes" from simplify.md  -> this eval still PASSED
//   omit the `code` skill entirely           -> all four outcome gates PASSED
//                                               (only loadedSkill and the
//                                               missing-skill tool errors fail)
//
// The base model simplifies this fixture correctly unaided, so the eval cannot
// testify about any of simplify's text.
//
// What a discriminating fixture needs: a decision where the base model's
// default differs from the skill's rule. Preserving behavior while tidying a
// small module is not one — competent models already do it. The rubric's
// load-bearing part is the PROTECTED-CATEGORY list for test pruning, where an
// unaided pass deletes a security guard or a golden alongside genuine noise.
// The next fixture should hand over a real mixed test suite and prune it for
// real, then check which guards survived.
// ---------------------------------------------------------------------------
const FIXTURE: Fixture = {
  name: "normalize-config",
  exports: ["normalizeConfig", "classify"],
}

/** A simplification worth the name removes at least this share of the lines. */
const MIN_REDUCTION = 0.15

export default defineEval({
  description:
    "code simplify returns code that is genuinely simpler AND still passes a hidden behavior suite it never saw.",
  tags: ["control", "code", "outcome", "unguarded"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Use `code simplify` on this exact module. Return the complete simplified",
        "module as one JavaScript code block — every export, ready to run. Do not",
        "change the public API: `normalizeConfig(input)` and `classify(count,",
        "config)` must keep their names, their signatures, and their behavior for",
        "every input. Nothing else in the repository depends on the internals, so",
        "restructure them freely.",
        "",
        "",
        "```javascript",
        fixtureInput(FIXTURE),
        "```",
      ),
    )
    t.succeeded()
    t.loadedSkill("code")
    t.check(turn.toolCalls, noFailedCalls())

    // `t.reply` is nullable: a turn that produced no final assistant message
    // yields null, and that is an extraction failure, not a crash.
    const result = verifyCandidate(FIXTURE, t.reply ?? "")

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
        (r: unknown) => (r as typeof result).error === undefined,
        `the isolated verifier completed${result.error ? ` (${result.error})` : ""}`,
      ),
    )
    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).exportsIntact,
        `simplified module still exports ${FIXTURE.exports.join(" and ")}`,
      ),
    )
    // The behavior half. Failure names the exact planted trap that broke.
    t.check(
      result,
      satisfies(
        (r: unknown) => (r as typeof result).testsPass,
        result.failures.length > 0
          ? `hidden behavior suite passes — failed: ${result.failures.join("; ")}`
          : "hidden behavior suite passes",
      ),
    )
    // The simplification half. Without this, returning the input verbatim wins.
    t.check(
      result,
      satisfies(
        (r: unknown) => {
          const { lines } = r as typeof result
          if (lines.before === 0) return false
          return lines.after <= lines.before * (1 - MIN_REDUCTION)
        },
        `code is at least ${Math.round(MIN_REDUCTION * 100)}% shorter (${result.lines.before} -> ${result.lines.after} significant lines)`,
      ),
    )
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
