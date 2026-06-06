#!/usr/bin/env bash
# short-function-rank.sh — rank functions shortest-body-first to surface UNLABELED
# structural stubs that no keyword grep finds (the lens's Core Insight, executable).
#
# Usage:
#   short-function-rank.sh <lang> [path] [max-body-lines]
#     <lang>           ast-grep language: Rust | Python | TypeScript | Go | ...
#     [path]           dir/file to scan (default: .)
#     [max-body-lines] if given, only emit functions whose body spans < N lines
#                      (default: print the 20 shortest, sorted ascending)
#
# Examples:
#   short-function-rank.sh Rust src/            # 20 shortest fns under src/
#   short-function-rank.sh Rust src/ 3          # only fns whose body is < 3 lines
#   short-function-rank.sh TypeScript app/ 2
#
# Functions under ~3 lines in a non-trivial module deserve scrutiny: a tiny body
# in business-logic code is the classic structural stub. Legit accessors,
# getters, and builders are the expected false positives — read each hit, don't
# auto-flag (see the lens False positives section).
set -euo pipefail

LANG_ARG="${1:?usage: short-function-rank.sh <lang> [path] [max-body-lines]}"
SCAN_PATH="${2:-.}"
MAX_LINES="${3:-}"

command -v ast-grep >/dev/null 2>&1 || { echo "ast-grep: not installed" >&2; exit 3; }
command -v jq       >/dev/null 2>&1 || { echo "jq: not installed" >&2; exit 3; }

# Pattern differs slightly per language; the $$$BODY metavar captures the whole body
# so range.end.line - range.start.line measures real body span.
case "$LANG_ARG" in
  Rust)                    PATTERN='fn $NAME($$$) $$$BODY' ;;
  TypeScript|JavaScript|Tsx) PATTERN='function $NAME($$$) { $$$BODY }' ;;
  Go)                      PATTERN='func $NAME($$$) $$$BODY' ;;
  Python)                  PATTERN='def $NAME($$$):
    $$$BODY' ;;
  *)                       PATTERN='fn $NAME($$$) $$$BODY' ;;
esac

RAW="$(ast-grep run -l "$LANG_ARG" -p "$PATTERN" --json 2>/dev/null || echo '[]')"

if [ -n "$MAX_LINES" ]; then
  echo "$RAW" | jq --argjson n "$MAX_LINES" \
    '[.[] | select((.range.end.line - .range.start.line) < $n)
        | {name: (.metaVariables.NAME.text // "?"), file: .file,
           line: (.range.start.line + 1),
           body_lines: (.range.end.line - .range.start.line)}]
     | sort_by(.body_lines)'
else
  echo "$RAW" | jq \
    '[.[] | {name: (.metaVariables.NAME.text // "?"), file: .file,
             line: (.range.start.line + 1),
             body_lines: (.range.end.line - .range.start.line)}]
     | sort_by(.body_lines) | .[:20]'
fi
