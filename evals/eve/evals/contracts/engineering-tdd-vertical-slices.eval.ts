import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (engineering/skills/engineering/tdd.md:17-40, "Anti-Pattern:
// Horizontal Slices"): "DO NOT write all tests first, then all
// implementation... Correct approach: Vertical slices via tracer bullets. One
// test → one implementation → repeat." The module spells out why this
// matters: tests written in bulk test imagined behavior instead of actual
// behavior, and testing the shape of things instead of what users care about.
//
// This whole section reads like elaboration on the RED/GREEN loop already
// described in "Workflow" (tdd.md:61-86), so a future trim could cut it as
// redundant. It is not redundant: the Workflow section only describes a
// single cycle in isolation ("RED: test fails" / "GREEN: code passes") — it
// never says what to do with a *second* behavior. Only the Anti-Pattern
// section forbids batching multiple behaviors' tests before any of their
// implementations. Losing it leaves the model free to write all the tests up
// front (the textbook TDD mistake this repo explicitly calls out), producing
// tests that assert imagined shape rather than behavior learned cycle by
// cycle.
//
// This eval asks for TDD across three behaviors and checks the model
// interleaves test-then-implementation per behavior (vertical) rather than
// batching all three tests before any implementation (horizontal).
export default defineEval({
  description: "engineering's tdd module interleaves test-then-implementation per behavior instead of batching all tests first.",
  // QUARANTINED 2026-07-30: two gates flip on narration style run to run —
  // the judge (closedQA) and the "narrates at least two RED/GREEN cycles"
  // regex (both failed CI run 30513482849, passed run 30509092640, skill text
  // unchanged). Still an ablation detector via ablations/manifest.ts. Run
  // manually: bunx eve eval contracts/engineering-tdd-vertical-slices
  tags: ["quarantine", "engineering", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Use the engineering tdd workflow to walk me through building a small in-memory",
        "rate limiter, narrating the RED/GREEN cycle in this chat as you go (don't just",
        "hand me final files). The interface is already agreed, so skip planning and go",
        "straight into the cycles: `const limiter = new RateLimiter({ limit, windowMs });",
        "limiter.allow(key) // boolean`. There are three behaviors to cover, already",
        "prioritized, so no need to confirm scope with me either: (1) allows a request",
        "under the limit, (2) blocks a request over the limit, (3) resets the count after",
        "the window elapses. Narrate each cycle: what test you write, that it fails, then",
        "the minimal code that makes it pass, before moving to the next behavior.",
      ),
    )
    t.succeeded()
    t.loadedSkill("engineering")
    // Semantic check (judge, soft): vertical slices (test1->impl1->test2->impl2->test3->impl3),
    // not horizontal slicing (test1,test2,test3 then impl1,impl2,impl3).
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response implement the three rate-limiter behaviors as vertical",
          "slices — writing a failing test for ONE behavior, then the minimal",
          "implementation for that same behavior, before writing the test for the next",
          "behavior — rather than writing all three tests first and only then writing",
          "all three implementations (horizontal slicing)? Answer NO if the response",
          "presents a block of multiple tests before any corresponding implementation.",
        ),
      )
    // Deterministic backstop: the reply actually narrates a fail-then-pass
    // cycle (RED before GREEN) at least twice, one per behavior covered.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        const redCount = (r.match(/\bred\b/gi) ?? []).length
        const greenCount = (r.match(/\bgreen\b/gi) ?? []).length
        return redCount >= 2 && greenCount >= 2
      }, "reply narrates at least two RED/GREEN cycles (one per behavior, not one bulk pass)"),
    )
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
