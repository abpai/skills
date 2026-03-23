#!/bin/bash
echo "══════════════════════════════════════════════════"
echo " TASK LOGGER                     $(date '+%H:%M')"
echo "══════════════════════════════════════════════════"

QUEUE=".agents/.review-queue"
if [ -f "$QUEUE" ] && [ -s "$QUEUE" ]; then
  echo " ⏳ $(wc -l < "$QUEUE" | tr -d ' ') files pending review"
else
  echo " ✓ review queue clear"
fi
echo "──────────────────────────────────────────────────"

if [ -f .agents/timeline.log ]; then
  tail -25 .agents/timeline.log
else
  echo " (no events yet)"
fi
