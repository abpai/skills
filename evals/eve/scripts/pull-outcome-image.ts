import { spawnSync } from "node:child_process"
import { OUTCOME_IMAGE } from "../evals/support/outcome"

const result = spawnSync("docker", ["pull", OUTCOME_IMAGE], {
  stdio: "inherit",
  env: process.env,
})

if (result.error) {
  console.error(`Could not start Docker: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
