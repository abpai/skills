#!/usr/bin/env bash
# triage-scan.sh — turn a raw scanner jsonl dump into a triageable summary.
# Ported from jeffery-skills/multi-pass-bug-hunting (references/TOOLS.md:
# "UBS Output Parsing"). Generalizes `ubs` to any tool emitting one JSON
# object per line with .severity and .file fields.
#
# Usage:
#   ubs . --format=jsonl > findings.jsonl
#   triage-scan.sh findings.jsonl
# or pipe:
#   ubs . --format=jsonl | triage-scan.sh
set -eu

IN="${1:-/dev/stdin}"
have() { command -v "$1" >/dev/null 2>&1; }
if ! have jq; then echo "jq required" >&2; exit 2; fi

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
cat "$IN" > "$TMP"

echo "=== counts by severity ==="
jq -s 'group_by(.severity) | map({(.[0].severity // "unknown"): length}) | add' "$TMP"

echo; echo "=== errors only (highest-priority, triage first) ==="
jq -c 'select(.severity == "error")' "$TMP"

echo; echo "=== unique affected files ==="
jq -r '.file // empty' "$TMP" | sort -u

echo; echo "Now triage each: real bug / false positive / missing-test / blocker / unrelated."
echo "FP checks: null -> caller validates? type non-null? init-first?   await -> fire-and-forget intentional?"
echo "          leak -> RAII/using/with scope cleanup?   security -> external input AND unsanitized?"
echo "Suppress FPs WITH a reason (// ubs:ignore <reason>). Never suppress security findings unjustified."
