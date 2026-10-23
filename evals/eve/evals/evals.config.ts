import { defineEvalConfig } from "eve/evals"
import { createOpenAI } from "@ai-sdk/openai"

// Deterministic-first: most assertions here are gates on routing and reply
// contracts (includes / satisfies), which need no judge model. A judge is
// declared so any `t.judge.*` assertion resolves without editing every eval; it
// is only reached when an eval opts in.
//
// The judge runs on the same OpenAI `sk-` key as the subject. No Vercel gateway
// key is available, so the default gateway judge (`typesafe-ai/jev`) and string
// ids would fail for lack of credentials. eve's judge takes a decision model,
// not a language model, so use the provider's `decisionModel` with
// OPENAI_API_KEY. NOTE: subject and judge share a model family here —
// acceptable given the credential constraint, but a cross-family judge (needs a
// gateway/Anthropic key) is the stronger setup to revisit. The model is fixed
// here and deliberately not env-overridable: a gpt-5.4-mini judge scored
// pstack series reports that met every clause at 0.
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default defineEvalConfig({
  judge: { model: openai.decisionModel("gpt-6-luna") },
})
