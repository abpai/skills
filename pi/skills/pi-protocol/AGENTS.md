# Agents

- `planner`: Claude primary. Handles interactive planning steps (posture, clarify,
  lateral thinking, distill, task proposal). Runs as a foreground subagent.
- `claude-researcher`: Claude primary. Evaluates implementation approaches for a
  primitive using 3-layer analysis (boring/proven, trending, first-principles).
- `generator`: Claude primary. Executes the brief as one coherent implementation
  run.
- `evaluator`: Claude primary. Runs verification, grades the build, incorporates
  Codex review from the coordinator, and produces repair guidance.
- `codex-researcher`: Codex secondary. Evaluates implementation approaches for a
  primitive using the same 3-layer analysis via the Codex CLI.
- `codex-reviewer`: Codex secondary. Used to challenge the plan or review the
  latest diff before signoff. Always spawned by the coordinator, not by other
  agents.
