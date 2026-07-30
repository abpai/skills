import { defineEvalConfig } from "eve/evals"
import { createOpenAI } from "@ai-sdk/openai"

// Deterministic-first: most assertions here are gates on routing and reply
// contracts (includes / satisfies), which need no judge model. A judge is
// declared so any `t.judge.*` assertion resolves without editing every eval; it
// is only reached when an eval opts in.
//
// The judge runs on the same OpenAI `sk-` key as the subject. No Vercel gateway
// key is available, so a string id like "anthropic/claude-haiku-4.5" (which
// routes through the gateway) would SKIP for lack of credentials. An AI SDK
// model instance is used directly with OPENAI_API_KEY instead. NOTE: subject and
// judge share a model family here — acceptable given the credential constraint,
// but a cross-family judge (needs a gateway/Anthropic key) is the stronger setup
// to revisit. Override the judge id with EVE_JUDGE_MODEL.
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default defineEvalConfig({
  judge: { model: openai(process.env.EVE_JUDGE_MODEL ?? "gpt-5.6-luna") },
})
