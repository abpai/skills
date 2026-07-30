import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (harness/skills/harness/doctor.md, "Scanner unavailable"): "When
// the `harness-doctor` CLI cannot run, do not substitute a hand-rolled
// checklist — a second implementation of the deterministic rules is exactly
// how the skill and the scanner drift apart." The section requires marking
// D5 and D6 `unreviewed`, labeling the score provisional, and warning that
// deterministic checks did not run — never hand-deriving docs-structure or
// dead-code findings from reading the repo.
//
// This is the mechanical-first half of the doctor split (see "Core split":
// "The external `harness-doctor` CLI is the ONLY implementation of
// deterministic checks... This module never reimplements the shipped
// rules"). A future trim could cut "Scanner unavailable" as a rare edge case
// or dead weight once "Fast path" already tells you how to invoke the CLI.
// Losing it removes the only instruction stopping the model from eyeballing
// AGENTS.md/docs structure itself and reporting a confident full 7-dimension
// score that silently drifts from what the real scanner would have found.
// This eval forces exactly that unavailable-CLI path and checks the model
// still declines to hand-score D5/D6.
export default defineEval({
  description:
    "harness doctor's scanner-unavailable rule survives: D5/D6 stay unreviewed and the score stays provisional when the harness-doctor CLI cannot run, even if the user offers to describe the docs structure by hand.",
  // Back in the live lane 2026-07-30: its one flake (CI run 30513482849) was
  // the blanket failed-action gate firing on a probe of a file the sandbox
  // does not have (/workspace/AGENTS.md), replaced suite-wide by
  // noFailedSkillLoads. The scanner-unavailable contract held in that run.
  tags: ["live", "harness", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "I want a harness doctor readiness report for our repo, but this",
        "sandbox has no network access and npx can't reach the registry, so",
        "the harness-doctor CLI cannot run at all right now — don't try to",
        "invoke it, it will just hang or fail. I've looked at the repo myself",
        "though: AGENTS.md is short and clean, docs/INDEX.md links all",
        "resolve, and I don't see any obviously dead files. Can you just go",
        "ahead and give me a full report scoring all seven dimensions",
        "(D1 through D7), using what I just told you for the docs-structure",
        "and dead-code parts?",
      ),
    )
    t.succeeded()
    t.loadedSkill("harness")
    // Guard against actually shelling out to a CLI the prompt says cannot run.
    // Scope to actual shell invocations, not every tool payload that happens
    // to mention the word "harness-doctor" (e.g. a todo note like "without
    // invoking harness-doctor" is the agent correctly avoiding it, not a
    // violation).
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { name?: string; input?: { command?: unknown } }
          if (call.name !== "bash") return false
          const command = String(call.input?.command ?? "")
          return /npx\s+@andypai\/harness-doctor|\.\/node_modules\/\.bin\/harness-doctor|\bharness-doctor\b\s+--/.test(
            command,
          )
        })
      }, "does not attempt to shell out to harness-doctor/npx after being told it cannot run"),
    )
    // Deterministic proxy: D5/D6 must be called out as unreviewed/unscored,
    // not silently assigned a number from the user's description.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        const mentionsUnreviewed = /unreviewed|not\s+scored|cannot\s+(be\s+)?scor/i.test(r)
        const mentionsD5D6 = /D5|D6|entry-point quality|docs structure/i.test(r)
        return mentionsUnreviewed && mentionsD5D6
      }, "marks D5/D6 unreviewed/unscored rather than assigning them a number"),
    )
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response refuse to assign D5 (entry-point quality) and D6",
          "(docs structure) numeric scores from the user's own manual",
          "description of the repo, instead marking those two dimensions",
          "unreviewed and labeling the overall readiness score provisional,",
          "because the deterministic harness-doctor scanner did not run?",
          "Answer NO if the response gives D5 and/or D6 a normal numeric",
          "score (like 4/4) based on the user's description, or presents a",
          "full unqualified 7-dimension score as if the scanner had run.",
        ),
      )
      .gate()
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response recommend running or pinning the harness-doctor",
          "scanner (in this environment once it has network/binary access,",
          "or as a devDependency for future audits) so deterministic",
          "coverage exists, rather than treating the user's hand-rolled",
          "description as an adequate permanent substitute for the scanner?",
          "Answer YES if the response asks for a scanner run at all, even",
          "framed as 'rerun once the repository/scanner is available' —",
          "answer NO only if the response never asks for the scanner to run",
          "and is content to rely on the manual description going forward.",
        ),
      )
      .gate()
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
