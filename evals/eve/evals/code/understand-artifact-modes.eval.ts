import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { fixtureFile } from "../support/outcome"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (code/skills/code/understand.md, "## Modes"): default mode writes
// ONLY the runnable snippet, `.understand/<topic>/how_<topic>_works.<ext>`;
// the HTML map is opt-in via `--map`. This is the breaking-change contract
// introduced when the standalone walkthrough/snippet draft was retired in
// favor of understand's light mode — default output shrank from two
// artifacts to one, so this locks the new default in place.
//
// understand can't be handed a hypothetical function the way routing/contract
// evals elsewhere in this suite do (see engineering-complexity-report-
// read-only): its snippet contract requires REAL, importable code. So the
// prompt has the model materialize one small real fixture file into the
// workspace first, then trace it — what's graded afterward is ACTIONS
// (which write_file calls happened, and to which paths), never reply prose.
const FIXTURE = fixtureFile("understand-greet", "greet.js")

function wroteFileMatching(pattern: RegExp) {
  return satisfies((calls: unknown) => {
    if (!Array.isArray(calls)) return false
    return calls.some((c) => {
      const call = c as { name?: string; input?: { filePath?: unknown } }
      return call.name === "write_file" && typeof call.input?.filePath === "string" && pattern.test(call.input.filePath)
    })
  }, `a write_file call with filePath matching ${pattern}`)
}

function noFileWrittenMatching(pattern: RegExp) {
  return satisfies((calls: unknown) => {
    if (!Array.isArray(calls)) return false
    return !calls.some((c) => {
      const call = c as { name?: string; input?: { filePath?: unknown } }
      return call.name === "write_file" && typeof call.input?.filePath === "string" && pattern.test(call.input.filePath)
    })
  }, `no write_file call with filePath matching ${pattern}`)
}

export default defineEval({
  description: "code understand defaults to snippet-only output; the HTML map is opt-in via --map.",
  tags: ["live", "code", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "First, create this exact file at `src/greet.js` in the workspace:",
        "",
        "```js",
        FIXTURE.trim(),
        "```",
        "",
        "Then run `code understand greet` — the default invocation, no flags.",
      ),
    )
    t.succeeded()
    t.loadedSkill("code")
    // Default mode wrote the runnable snippet...
    t.check(turn.toolCalls, wroteFileMatching(/\.understand\/[^/]+\/how_.+_works\.[A-Za-z0-9]+$/))
    // ...and did NOT write the HTML map. This is the breaking-default
    // assertion: the old contract required both artifacts every run.
    t.check(turn.toolCalls, noFileWrittenMatching(/index\.html$/))
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in
    // support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())

    // Case B (--map opt-in) is intentionally omitted here. Proving it would
    // need a second live turn tracing the same fixture through the full
    // HTML-map contract (self-contained CSS/JS, call table, verified
    // render) — a much heavier and slower generation than the snippet-only
    // path, for a suite that already quarantined eight marginal live evals
    // over exactly this run-to-run cost/flakiness tradeoff (see README,
    // "Quarantined evals"). Case A alone locks in the load-bearing part of
    // the breaking change: the new default.
  },
})
