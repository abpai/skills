import { OUTCOME_IMAGE } from "../evals/support/outcome"
import { runEvalCommand } from "../../../scripts/lib/eval-command"

process.exit(await runEvalCommand(["docker", "pull", OUTCOME_IMAGE], {
  cwd: process.cwd(),
  label: `pull outcome verifier ${OUTCOME_IMAGE}`,
  timeoutMs: 120_000,
}))
