#!/usr/bin/env bash
set -euo pipefail

# Sync plugin.json versions from SKILL.md metadata.version.
# SKILL.md "X.Y" becomes "X.Y.0"; "X.Y.Z" stays "X.Y.Z".

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

updated=0

for skill_file in $(find . -path './*/skills/*/SKILL.md' -type f | sort); do
  plugin_dir="$(echo "$skill_file" | cut -d/ -f2)"

  # Extract version from SKILL.md frontmatter
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
done

echo "Synced plugin versions ($updated file(s) updated)."
