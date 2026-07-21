import { defineAgent } from "eve"
import { mockModel } from "eve/evals"
import { createOpenAI } from "@ai-sdk/openai"

// The eval agent loads the marketplace's real SKILL.md packages from
// `agent/skills/`, which `bun run prepare-skills` materializes from the
// canonical repo paths (never hand-edited here). Eve advertises each skill's
// description and the model pulls the body in with `load_skill` — so this
// harness exercises description routing AND body behavior, the two things a
// structural CI check cannot.
//
// Model is chosen by environment so the harness is runnable two ways:
//   - No OPENAI_API_KEY (local, CI without secrets): a deterministic `mockModel`.
//     The untagged `smoke` eval boots the server and asserts the harness works
//     end to end without spending a token. `live`-tagged behavioral evals are
//     meaningless under the mock and are not run.
//   - OPENAI_API_KEY present: the real GPT-5.6-luna model hit DIRECTLY via the
//     OpenAI provider (api.openai.com). The model id is `gpt-5.6-luna`, NOT the
//     gateway's `openai/gpt-5.6-luna` slug — that path needs a Vercel gateway
//     key; this one uses the OpenAI `sk-` key. The `live` behavioral evals then
//     exercise routing and the skills' safety/stop contracts.
const modelId = process.env.EVE_EVAL_MODEL ?? "gpt-5.6-luna"
const useMock = !process.env.OPENAI_API_KEY
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default defineAgent({
  model: useMock
    ? mockModel("Mock harness reply — set OPENAI_API_KEY to run live evals.")
    : openai(modelId),
  // The mock model has no context-window metadata, so give the runtime an
  // explicit window (skips the metadata lookup that otherwise fails agent
  // compaction at boot). Under a real model this is left to the provider.
  ...(useMock ? { modelContextWindowTokens: 200_000 } : {}),
})
