import { OUTCOME_IMAGE } from "../evals/support/outcome"
import { PSTACK_BUN_IMAGE } from "../evals/support/pstack"
import { runEvalCommand } from "../../../scripts/lib/eval-command"

// Verifier runs use `--pull never`; give each pinned image its own limit.
for (const image of [OUTCOME_IMAGE, PSTACK_BUN_IMAGE]) {
  const code = await runEvalCommand(["docker", "pull", image], {
    cwd: process.cwd(),
    label: `pull outcome verifier ${image}`,
    timeoutMs: 120_000,
  })
  if (code !== 0) process.exit(code)
}
