import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

// Local-only cross-routing: a Claude session question must load claude-session
// AND must not issue a tool call that launches Claude or a model provider (the
// skill's Local-Only Guard, claude-session/skills/claude-session/SKILL.md:17-30).
// A future trim that drops the guard, or lets the "not found" path fall back to
// the real `claude` CLI, would let this eval catch it before it ships — mirrors
// the exact failure mode measured and fixed in codex-session 1.0.2 (see
// routing/codex-session-local-only.eval.ts's RELIABILITY HISTORY note).
//
// Two independent contracts, checked separately:
//   1. No tool call launches `claude`, `claude-run.sh`, an Anthropic API/SDK, or
//      any auth/network path.
//   2. Given a UUID, the parser runs first — no grep/find sweep over the
//      transcript store instead of `scripts/claude-session.py`.
//
// Word-boundary care: `\bclaude\b` false-matches the legitimate parser path
// `scripts/claude-session.py` (excluded explicitly below) and the legitimate
// config-dir path `~/.claude` — a bare word-boundary regex still matches
// "claude" right after the "." in "~/.claude" since "." is a non-word char. A
// negative lookbehind for a preceding "." excludes that path reference while
// still catching a real `claude ...` command invocation.
export default defineEval({
  description: "claude-session loads for a session ask without launching Claude or a model provider.",
  tags: ["live", "routing", "claude-session", "local-only"],
  async test(t) {
    const turn = await t.send(
      "What did my Claude session a1b2c3d4-0000-4000-8000-000000000099 do in its last few turns?",
    )
    t.loadedSkill("claude-session")
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { name?: string; input?: unknown }
          const blob = JSON.stringify(call.input ?? {})
          // Local parser script is allowed (path contains claude-session).
          if (/claude-session\.py/.test(blob)) return false
          // Explicit wrapper script the guard names.
          if (/\bclaude-run\.sh\b/.test(blob)) return true
          // `claude` as a launched command — not a `.claude` config-dir path
          // reference and not the `claude-session` path segment.
          if (/(?<!\.)\bclaude(?!-session)\b/.test(blob)) return true
          if (/\b(anthropic|openai)\b.*\b(api|sdk)\b/i.test(blob)) return true
          if (/\bnpx\s+claude\b|\bbunx\s+claude\b/.test(blob)) return true
          return false
        })
      }, "no tool input launches the claude CLI, claude-run.sh, or a model provider"),
    )
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((c) => {
          const call = c as { name?: string; input?: unknown }
          const blob = JSON.stringify(call.input ?? {})
          if (/claude-session\.py/.test(blob)) return false
          // Grepping/finding over the transcript store directly, bypassing the
          // parser, is the filesystem-sweep the guard forbids.
          return /\b(grep|rg|find)\b/.test(blob) && /\.claude\b|CLAUDE_CONFIG_DIR/.test(blob)
        })
      }, "no tool call greps/finds over ~/.claude instead of running the parser"),
    )
    // Every tool call resolved. Three evals silently tolerated failed
    // load_skill calls before this gate existed.
    t.noFailedActions()
  },
})
