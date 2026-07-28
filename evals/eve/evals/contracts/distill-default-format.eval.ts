import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"

// Contract (distill/skills/distill/SKILL.md:107-108): Conceptual Map is "the
// default; use it for any input unless a format below is requested or its
// trigger fires" — a single default for every input, not one default per
// input type.
//
// Manual dogfood on 2026-07-27 found the OLD wording unfollowable for a
// codebase input: it named Conceptual Map as "the default for non-code
// inputs" and named no default for code inputs, so the model had to reach the
// right format by elimination (or ask the user). The SKILL.md was reworded to
// name Conceptual Map as the universal default. This eval locks in the fixed
// behavior: a one-shot codebase distill request with no format stated
// produces the Conceptual Map template directly, not a clarifying question.
export default defineEval({
  description: "distill defaults to the Conceptual Map format for a codebase input.",
  tags: ["live", "distill", "contract"],
  async test(t) {
    await t.send(
      prompt(
        "Distill this codebase for me in one pass, no back-and-forth needed: it's a",
        "small job-queue library with three pieces — a Producer that enqueues jobs,",
        "a Redis-backed Queue, and a Worker pool that pulls jobs, runs handlers, and",
        "retries on failure. I just want the core mental model. I have no preference",
        "on output format — just give me what fits best.",
      ),
    )
    t.succeeded()
    t.loadedSkill("distill")
    // Produces the Conceptual Map template directly...
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        return (
          /##\s*Primitives/i.test(r) &&
          /##\s*Relationships/i.test(r) &&
          /##\s*Reconstruction/i.test(r) &&
          /##\s*What Was Discarded/i.test(r)
        )
      }, "reply contains the Conceptual Map template headings (Primitives, Relationships, Reconstruction, What Was Discarded)"),
    )
    // ...rather than asking the user which format to use.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        return !/which (output )?format|what format would you (like|prefer)|which format (would|do) you (prefer|want)/i.test(
          r,
        )
      }, "does not ask the user which output format to use"),
    )
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
