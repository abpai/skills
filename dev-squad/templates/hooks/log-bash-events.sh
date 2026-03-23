#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Detect git commit
if echo "$CMD" | grep -q 'git commit'; then
  MSG=$(git log --oneline -1 2>/dev/null | cut -c9-)
  [ -n "$MSG" ] && echo "$(date '+%H:%M')  ✓ committed: $MSG" >> .agents/timeline.log
fi
