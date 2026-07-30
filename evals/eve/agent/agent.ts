import { defineAgent } from "eve"
import { mockModel } from "eve/evals"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"

// The eval agent loads the marketplace's real SKILL.md packages from
// `agent/skills/`, which `bun run prepare-skills` materializes from the
// canonical repo paths (never hand-edited here). Eve advertises each skill's
// description and the model pulls the body in with `load_skill` — so this
// harness exercises description routing AND body behavior, the two things a
// structural CI check cannot.
//
// Provider is chosen by which key is present, so the harness is runnable three
// ways:
//
//   - No key at all (local, CI without secrets): a deterministic `mockModel`.
//     The untagged `smoke` eval boots the server and asserts the harness works
//     end to end without spending a token. `live`-tagged behavioral evals are
//     meaningless under the mock and are not run.
//
//   - OPENAI_API_KEY: GPT-5.6-luna hit DIRECTLY via the OpenAI provider
//     (api.openai.com). The model id is `gpt-5.6-luna`, NOT the gateway's
//     `openai/gpt-5.6-luna` slug — that path needs a Vercel gateway key; this
//     one uses the OpenAI `sk-` key.
//
//   - ANTHROPIC_API_KEY: a Claude model. These skills mostly run under Claude
//     Code and Codex in practice, so verifying their contracts on Claude tests
//     what users actually experience rather than a proxy for it. Set
//     EVE_EVAL_PROVIDER=anthropic to select this when both keys are present.
//
// Override the model with EVE_EVAL_MODEL; it applies to whichever provider is
// selected.
type Provider = "openai" | "anthropic" | "mock"

const DEFAULT_MODEL: Record<Exclude<Provider, "mock">, string> = {
  openai: "gpt-5.6-luna",
  anthropic: "claude-sonnet-5",
}

function selectProvider(): Provider {
  const requested = process.env.EVE_EVAL_PROVIDER?.trim().toLowerCase()
  if (requested === "openai" || requested === "anthropic") {
    const key = requested === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"
    if (!process.env[key]) {
      // Fail loudly. Silently downgrading to the mock here would let a whole
      // live suite "pass" against a stub model.
      throw new Error(
        `EVE_EVAL_PROVIDER=${requested} but ${key} is not set. Set the key, or ` +
          `unset EVE_EVAL_PROVIDER to auto-select from whichever key is present.`,
      )
    }
    return requested
  }
  if (requested) {
    throw new Error(
      `EVE_EVAL_PROVIDER="${requested}" is not recognized (expected "openai" or "anthropic").`,
    )
  }
  if (process.env.OPENAI_API_KEY) return "openai"
  if (process.env.ANTHROPIC_API_KEY) return "anthropic"
  return "mock"
}

const provider = selectProvider()
const modelId = process.env.EVE_EVAL_MODEL ?? (provider === "mock" ? "" : DEFAULT_MODEL[provider])

function resolveModel() {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId)
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId)
    case "mock":
      return mockModel("Mock harness reply — set OPENAI_API_KEY or ANTHROPIC_API_KEY to run live evals.")
  }
}

export default defineAgent({
  model: resolveModel(),
  // The mock model has no context-window metadata, so give the runtime an
  // explicit window (skips the metadata lookup that otherwise fails agent
  // compaction at boot). Under a real model this is left to the provider.
  ...(provider === "mock" ? { modelContextWindowTokens: 200_000 } : {}),
})
