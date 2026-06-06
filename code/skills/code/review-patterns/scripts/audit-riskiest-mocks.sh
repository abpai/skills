#!/usr/bin/env bash
# audit-riskiest-mocks.sh — rank test/source files by mock density so the gate
# targets the highest-divergence-risk mocked tests first.
#
# Ported from jeffery-skills testing-real-service-e2e-no-mocks
# (references/MIGRATION-PLAYBOOK.md, "Step 1: Audit — Find the Riskiest Mocks").
#
# Usage:
#   ./audit-riskiest-mocks.sh [dir ...]        # default: tests/ src/
#
# Output: "<mock-count> <file>" sorted descending. Migrate/mock-free the top
# files first — high mock count on a billing/auth/data path is a Score>=8 signal.

set -euo pipefail

dirs=("$@")
if [ ${#dirs[@]} -eq 0 ]; then
  dirs=(tests src)
fi

existing=()
for d in "${dirs[@]}"; do
  [ -d "$d" ] && existing+=("$d")
done
if [ ${#existing[@]} -eq 0 ]; then
  echo "no target dirs found (looked for: ${dirs[*]})" >&2
  exit 0
fi

# List files containing a mock, then count occurrences per file.
grep -rlE 'vi\.mock|jest\.mock' "${existing[@]}" 2>/dev/null | while read -r f; do
  count=$(grep -cE 'vi\.mock|jest\.mock' "$f")
  printf '%s %s\n' "$count" "$f"
done | sort -rn | head -20
