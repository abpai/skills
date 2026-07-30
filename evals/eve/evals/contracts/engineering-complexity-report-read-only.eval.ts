import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (engineering/skills/engineering/complexity-report.md:8-9, "Create
// an evidence-ranked report... Default to read-only: do not modify source
// files, lockfiles, generated artifacts, or test fixtures in this workflow."
// and line 48, "End report-only work with a clear statement that no files
// were modified."): complexity-report is a findings-only workflow. The
// Follow-Up Contract (lines 50-55) deliberately hands the *implementation* of
// any finding to "the normal coding workflow" in a later turn — this module
// never edits.
//
// A future trim could cut the read-only sentence as implied by "report" in
// the description, or cut the closing-statement requirement as boilerplate.
// Either loss is dangerous: without an explicit read-only contract, a model
// asked to "fix what you find" mid-report could start editing source directly
// instead of stopping at findings, silently changing behavior in a workflow
// the user invoked expecting only a report to review.
//
// This eval asks for a complexity report on a described (not real) hot path
// and asserts the model produces findings without invoking any file-mutating
// or shell tool, and states plainly that it did not modify anything.
export default defineEval({
  description: "engineering's complexity-report stays read-only: findings only, no edits, explicit no-files-modified statement.",
  tags: ["live", "engineering", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Run the engineering complexity-report workflow on this: our `getUserFeed(userId)`",
        "function loads all 50,000 posts in the table into memory, then filters in",
        "JavaScript for the ~20 posts belonging to that user, on every request to a page",
        "that gets called on every app load. Give me the evidence-ranked findings.",
      ),
    )
    t.succeeded()
    t.loadedSkill("engineering")
    // No file-mutating tool call — findings only, nothing applied. `bash` is
    // allowed for read-only exploration (e.g. `find`, `pwd`), so gate on the
    // command text itself rather than banning the tool outright.
    t.notCalledTool("write_file")
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { name?: string; input?: { command?: unknown } }
          if (call.name !== "bash") return false
          const command = String(call.input?.command ?? "")
          return /(^|\s)(rm|mv|cp|sed\s+-i|>>?|tee|truncate|chmod|git\s+(add|commit|checkout|reset))\b/.test(
            command,
          )
        })
      }, "no bash call runs a file-mutating command (rm/mv/cp/sed -i/redirection/git write ops)"),
    )
    // Explicit closing statement that no files were modified.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        return /no files? (were |was )?(modified|changed|edited)/i.test(r)
      }, "reply explicitly states no files were modified"),
    )
    // Reply reads as a findings report (stable finding id + evidence), not an
    // applied fix.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        return /perf-\d+/i.test(r)
      }, "reply includes a stable finding id like perf-001"),
    )
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
