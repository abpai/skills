#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0

# Track for review gate (deduplicate so count = unique files)
grep -qxF "$FILE" .agents/.review-queue 2>/dev/null || echo "$FILE" >> .agents/.review-queue

# LLM-summarized timeline entry
BASENAME=$(basename "$FILE")
SUMMARY=$(echo "In 8-12 casual words, describe editing '$BASENAME'. Use 'we' voice. No quotes, no period. Example: we added input validation to the signup form" \
  | claude -p --model haiku 2>/dev/null | tail -1)
if [ -n "$SUMMARY" ]; then
  echo "$(date '+%H:%M')  △ $SUMMARY" >> .agents/timeline.log
else
  echo "$(date '+%H:%M')  △ edited $BASENAME" >> .agents/timeline.log
fi
