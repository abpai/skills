import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

// Contract (claude/skills/claude/SKILL.md:111-115): a repo-grounded review
// with verified evidence needs `--evidence-class repo-grounded-review`
// together with `--review-scope-file`, `--sharing-approval-file`, and an
// explicit `--external-transfer-status allowed`.
//
// Manual dogfood on 2026-07-27 found the SKILL.md text unfollowable: it said
// "both metadata files shown above", but the example that showed them had
// been deleted in an earlier edit, leaving nothing for "both" to resolve
// against. The line was reworded to name `--review-scope-file` and
// `--sharing-approval-file` directly. This eval locks in that a request to
// set up a verified repo-grounded review names both flags in the response.
//
// This eval must not actually launch anything: the prompt asks the model to
// DESCRIBE the command, not run it. Eve's harness instructions already forbid
// real side-effecting actions, but the prompt reinforces that, and the
// toolCalls gate below confirms no tool call attempted an actual launch.
export default defineEval({
  description: "claude names both review-scope and sharing-approval flags for a repo-grounded review.",
  tags: ["live", "claude", "contract"],
  async test(t) {
    const turn = await t.send(
      "I want to set up a repo-grounded Claude Code review with verified evidence " +
        "that Claude actually read the repo files, not just a prompt-only summary. " +
        "Don't launch anything yet — just walk me through which claude-run.sh flags " +
        "I need to configure for the review scope and the sharing approval before I " +
        "run it.",
    )
    t.succeeded()
    t.loadedSkill("claude")
    // Names both metadata flags directly.
    t.check(
      t.reply,
      satisfies((r: unknown) => {
        if (typeof r !== "string") return false
        return r.includes("--review-scope-file") && r.includes("--sharing-approval-file")
      }, "reply names both --review-scope-file and --sharing-approval-file"),
    )
    // Never actually launches the runner or the Claude CLI.
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { input?: unknown }
          const blob = JSON.stringify(call.input ?? {})
          return /claude-run\.sh\s+run\b/.test(blob) || /\bclaude\s+(-p|--bg)\b/.test(blob)
        })
      }, "no tool call actually launches claude-run.sh or the Claude CLI"),
    )
  },
})
