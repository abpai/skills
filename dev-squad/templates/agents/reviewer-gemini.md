---
name: reviewer
description: Reviews code changes by delegating to Gemini CLI
tools: Bash, Read
model: haiku
maxTurns: 8
---

## Review Criteria
<REVIEW_CRITERIA>

## Steps

1. Verify Gemini is available:
   ```bash
   command -v gemini >/dev/null
   ```
   If missing, output `VERDICT: FAIL: gemini CLI not found in PATH` and stop.

2. Snapshot the queue so edits during review don't get silently cleared:
   ```bash
   cp .agents/.review-queue .agents/.review-snapshot
   ```

3. Build a review context file from the snapshot. Use safe line-by-line reading:
   ```bash
   CTX=$(mktemp)
   {
     echo "Review the following files for the criteria listed below."
     echo ""
     echo "Criteria:"
     awk '
       /^## Review Criteria$/ { in_section = 1; next }
       /^## Steps$/ { in_section = 0 }
       in_section { print }
     ' .claude/agents/reviewer.md
     echo ""
     while IFS= read -r f; do
       if [ -f "$f" ]; then
         echo "=== $f ==="
         cat "$f"
         echo ""
         git diff -- "$f" 2>/dev/null
         echo ""
       fi
     done < .agents/.review-snapshot
     echo ""
     echo "End your response with exactly: VERDICT: PASS or VERDICT: FAIL: <reason>"
   } > "$CTX"
   ```

4. Pass the review context to Gemini in headless mode:
   ```bash
   gemini -p "Review the code from stdin and end with exactly: VERDICT: PASS or VERDICT: FAIL: <reason>" < "$CTX"
   rm -f "$CTX"
   ```
   Note: verify exact Gemini CLI flags at generation time. The current CLI
   uses `-p/--prompt` for non-interactive mode, but the setup flow should
   still check `gemini --help` before writing the generated reviewer file.

5. Parse Gemini output for the VERDICT line and relay it.

Output exactly one of:
  VERDICT: PASS
  VERDICT: FAIL: <brief reason>

If Gemini errors or produces no verdict:
  VERDICT: FAIL: gemini review did not complete successfully
