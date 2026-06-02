#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLUGIN_DIRS=()
while IFS= read -r f; do
  PLUGIN_DIRS+=("$(dirname "$(dirname "$f")")")
done < <(find . -mindepth 3 -maxdepth 3 -path './*/.claude-plugin/plugin.json' -type f | sort)

if [[ ${#PLUGIN_DIRS[@]} -eq 0 ]]; then
  echo "No plugin manifests found."
  exit 1
fi

failed=0
declare -A versions

is_disabled_model_invocation() {
  awk '
    /^---$/ { fence++; next }
    fence == 1 && /^disable-model-invocation:[ ]*true[ ]*$/ { found=1 }
    fence >= 2 { exit }
    END { exit found ? 0 : 1 }
  ' "$1"
}

extract_skill_version() {
  awk '
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
  ' "$1"
}

extract_manifest_version() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("version", ""))' "$1"
}

for plugin_dir in "${PLUGIN_DIRS[@]}"; do
  plugin_name="$(basename "$plugin_dir")"
  versioned_skill_found=0

  while IFS= read -r skill_file; do
    skill_dir="$(dirname "$skill_file")"
    skill_name="$(basename "$skill_dir")"

    if is_disabled_model_invocation "$skill_file"; then
      continue
    fi

    version="$(extract_skill_version "$skill_file")"

    if [[ -z "$version" ]]; then
      echo "[FAIL] $skill_dir: missing metadata.version in frontmatter"
      failed=1
      continue
    fi

    versions["$skill_name"]="$version"
    versioned_skill_found=1
  done < <(find "$plugin_dir/skills" -name 'SKILL.md' -type f 2>/dev/null | sort)

  if [[ "$versioned_skill_found" == "0" ]]; then
    manifest="$plugin_dir/.claude-plugin/plugin.json"
    version="$(extract_manifest_version "$manifest")"
    if [[ -z "$version" ]]; then
      echo "[FAIL] $manifest: missing version"
      failed=1
      continue
    fi
    versions["$plugin_name"]="$version"
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "Cannot generate versions.json — some plugins are missing version metadata."
  exit 1
fi

# Build JSON output (sorted by skill name)
output="versions.json"
{
  echo '{'
  echo '  "schema_version": 1,'
  echo '  "skills": {'

  # Sort keys and emit JSON entries
  mapfile -t sorted_keys < <(printf '%s\n' "${!versions[@]}" | sort)
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
