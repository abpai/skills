#!/bin/bash
INPUT=$(cat)
AGENT=$(printf '%s' "$INPUT" | jq -r '.agent_type // .subagent_type // empty' 2>/dev/null)
QUEUE=".agents/.review-queue"

# Let the reviewer finish so the queue can be cleared on PASS.
if [[ "$AGENT" == "reviewer" ]]; then
  exit 0
fi

if [ -f "$QUEUE" ] && [ -s "$QUEUE" ]; then
  COUNT=$(wc -l < "$QUEUE" | tr -d ' ')
  echo "$(date '+%H:%M')  ⏳ review gate: $COUNT files pending" >> .agents/timeline.log
  echo "BLOCKED: $COUNT files modified but not reviewed. Invoke the reviewer agent on the changed files, then try again." >&2
  exit 2
fi
