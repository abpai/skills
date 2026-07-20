import { defineAgent } from "eve"
import { mockModel } from "eve/evals"

// The eval agent loads the marketplace's real SKILL.md packages from
// `agent/skills/`, which `bun run prepare-skills` materializes from the
// canonical repo paths (never hand-edited here). Eve advertises each skill's
// description and the model pulls the body in with `load_skill` — so this
// harness exercises description routing AND body behavior, the two things a
// structural CI check cannot.
//
// Model is chosen by environment so the harness is runnable two ways:
//   - No ANTHROPIC_API_KEY (local, CI without secrets): a deterministic
//     `mockModel`. The untagged `smoke` eval boots the server and asserts the
//     harness works end to end without spending a token. `live`-tagged
//     behavioral evals are meaningless under the mock and are not run.
//   - ANTHROPIC_API_KEY present (CI with secrets): a real model, so the
//     `live` behavioral-contract evals actually exercise routing and the
//     skills' safety/stop contracts.
const liveModel = process.env.EVE_EVAL_MODEL ?? "anthropic/claude-sonnet-5"
const useMock = !process.env.ANTHROPIC_API_KEY

export default defineAgent({
  model: useMock
    ? mockModel("Mock harness reply — set ANTHROPIC_API_KEY to run live evals.")
    : liveModel,
  // The mock model has no AI Gateway context-window metadata, so give the
  // runtime an explicit window (skips the metadata lookup that otherwise fails
  // agent compaction at boot). Under a real model this is left to the gateway.
  ...(useMock ? { modelContextWindowTokens: 200_000 } : {}),
})
