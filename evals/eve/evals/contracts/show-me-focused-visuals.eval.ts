import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (show-me/skills/show-me/SKILL.md, "guidance"): preserve the parts of
// the flow that answer the question, but prefer a few focused visuals over one
// that needs scrolling. This reproduces the failure that motivated the rule:
// a mostly linear repository-hardening lifecycle became one tall Mermaid graph
// even though a compact phase map would have explained it more clearly.
export default defineEval({
  description:
    "show-me explains a long workflow in focused visual chunks without dropping its important stages.",
  tags: ["live", "show-me", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Use the show-me skill to explain this repository-hardening workflow:",
        "start with an inspection and initial audit; draft a behavior inventory;",
        "pause for a human to review and ratify scope; capture missing behavior",
        "proof against unchanged code; write concise repository guidance; map",
        "change types to validation commands and evidence; make execution",
        "reproducible; then run a final audit that combines deterministic checks,",
        "agent review, and validation evidence into a readiness report.",
      ),
    )

    t.succeeded()
    t.loadedSkill("show-me")

    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        const mermaidBlocks = reply.matchAll(/```mermaid\s*\n([\s\S]*?)```/gi)
        return [...mermaidBlocks].every(([, body]) => {
          const lines = body
            .split("\n")
            .filter((line) => line.trim().length > 0)
          const isTopDownFlow =
            /^[ \t]*(flowchart|graph)(?:[ \t]+(?:TD|TB)\b|[ \t]*$)/im.test(
              body,
            )
          return !isTopDownFlow || lines.length <= 14
        })
      }, "no long top-down Mermaid block expands into a scroll-length process diagram"),
    )

    t.judge.autoevals.closedQA(
      prompt(
        "Does the response visually explain the workflow in focused, readable",
        "chunks or a compact grouped overview, rather than one large end-to-end",
        "diagram that enumerates every step? It must also preserve these important",
        "parts of the flow: initial inspection/audit, behavior inventory and human",
        "scope review, behavior proof against unchanged code, repository guidance",
        "and validation mapping, reproducible execution, and the final audit/readiness",
        "report. Grouping or paraphrasing those parts is correct; omitting a major",
        "part or producing one unwieldy diagram counts as NO.",
      ),
    )

    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
