#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

extract_version() {
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

SKILL_FILES=()
while IFS= read -r f; do
  SKILL_FILES+=("$f")
done < <(find . -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' | sort)

if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
  echo "No SKILL.md files found."
  exit 1
fi

failed=0
name_regex='^[a-z0-9]+(-[a-z0-9]+)*$'
use_skills_ref=0

if command -v skills-ref >/dev/null 2>&1; then
  use_skills_ref=1
  echo "Using skills-ref plus local version checks..."
else
  echo "skills-ref not found on PATH; running local checks only..."
  echo "Install official validator:"
  echo "  uv tool install \"git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref\""
fi

declare -A manifest_versions=()
declare -A skill_versions=()

if [[ ! -f "versions.json" ]]; then
  echo "[FAIL] ./versions.json: missing manifest — run scripts/generate-versions.sh"
  failed=1
elif ! command -v python3 >/dev/null 2>&1; then
  echo "[FAIL] python3 is required to validate versions.json sync"
  failed=1
else
  while IFS=$'\t' read -r manifest_skill manifest_version; do
    manifest_versions["$manifest_skill"]="$manifest_version"
  done < <(
    python3 - <<'PY'
import json
import sys

try:
    with open("versions.json", "r", encoding="utf-8") as fh:
        data = json.load(fh)
except Exception as exc:
    print(f"[FAIL] ./versions.json: unable to parse manifest: {exc}", file=sys.stderr)
    sys.exit(1)

skills = data.get("skills")
if not isinstance(skills, dict):
    print("[FAIL] ./versions.json: missing top-level 'skills' object", file=sys.stderr)
    sys.exit(1)

for key in sorted(skills):
    value = skills[key]
    if not isinstance(value, str):
      print(f"[FAIL] ./versions.json: version for '{key}' must be a string", file=sys.stderr)
      sys.exit(1)
    print(f"{key}\t{value}")
PY
  ) || failed=1
fi

for skill_file in "${SKILL_FILES[@]}"; do
  skill_dir="$(dirname "$skill_file")"
  skill_name="$(basename "$skill_dir")"

  if [[ $use_skills_ref -eq 1 ]]; then
    echo "- validating $skill_dir"
    if ! skills-ref validate "$skill_dir"; then
      failed=1
    fi
  fi

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
  version="$(extract_version "$skill_file")"

  if [[ -z "$version" ]]; then
    echo "[FAIL] $skill_dir: missing 'metadata.version' in frontmatter"
    failed=1
    continue
  fi

  skill_versions["$skill_name"]="$version"

  # Check versions.json is in sync
  if [[ -f "versions.json" && ${#manifest_versions[@]} -gt 0 ]]; then
    manifest_version="${manifest_versions[$skill_name]-}"
    if [[ -z "$manifest_version" ]]; then
      echo "[FAIL] $skill_dir: versions.json is missing '$skill_name' — run scripts/generate-versions.sh"
      failed=1
    elif [[ "$manifest_version" != "$version" ]]; then
      echo "[FAIL] $skill_dir: metadata.version '$version' != versions.json '$manifest_version' — run scripts/generate-versions.sh"
      failed=1
    fi
  fi

done

if [[ -f "versions.json" && ${#manifest_versions[@]} -gt 0 ]]; then
  for manifest_skill in "${!manifest_versions[@]}"; do
    if [[ -z "${skill_versions[$manifest_skill]+x}" ]]; then
      echo "[FAIL] ./versions.json: contains stale skill '$manifest_skill' — run scripts/generate-versions.sh"
      failed=1
    fi
  done
fi

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Validation passed."
