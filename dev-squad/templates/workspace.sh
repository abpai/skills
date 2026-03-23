#!/bin/bash
SESSION="${1:-squad}"
PROJECT="$(pwd)"

tmux new-session -d -s "$SESSION" -x 200 -y 50

# Left pane: Claude Code (60%)
tmux send-keys -t "$SESSION" "claude" Enter

# Right top: Task logger (40% width)
tmux split-window -h -t "$SESSION" -p 40
WATCH_CMD="watch -n5 ./.agents/timeline.sh"
command -v watch >/dev/null || WATCH_CMD='while true; do clear; ./.agents/timeline.sh; sleep 5; done'
tmux send-keys -t "$SESSION" "$WATCH_CMD" Enter

# Right bottom: Orb (if available)
if command -v orb >/dev/null; then
  tmux split-window -v -t "$SESSION"
  tmux send-keys -t "$SESSION" "orb $PROJECT --model=sonnet --voice=marius" Enter
fi

# Focus on Claude Code
tmux select-pane -t "$SESSION:0.0"
tmux attach -t "$SESSION"
