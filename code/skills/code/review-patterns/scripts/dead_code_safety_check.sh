#!/usr/bin/env bash
# Report repository-local references that make a deletion unsafe.
# Usage: dead_code_safety_check.sh <path> [symbol]
# Output is Markdown on stdout. Exit 0 means no local references were found;
# exit 1 means investigate the listed consumers; exit 2 means invalid usage.

set -euo pipefail

[[ $# -ge 1 ]] || {
  echo "usage: $0 <path> [symbol]" >&2
  exit 2
}
command -v rg >/dev/null 2>&1 || { echo "error: rg is required" >&2; exit 2; }

candidate="$1"
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [[ "$candidate" = /* ]]; then
  candidate_rel=${candidate#"$root"/}
else
  candidate_rel=${candidate#./}
fi
basename_only=$(basename "$candidate")
symbol=${2:-${basename_only%%.*}}

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# One literal scan catches imports, dynamic/string/config/docs/build/test uses.
# Exclude the candidate itself and common generated/vendor directories.
rg --hidden -F -n \
  --glob '!.git/**' --glob '!node_modules/**' --glob '!vendor/**' \
  --glob '!dist/**' --glob '!build/**' --glob "!$candidate_rel" \
  -- "$symbol" "$root" > "$tmp" || true

# A renamed import may mention only the file name/path, not the symbol.
if [[ "$basename_only" != "$symbol" ]]; then
  rg --hidden -F -n \
    --glob '!.git/**' --glob '!node_modules/**' --glob '!vendor/**' \
    --glob '!dist/**' --glob '!build/**' --glob "!$candidate_rel" \
    -- "$basename_only" "$root" >> "$tmp" || true
fi

sort -u -o "$tmp" "$tmp"
count=$(wc -l < "$tmp" | tr -d ' ')
last_change=$(git log -1 --format='%h %cs %s' -- "$candidate_rel" 2>/dev/null || true)

printf '# Dead-code safety check: `%s`\n\n' "$candidate_rel"
printf -- '- Symbol/path key: `%s`\n' "$symbol"
printf -- '- Last change: %s\n' "${last_change:-unavailable}"
printf -- '- References outside candidate: %s\n\n' "$count"

if [[ "$count" -gt 0 ]]; then
  printf '## Blocking references\n\n```text\n'
  sed -n '1,200p' "$tmp"
  printf '```\n\nVerdict: **DO NOT DELETE** until every consumer is resolved.\n'
  exit 1
fi

printf 'Verdict: **no repository-local references found**.\n\n'
printf 'This does not prove that public exports have no external consumers. Preserve '\
'public/plugin/framework entry points unless their external contract is explicitly retired.\n'
