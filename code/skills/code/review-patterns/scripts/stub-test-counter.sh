#!/usr/bin/env bash
# Rank test/spec files by assertion count. Zero-assertion files are included.
# Usage: stub-test-counter.sh [path ...] (default: tests)

set -euo pipefail
command -v rg >/dev/null 2>&1 || { echo "error: rg is required" >&2; exit 2; }

targets=("$@")
[[ ${#targets[@]} -gt 0 ]] || targets=(tests)

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
while IFS= read -r file; do
  case "/$file" in
    */tests/*|*/test/*|*/__tests__/*|*/test_*|*/spec_*|*.test.*|*.spec.*|*_test.*|*_spec.*) ;;
    *) continue ;;
  esac
  count=$(rg -c '\b(assert|expect|should|require\.)' -- "$file" 2>/dev/null || true)
  count=${count:-0}
  flag=""
  [[ "$count" -ge 5 ]] || flag="  <-- SUSPECT (<5)"
  printf '%s\t%s%s\n' "$count" "$file" "$flag" >> "$tmp"
done < <(rg --files "${targets[@]}" 2>/dev/null)

if [[ -s "$tmp" ]]; then
  sort -n -k1,1 "$tmp"
else
  echo "(no test/spec files matched)"
fi
