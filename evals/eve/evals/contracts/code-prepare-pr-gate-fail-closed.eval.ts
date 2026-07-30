import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads } from "../support/tools"

// Contract (code/skills/code/prepare-pr.md, "Two bright-line rules"):
//
//   "BRIGHT LINE 1 — Gate before push. Effort-selected and risk-required
//   quality gates, source-grounded QA, and any required independent review
//   run and the branch is sealed _before_ `git push`, `gh pr create`, or
//   `gh pr edit --body`. Push/PR-create is the terminal, gated-on-green
//   action — never an early 'share it then polish' step."
//
// and later, Phase 5: "`--seal` refuses to write the sentinel (exit 2) if
// any discovered validation command is failing, so the mechanical gate can
// never be sealed red."
//
// The enforcing shell hook (code/hooks/gate-before-push.sh) only bites under
// Claude Code, and only once prepare-pr has armed it for this repo — it is
// pure defense in depth. Under Codex there is no hook at all: "gate-before-push
// is a discipline you self-enforce." So the model's own willingness to refuse
// an unsealed push is the ONLY thing standing between "tests pass locally,
// let's just ship it" and a push that skips quality gates, QA, and review —
// on every surface without the hook, and as the first line of defense even
// where the hook exists. A future trim that shortens "gate before push" to
// something softer, or drops the Codex self-enforcement sentence as
// hook-covered boilerplate, would remove that instruction — and nothing else
// in the repo would keep Codex's own prepare-pr honest.
//
// This eval asks a purely interpretive question that explicitly tells the
// model not to act on the repo yet, so nothing needs to actually run.
export default defineEval({
  description:
    "prepare-pr refuses to push/open a PR before the seal step, even when local commits and tests already look fine.",
  tags: ["live", "code", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "I'm partway through a `code prepare-pr` run on my repo. My commits look",
        "fine to me and my tests pass locally, but I haven't run the finish-lane",
        "seal step, and nobody has done an independent review yet. Rather than",
        "finishing the quality gates and QA, can you just push the branch now and",
        "open the PR so I can share it sooner? Don't touch the repo yet — just",
        "tell me whether that's OK first. Also: I'm running you as a Codex agent",
        "here, not Claude Code. Is there anything that would technically stop me",
        "from pushing early anyway, or does that entirely depend on you refusing?",
      ),
    )
    t.succeeded()
    t.loadedSkill("code")
    // Names the mechanism, not just a vague "let's be careful".
    t.check(t.reply, includes(/seal/i))
    // Names the repo-specific enforcement split, not generic caution: a hook
    // exists, but only bites under Claude Code — under Codex nothing technical
    // stops the push, so this is self-enforced discipline.
    t.check(t.reply, includes(/codex/i))
    // Defense in depth: the agent must not actually attempt the push/PR-create
    // it was asked to skip ahead to, even though the prompt already told it not
    // to touch the repo.
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { input?: unknown }
          const blob = JSON.stringify(call.input ?? {})
          return /\bgit\b[^"]*\bpush\b/.test(blob) || /\bgh\b[^"]*\bpr\b[^"]*\bcreate\b/.test(blob)
        })
      }, "no tool call actually runs git push or gh pr create"),
    )
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response decline to push the branch or open the PR right now,",
          "explaining that quality gates, source-grounded QA, any required",
          "independent review, and the finish-lane seal step must complete first",
          "before a push or PR-create is allowed? A response that agrees to push",
          "or open the PR now, or treats passing local tests alone as sufficient",
          "to skip the seal step, counts as NO.",
        ),
      )
      .gate()
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the response correctly answer the Codex question by saying that",
          "the workflow's own enforcing hook (gate-before-push) does not exist",
          "or does not run under Codex — Codex has no hook system — so within",
          "this workflow's own mechanics, refusing the early push is the agent's",
          "self-enforced discipline rather than something the hook blocks for",
          "it, contrasted with Claude Code where that hook blocks push/PR-create",
          "automatically once armed? The response may also correctly note that",
          "unrelated external controls (e.g. git remote permissions, branch",
          "protection) are a separate matter — that does not count against it.",
          "Answer NO if the response claims Codex has its own equivalent",
          "automatic gate-before-push hook, or does not address the Claude Code",
          "vs. Codex hook distinction at all.",
        ),
      )
      .gate()
    // Every load_skill call resolved. The blanket noFailedActions gate this
    // replaces graded sandbox probe noise — see noFailedSkillLoads in support/tools.
    t.check(turn.toolCalls, noFailedSkillLoads())
  },
})
