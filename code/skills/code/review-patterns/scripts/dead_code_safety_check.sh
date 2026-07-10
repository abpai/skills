#!/usr/bin/env bash
# Report repository-local references that make a deletion unsafe.
# Usage: dead_code_safety_check.sh <path> [symbol]
# Output is Markdown on stdout. Exit 0 means no local references were found;
# exit 1 means investigate the listed consumers; exit 2 means invalid usage or
# a failed scan (a failed or incomplete scan never reads as "safe to delete").

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

# Module entry files are imported by their parent directory's name
# (`import x from "./pkg"` for pkg/index.ts), so the basename key alone would
# miss every consumer. Scan the directory name as an extra key.
module_key=""
case "$basename_only" in
  index.*|__init__.py|mod.rs)
    parent_dir=$(dirname "$candidate_rel")
    if [[ "$parent_dir" != "." && "$parent_dir" != "/" ]]; then
      module_key=$(basename "$parent_dir")
    fi
    ;;
esac

raw=$(mktemp)
tmp=$(mktemp)
trap 'rm -f "$raw" "$tmp"' EXIT

# One literal scan per key catches imports, dynamic/string/config/docs/build/test
# uses. rg exit 0 = matches, 1 = no matches; anything higher is a failed scan.
scan_literal() {
  local status=0
  rg --hidden -F -n \
    --glob '!.git/**' --glob '!node_modules/**' --glob '!vendor/**' \
    --glob '!dist/**' --glob '!build/**' \
    -- "$1" "$root" >> "$raw" || status=$?
  if [[ "$status" -gt 1 ]]; then
    echo "error: rg failed (exit $status) scanning for '$1'; treat the deletion as unsafe" >&2
    exit 2
  fi
}

scan_literal "$symbol"
# A renamed import may mention only the file name/path, not the symbol.
if [[ "$basename_only" != "$symbol" ]]; then
  scan_literal "$basename_only"
fi
if [[ -n "$module_key" && "$module_key" != "$symbol" ]]; then
  scan_literal "$module_key"
fi

# Drop the candidate's own lines by path prefix rather than an rg --glob, which
# misreads metacharacter paths like app/[slug]/page.tsx (and an invalid glob
# would abort the scan entirely).
awk -v self="$root/$candidate_rel:" 'index($0, self) != 1' "$raw" | sort -u > "$tmp"
count=$(wc -l < "$tmp" | tr -d ' ')
last_change=$(git log -1 --format='%h %cs %s' -- "$candidate_rel" 2>/dev/null || true)

printf '# Dead-code safety check: `%s`\n\n' "$candidate_rel"
printf -- '- Symbol/path key: `%s`%s\n' "$symbol" "${module_key:+ (module key: \`$module_key\`)}"
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
