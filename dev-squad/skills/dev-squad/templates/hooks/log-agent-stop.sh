#!/bin/bash
INPUT=$(cat)
AGENT=$(echo "$INPUT" | jq -r '.agent_type // .subagent_type // "agent"')
# Check if output contains verdict
OUTPUT=$(echo "$INPUT" | jq -r '.output // empty')
if echo "$OUTPUT" | grep -qi 'VERDICT: PASS'; then
  echo "$(date '+%H:%M')  ✓ $AGENT passed" >> .agents/timeline.log
  # Clear review queue on pass (only the canonical reviewer agent clears)
  if [[ "$AGENT" == "reviewer" ]]; then
    if [ -f .agents/.review-snapshot ]; then
      # Remove only the files the reviewer actually saw (snapshot)
      # New edits that arrived during review stay in the queue
      grep -vxFf .agents/.review-snapshot .agents/.review-queue > .agents/.review-queue.tmp 2>/dev/null || true
      mv .agents/.review-queue.tmp .agents/.review-queue
      rm -f .agents/.review-snapshot
    else
      # Fallback: no snapshot — clear entire queue (backward compat)
      > .agents/.review-queue
    fi
  fi
elif echo "$OUTPUT" | grep -qi 'VERDICT: FAIL'; then
  REASON=$(echo "$OUTPUT" | grep -i 'VERDICT: FAIL' | head -1 | sed 's/.*VERDICT: FAIL[: ]*//')
  echo "$(date '+%H:%M')  ✗ $AGENT failed${REASON:+: $REASON}" >> .agents/timeline.log
else
  echo "$(date '+%H:%M')  ✓ $AGENT finished" >> .agents/timeline.log
fi
