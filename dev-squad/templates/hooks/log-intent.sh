#!/bin/bash
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' | head -1 | cut -c1-80)
[ -n "$PROMPT" ] && echo "$(date '+%H:%M')  ● $PROMPT" >> .agents/timeline.log
