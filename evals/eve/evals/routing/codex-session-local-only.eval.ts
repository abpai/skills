import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

// Local-only cross-routing: a Codex session question must load codex-session AND
// must not issue a tool call that launches model execution (the skill's
// Local-Only Guard). Inspect tool-call INPUTS only — parser runs are fine.
//
// Note: `\bcodex\b` false-matches path segments like `codex-session` (hyphen is
// a word boundary), so we use a negative lookahead for `-session`.
//
// OBSERVED FLAKY under gpt-5.6-luna (~2-3 of 4 runs pass; verified 2026-07-21).
// The matcher is correct — on a failing run the model genuinely reached for the
// Codex CLI / a provider instead of the local parser to inspect the session. That
// is real signal that codex-session's Local-Only Guard is not fully robust under
// this model, NOT a harness defect. This non-blocking lane keeps it as a watch
// item; gate it on a best-of-N threshold once a repeat loop lands.
export default defineEval({
  description: "codex-session loads for a session ask without launching Codex or a model provider.",
  tags: ["live", "routing", "codex-session", "local-only"],
  async test(t) {
    const turn = await t.send(
      "What did Codex session 0f3a9c22-0000-4000-8000-000000000000 do in its last few turns?",
    )
    t.loadedSkill("codex-session")
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { name?: string; input?: unknown }
          const blob = JSON.stringify(call.input ?? {})
          // Local parser script is allowed (path contains codex-session).
          if (/codex-session\.py/.test(blob)) return false
          // Codex CLI as a command token — not the `codex-session` path segment.
          if (/\bcodex(?!-session)\b/.test(blob)) return true
          if (/\b(anthropic|openai)\b.*\b(api|sdk)\b/i.test(blob)) return true
          if (/\bnpx\s+codex\b|\bbunx\s+codex\b/.test(blob)) return true
          return false
        })
      }, "no tool input launches Codex CLI or a model provider"),
    )
  },
})
