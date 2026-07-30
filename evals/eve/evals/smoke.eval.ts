import { defineEval } from "eve/evals"

// Boot proof. Runs under the deterministic mockModel (no API key), so it
// verifies the whole lane works — Eve installs, the agent boots, the dev
// server accepts a session, an eval discovers and grades a turn — without
// spending a token or depending on any skill. This is the one eval expected to
// pass locally and in secretless CI; the `live`-tagged evals below need a real
// model and only run where OPENAI_API_KEY is set.
export default defineEval({
  description: "Harness boots and completes a turn under the mock model.",
  async test(t) {
    await t.send("ping")
    t.succeeded()
    t.noFailedActions()
  },
})
