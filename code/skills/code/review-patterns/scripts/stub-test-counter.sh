#!/usr/bin/env bash
# stub-test-counter.sh — rank test files by assertion count, ascending, to flag
# placeholder tests (a test file that itself proves nothing).
#
# Threshold: files with < 5 real assertions are suspect. Real case: an E2E audit
# found `null_fields` and `unicode` test files were themselves stubs (only 5-7
# assertions). CAVEAT this MISSES tests with many but shallow assertions — a high
# count is necessary, not sufficient; spot-read the top suspects.
#
# Usage:
#   stub-test-counter.sh [test-dir-or-glob ...]   (default: tests/)
set -euo pipefail

command -v rg >/dev/null 2>&1 || { echo "rg (ripgrep): not installed" >&2; exit 3; }
TARGETS=("$@"); [ ${#TARGETS[@]} -eq 0 ] && TARGETS=("tests/")

# -c counts matching lines per file; sort by the count (2nd colon field) ascending.
rg -c "assert|expect|should|\.to\b|toEqual|toBe" "${TARGETS[@]}" 2>/dev/null \
  | sort -t: -k2 -n \
  | awk -F: '{ flag = ($2 < 5) ? "  <-- SUSPECT (<5)" : ""; printf "%-70s %s%s\n", $1, $2, flag }' \
  || echo "(no test files matched)"
