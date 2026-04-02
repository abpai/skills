#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── Discover plugins (top-level dirs with .claude-plugin/plugin.json) ──

PLUGIN_DIRS=()
while IFS= read -r d; do
  PLUGIN_DIRS+=("$d")
done < <(find . -mindepth 3 -maxdepth 3 -path '*/.claude-plugin/plugin.json' \
         -not -path './.claude-plugin/*' \
         | sed 's|/.claude-plugin/plugin.json$||' | sort)

if [[ ${#PLUGIN_DIRS[@]} -eq 0 ]]; then
  echo "No plugins found (no .claude-plugin/plugin.json files)."
  exit 1
fi

failed=0
name_regex='^[a-z0-9]+(-[a-z0-9]+)*$'

echo "Found ${#PLUGIN_DIRS[@]} plugins."

# ── Validate each plugin ──

for plugin_dir in "${PLUGIN_DIRS[@]}"; do
  plugin_name="$(basename "$plugin_dir")"
  manifest="$plugin_dir/.claude-plugin/plugin.json"

  # Check plugin.json has required fields
  if ! python3 -c "
import json, sys
path, expected_name = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}')
    sys.exit(1)
name = data.get('name')
if not name:
    print(f'[FAIL] {path}: missing name'); sys.exit(1)
if name != expected_name:
    print(f'[FAIL] {path}: name \"{name}\" does not match directory \"{expected_name}\"'); sys.exit(1)
if not data.get('version'):
    print(f'[FAIL] {path}: missing version'); sys.exit(1)
if not data.get('description'):
    print(f'[FAIL] {path}: missing description'); sys.exit(1)
" "$manifest" "$plugin_name"; then
    failed=1
    continue
  fi

  # Find SKILL.md files inside this plugin
  SKILL_FILES=()
  while IFS= read -r f; do
    SKILL_FILES+=("$f")
  done < <(find "$plugin_dir/skills" -name 'SKILL.md' -type f 2>/dev/null | sort)

  if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
    has_commands="$(find "$plugin_dir/commands" -name '*.md' -type f 2>/dev/null | head -1)"
    has_agents="$(find "$plugin_dir/agents" -name '*.md' -type f 2>/dev/null | head -1)"
    if [[ -z "$has_commands" && -z "$has_agents" ]]; then
      echo "[FAIL] $plugin_dir: no skills, commands, or agents found"
      failed=1
    fi
  fi

  # Validate each SKILL.md
  for skill_file in "${SKILL_FILES[@]}"; do
    skill_subdir="$(dirname "$skill_file")"
    skill_name="$(basename "$skill_subdir")"

    name_line="$(awk '/^name:/{print; exit}' "$skill_file" || true)"
    desc_line="$(awk '/^description:/{print; exit}' "$skill_file" || true)"

    if [[ -z "$name_line" ]]; then
      echo "[FAIL] $skill_file: missing 'name' in frontmatter"
      failed=1
      continue
    fi

    actual_name="${name_line#name: }"
    actual_name="${actual_name%\"}"
    actual_name="${actual_name#\"}"

    if [[ "$actual_name" != "$skill_name" ]]; then
      echo "[FAIL] $skill_file: name '$actual_name' does not match folder '$skill_name'"
      failed=1
    fi

    if [[ ! "$actual_name" =~ $name_regex ]]; then
      echo "[FAIL] $skill_file: name '$actual_name' must be lowercase kebab-case"
      failed=1
    fi

    if (( ${#actual_name} > 64 )); then
      echo "[FAIL] $skill_file: name exceeds 64 chars"
      failed=1
    fi

    if [[ -z "$desc_line" ]]; then
      echo "[FAIL] $skill_file: missing 'description' in frontmatter"
      failed=1
    fi
  done

  echo "  [OK] $plugin_name"
done

# ── Validate marketplace.json ──

marketplace=".claude-plugin/marketplace.json"
if [[ -f "$marketplace" ]]; then
  python3 -c "
import json, sys
path = sys.argv[1]
try:
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}'); sys.exit(1)
if not data.get('name'):
    print(f'[FAIL] {path}: missing name'); sys.exit(1)
if not data.get('owner'):
    print(f'[FAIL] {path}: missing owner'); sys.exit(1)
plugins = data.get('plugins', [])
if not plugins:
    print(f'[FAIL] {path}: no plugins listed'); sys.exit(1)
names = set()
for i, p in enumerate(plugins):
    n = p.get('name')
    if not n:
        print(f'[FAIL] {path}: plugins[{i}] missing name'); sys.exit(1)
    if n in names:
        print(f'[FAIL] {path}: duplicate plugin name \"{n}\"'); sys.exit(1)
    names.add(n)
    if not p.get('source'):
        print(f'[FAIL] {path}: plugins[{i}] (\"{n}\") missing source'); sys.exit(1)
print(f'  [OK] marketplace.json ({len(plugins)} plugins)')
" "$marketplace" || failed=1
else
  echo "[WARN] No .claude-plugin/marketplace.json found"
fi

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Validation passed."
