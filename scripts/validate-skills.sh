#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKILL_FILES=()
while IFS= read -r f; do
  SKILL_FILES+=("$f")
done < <(find . -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' | sort)

if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
  echo "No SKILL.md files found."
  exit 1
fi

if command -v skills-ref >/dev/null 2>&1; then
  echo "Using skills-ref for validation..."
  failed=0
  for skill_file in "${SKILL_FILES[@]}"; do
    skill_dir="$(dirname "$skill_file")"
    echo "- validating $skill_dir"
    if ! skills-ref validate "$skill_dir"; then
      failed=1
    fi
  done
  exit $failed
fi

echo "skills-ref not found on PATH; running basic checks..."
echo "Install official validator:"
echo "  uv tool install \"git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref\""

failed=0
name_regex='^[a-z0-9]+(-[a-z0-9]+)*$'

for skill_file in "${SKILL_FILES[@]}"; do
  skill_dir="$(dirname "$skill_file")"
  skill_name="$(basename "$skill_dir")"

  name_line="$(awk '/^name:/{print; exit}' "$skill_file" || true)"
  desc_line="$(awk '/^description:/{print; exit}' "$skill_file" || true)"

  if [[ -z "$name_line" ]]; then
    echo "[FAIL] $skill_dir: missing 'name' in frontmatter"
    failed=1
    continue
  fi

  actual_name="${name_line#name: }"
  actual_name="${actual_name%\"}"
  actual_name="${actual_name#\"}"

  if [[ "$actual_name" != "$skill_name" ]]; then
    echo "[FAIL] $skill_dir: name '$actual_name' does not match folder '$skill_name'"
    failed=1
  fi

  if [[ ! "$actual_name" =~ $name_regex ]]; then
    echo "[FAIL] $skill_dir: name '$actual_name' must be lowercase kebab-case"
    failed=1
  fi

  if (( ${#actual_name} > 64 )); then
    echo "[FAIL] $skill_dir: name exceeds 64 chars"
    failed=1
  fi

  if [[ -z "$desc_line" ]]; then
    echo "[FAIL] $skill_dir: missing 'description' in frontmatter"
    failed=1
  fi

  # Check metadata.version exists
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
    echo "[FAIL] $skill_dir: missing 'metadata.version' in frontmatter"
    failed=1
  fi

  # Check versions.json is in sync
  if [[ -n "$version" && -f "versions.json" ]]; then
    manifest_version="$(python3 -c "
import json, sys
d = json.load(open('versions.json'))
print(d.get('skills', {}).get('$skill_name', ''))
" 2>/dev/null || true)"
    if [[ -n "$manifest_version" && "$manifest_version" != "$version" ]]; then
      echo "[FAIL] $skill_dir: metadata.version '$version' != versions.json '$manifest_version' — run scripts/generate-versions.sh"
      failed=1
    fi
  fi

done

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Basic validation passed."
