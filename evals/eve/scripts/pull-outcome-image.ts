import { spawnSync } from "node:child_process"
import { OUTCOME_IMAGE } from "../evals/support/outcome"
import { PSTACK_BUN_IMAGE } from "../evals/support/pstack"

// Verifier runs use `--pull never`, so every pinned image is pulled here.
for (const image of [OUTCOME_IMAGE, PSTACK_BUN_IMAGE]) {
  const result = spawnSync("docker", ["pull", image], {
    stdio: "inherit",
    env: process.env,
  })
  if (result.error) {
    console.error(`Could not start Docker: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}
