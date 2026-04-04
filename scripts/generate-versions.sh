#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKILL_FILES=()
while IFS= read -r f; do
  SKILL_FILES+=("$f")
done < <(find . -path './*/skills/*/SKILL.md' -type f | sort)

if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
  echo "No SKILL.md files found."
  exit 1
fi

failed=0
declare -A versions

for skill_file in "${SKILL_FILES[@]}"; do
  skill_dir="$(dirname "$skill_file")"
  skill_name="$(basename "$skill_dir")"

  # Extract version from metadata block in YAML frontmatter
  version="$(awk '
    /^---$/ { fence++; next }
    fence == 1 && /^metadata:/ { in_meta=1; next }
    fence == 1 && in_meta && /^[^ ]/ { in_meta=0 }
    fence == 1 && in_meta && /^  version:/ {
      v = $0
      sub(/^  version:[ ]*/, "", v)
      gsub(/"/, "", v)
      print v
      exit
    }
    fence >= 2 { exit }
  ' "$skill_file")"

  if [[ -z "$version" ]]; then
    echo "[FAIL] $skill_dir: missing metadata.version in frontmatter"
    failed=1
    continue
  fi

  versions["$skill_name"]="$version"
done

if [[ $failed -ne 0 ]]; then
  echo "Cannot generate versions.json — some skills are missing metadata.version."
  exit 1
fi

# Build JSON output (sorted by skill name)
output="versions.json"
{
  echo '{'
  echo '  "schema_version": 1,'
  echo '  "skills": {'

  # Sort keys and emit JSON entries
  sorted_keys=($(printf '%s\n' "${!versions[@]}" | sort))
  last_idx=$(( ${#sorted_keys[@]} - 1 ))

  for i in "${!sorted_keys[@]}"; do
    key="${sorted_keys[$i]}"
    val="${versions[$key]}"
    if [[ $i -eq $last_idx ]]; then
      echo "    \"$key\": \"$val\""
    else
      echo "    \"$key\": \"$val\","
    fi
  done

  echo '  }'
  echo '}'
} > "$output"

echo "Generated $output with ${#versions[@]} skills."
