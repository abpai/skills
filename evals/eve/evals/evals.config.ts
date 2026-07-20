import { defineEvalConfig } from "eve/evals"

// Deterministic-first: most assertions here are gates on routing and reply
// contracts (includes / satisfies), which need no judge model. A judge is
// declared so any `t.judge.*` assertion added later resolves without editing
// every eval; it is only reached when an eval opts in.
export default defineEvalConfig({
  judge: { model: process.env.EVE_JUDGE_MODEL ?? "anthropic/claude-haiku-4.5" },
})
