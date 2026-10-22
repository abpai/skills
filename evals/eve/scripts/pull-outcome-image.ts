import { OUTCOME_IMAGE } from "../evals/support/outcome"
import { PSTACK_BUN_IMAGE } from "../evals/support/pstack"
import { runEvalCommand } from "../../../scripts/lib/eval-command"

// Verifier runs use `--pull never`, so every pinned image is pulled here.
for (const image of [OUTCOME_IMAGE, PSTACK_BUN_IMAGE]) {
  const status = await runEvalCommand(["docker", "pull", image], {
    cwd: process.cwd(),
    label: `pull verifier image ${image}`,
    timeoutMs: 120_000,
  })
  if (status !== 0) process.exit(status)
}
