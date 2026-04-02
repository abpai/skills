#!/bin/bash
INPUT=$(cat)
AGENT=$(echo "$INPUT" | jq -r '.agent_type // .subagent_type // "agent"')
echo "$(date '+%H:%M')  ● $AGENT started" >> .agents/timeline.log
