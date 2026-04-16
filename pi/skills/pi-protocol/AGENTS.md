# Agents

- `planner`: Claude primary. Handles interactive planning steps (posture, clarify,
  lateral thinking, distill, task proposal). Runs as a foreground subagent.
- `claude-researcher`: Claude primary. Evaluates implementation approaches for a
  primitive using 3-layer analysis (boring/proven, trending, first-principles).
- `generator`: Claude primary builder. Executes the brief as one coherent
  implementation run. Spawned during `/pi:execute` when
  `execution_policy.primary_executor` is `claude` (default).
- `codex-executor`: Codex primary builder. Thin wrapper that shells to
  `codex exec` against the active contract. Spawned during `/pi:execute` when
  `execution_policy.primary_executor` is `codex`. Produces the same build
  checkpoint shape the coordinator expects.
- `evaluator`: Claude primary. Runs verification, grades the build,
  incorporates reviewer output from the coordinator, and produces repair
  guidance.
- `codex-researcher`: Codex secondary critic. Evaluates implementation
  approaches for a primitive using the same 3-layer analysis via the Codex
  CLI. Enabled when `research_policy.providers` includes `codex`.
- `gemini-researcher`: Gemini secondary critic. Same 3-layer analysis as
  `codex-researcher`, wraps `gemini -p`. Enabled when
  `research_policy.providers` includes `gemini`.
- `codex-reviewer`: Codex secondary critic. Challenges the plan or reviews
  the latest diff before signoff. Enabled when `research_policy.providers`
  includes `codex`.
- `gemini-reviewer`: Gemini secondary critic. Same review schema as
  `codex-reviewer`, wraps `gemini -p`. Enabled when
  `research_policy.providers` includes `gemini`.

Secondary critics are always spawned by the coordinator, not by other
agents. Primary builders (`generator`, `codex-executor`) are interchangeable
from the coordinator's perspective — only one is spawned per build pass,
selected by `execution_policy.primary_executor`.
