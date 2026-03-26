# Generated Topology

Use this file when deciding which templates to read and which files to produce.

## Always Generate

- `.claude/hooks/log-intent.sh`
- `.claude/hooks/track-and-log.sh`
- `.claude/hooks/log-bash-events.sh`
- `.claude/hooks/log-agent-start.sh`
- `.claude/hooks/log-agent-stop.sh`
- `.agents/timeline.sh`

## Conditional Files

- `.claude/hooks/review-gate.sh` only when the review gate is enabled.
- `.claude/agents/reviewer.md` only when the review gate is enabled.
- `.claude/agents/qa.md` when the repo has a test surface that benefits from an explicit QA agent.
- `.claude/agents/browser-qa.md` only for frontend repos when the user wants visual QA.
- `.claude/agents/codex-impl.md` only when the user selects Codex as the implementer.

## Decision Rules

- Prefer the smallest setup that still gives the repo a useful review or automation loop.
- If the repo already has `.claude/` content, merge settings and preserve unrelated files.
- If the user wants Claude-only automation, avoid generating Codex or Gemini-specific files.
- If the repo is backend-only, skip browser QA entirely.
- If the repo is tiny or experimental, skip the review gate unless the user explicitly wants it.
- If `tmux` is available, mention `tmux-squad` as an optional launcher, but do
  not generate workspace-launcher files into the repo.
