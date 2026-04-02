# Dev Squad Setup

Use `./scripts/scan_repo.sh <target-repo>` first so the interview starts from
the repo that is actually on disk.

Use `./scripts/merge_settings.py EXISTING_JSON TEMPLATE_JSON OUTPUT_JSON` when
writing `.claude/settings.json`. It preserves unrelated settings and appends new
hooks without clobbering existing config. If you want a convenience wrapper, the
legacy `./scripts/merge-settings.sh` script is still available.

The generated setup usually includes:

- `.claude/hooks/log-intent.sh`
- `.claude/hooks/track-and-log.sh`
- `.claude/hooks/log-bash-events.sh`
- `.claude/hooks/log-agent-start.sh`
- `.claude/hooks/log-agent-stop.sh`
- optional `.claude/hooks/review-gate.sh`
- `.claude/agents/reviewer.md`
- `.claude/agents/qa.md`
- optional `.claude/agents/browser-qa.md`
- optional `.claude/agents/codex-impl.md`
- `.agents/timeline.sh`

If review gating is enabled, the reviewer must bypass the Stop hook so it can
finish and clear the queue. If it is disabled, the merge helper removes that
hook cleanly instead of leaving stale gating behind.

The setup does not require tmux. If the user wants a richer launcher with Orb
and a live timeline pane, point them to the optional `tmux-squad` launcher
instead of generating a workspace script into the repo.
