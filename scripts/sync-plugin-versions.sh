#!/usr/bin/env bash
set -euo pipefail

# Sync plugin.json versions from model-invocable SKILL.md metadata.version.
# SKILL.md "X.Y" becomes "X.Y.0"; "X.Y.Z" stays "X.Y.Z".

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

updated=0

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

while IFS= read -r manifest; do
  plugin_dir="$(dirname "$(dirname "$manifest")")"
  version=""

  while IFS= read -r skill_file; do
    if is_disabled_model_invocation "$skill_file"; then
      continue
    fi
    version="$(extract_skill_version "$skill_file")"
    if [[ -n "$version" ]]; then
      break
    fi
  done < <(find "$plugin_dir/skills" -name 'SKILL.md' -type f 2>/dev/null | sort)

  # Command-only plugins use their plugin.json as the version source.
  [ -n "$version" ] || continue

  # Normalize to semver: X.Y -> X.Y.0, X.Y.Z stays X.Y.Z
  if [[ "$version" =~ ^[0-9]+\.[0-9]+$ ]]; then
    semver="${version}.0"
  else
    semver="$version"
  fi

  # Update .claude-plugin/plugin.json and .codex-plugin/plugin.json
  for manifest in "$plugin_dir/.claude-plugin/plugin.json" "$plugin_dir/.codex-plugin/plugin.json"; do
    [ -f "$manifest" ] || continue

    current="$(python3 -c "import json; print(json.load(open('$manifest'))['version'])")"
    if [ "$current" != "$semver" ]; then
      python3 -c "
import json
path = '$manifest'
data = json.load(open(path))
data['version'] = '$semver'
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
      echo "  $manifest: $current -> $semver"
      updated=$((updated + 1))
    fi
  done
done < <(find . -mindepth 3 -maxdepth 3 -path './*/.claude-plugin/plugin.json' -type f | sort)

echo "Synced plugin versions ($updated file(s) updated)."
