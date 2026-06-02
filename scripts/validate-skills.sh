#!/usr/bin/env bash
set -euo pipefail

SKIP_VERSIONS=false
for arg in "$@"; do
  case "$arg" in
    --skip-versions) SKIP_VERSIONS=true ;;
  esac
done

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
import json, re, sys
from pathlib import Path

path, expected_name, name_regex = sys.argv[1], sys.argv[2], sys.argv[3]
manifest_path = Path(path).resolve()
plugin_dir = manifest_path.parent.parent
meta_dir = manifest_path.parent

try:
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}')
    sys.exit(1)

name = data.get('name')
if not name:
    print(f'[FAIL] {path}: missing name')
    sys.exit(1)
if name != expected_name:
    print(f'[FAIL] {path}: name \"{name}\" does not match directory \"{expected_name}\"')
    sys.exit(1)
if not re.fullmatch(name_regex, name):
    print(f'[FAIL] {path}: name \"{name}\" must be lowercase kebab-case')
    sys.exit(1)

version = data.get('version')
if not version:
    print(f'[FAIL] {path}: missing version')
    sys.exit(1)
if not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?', version):
    print(f'[FAIL] {path}: version \"{version}\" is not semantic-version shaped')
    sys.exit(1)

if not data.get('description'):
    print(f'[FAIL] {path}: missing description')
    sys.exit(1)

extras = sorted(p.name for p in meta_dir.iterdir() if p.name != 'plugin.json')
if extras:
    joined = ', '.join(extras)
    print(f'[FAIL] {meta_dir}: only plugin.json belongs in .claude-plugin (found: {joined})')
    sys.exit(1)

def validate_path_entry(key, entry):
    if not isinstance(entry, str):
        print(f'[FAIL] {path}: {key} entries must be strings')
        sys.exit(1)
    if not entry.startswith('./'):
        print(f'[FAIL] {path}: {key} path \"{entry}\" must start with ./')
        sys.exit(1)
    resolved = (plugin_dir / entry[2:]).resolve()
    try:
        resolved.relative_to(plugin_dir)
    except ValueError:
        print(f'[FAIL] {path}: {key} path \"{entry}\" escapes the plugin root')
        sys.exit(1)
    if not resolved.exists():
        print(f'[FAIL] {path}: {key} path \"{entry}\" does not exist')
        sys.exit(1)

for key in ('commands', 'agents', 'skills', 'outputStyles'):
    value = data.get(key)
    if value is None:
        continue
    entries = [value] if isinstance(value, str) else value
    if not isinstance(entries, list):
        print(f'[FAIL] {path}: {key} must be a string or list of strings')
        sys.exit(1)
    for entry in entries:
        validate_path_entry(key, entry)

for key in ('hooks', 'mcpServers', 'lspServers'):
    value = data.get(key)
    if value is None or isinstance(value, dict):
        continue
    entries = [value] if isinstance(value, str) else value
    if not isinstance(entries, list):
        print(f'[FAIL] {path}: {key} must be a relative path, list of relative paths, or inline object')
        sys.exit(1)
    for entry in entries:
        validate_path_entry(key, entry)
" "$manifest" "$plugin_name" "$name_regex"; then
    failed=1
    continue
  fi

  # Find SKILL.md files inside this plugin
  SKILL_FILES=()
  while IFS= read -r f; do
    SKILL_FILES+=("$f")
  done < <(find "$plugin_dir/skills" -name 'SKILL.md' -type f 2>/dev/null | sort)

  COMMAND_FILES=()
  while IFS= read -r f; do
    COMMAND_FILES+=("$f")
  done < <(find "$plugin_dir/commands" -name '*.md' -type f 2>/dev/null | sort)

  AGENT_FILES=()
  while IFS= read -r f; do
    AGENT_FILES+=("$f")
  done < <(find "$plugin_dir/agents" -name '*.md' -type f 2>/dev/null | sort)

  if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
    has_commands="$(printf '%s\n' "${COMMAND_FILES[@]}" | head -1)"
    has_agents="$(printf '%s\n' "${AGENT_FILES[@]}" | head -1)"
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

    # agentskills.io spec: SKILL.md recommended ≤ 500 lines
    line_count="$(wc -l < "$skill_file")"
    if (( line_count > 500 )); then
      echo "[WARN] $skill_file: $line_count lines exceeds 500-line spec recommendation"
    fi

    # agentskills.io spec: description must be ≤ 1024 chars
    desc_text="$(awk '
      /^---$/ { fence++; next }
      fence == 1 && /^description:/ {
        sub(/^description:[ ]*>?[ ]*/, "")
        if (length($0) > 0) { printf "%s", $0 }
        capturing = 1; next
      }
      fence == 1 && capturing && /^  / {
        sub(/^  /, "")
        printf " %s", $0
        next
      }
      fence == 1 && capturing { exit }
      fence >= 2 { exit }
    ' "$skill_file")"
    if (( ${#desc_text} > 1024 )); then
      echo "[FAIL] $skill_file: description is ${#desc_text} chars (max 1024)"
      failed=1
    fi
  done

  # Validate each command markdown file
  for command_file in "${COMMAND_FILES[@]}"; do
    if ! python3 - "$command_file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
if not text.startswith('---\n'):
    print(f'[FAIL] {path}: missing opening frontmatter fence')
    sys.exit(1)
parts = text.split('\n---\n', 1)
if len(parts) != 2:
    print(f'[FAIL] {path}: missing closing frontmatter fence')
    sys.exit(1)
fields = {}
for line in parts[0].splitlines()[1:]:
    if not line or line.startswith((' ', '\t', '#')):
        continue
    if ':' in line:
        key, value = line.split(':', 1)
        fields[key.strip()] = value.strip().strip('"')
if not fields.get('description'):
    print(f"[FAIL] {path}: missing 'description' in frontmatter")
    sys.exit(1)
PY
    then
      failed=1
    fi
  done

  # Validate each plugin agent file against Claude plugin conventions
  for agent_file in "${AGENT_FILES[@]}"; do
    expected_name="$(basename "$agent_file" .md)"
    if ! python3 - "$agent_file" "$expected_name" "$name_regex" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
expected_name = sys.argv[2]
name_regex = sys.argv[3]
text = path.read_text(encoding='utf-8')
if not text.startswith('---\n'):
    print(f'[FAIL] {path}: missing opening frontmatter fence')
    sys.exit(1)
parts = text.split('\n---\n', 1)
if len(parts) != 2:
    print(f'[FAIL] {path}: missing closing frontmatter fence')
    sys.exit(1)
fields = {}
for line in parts[0].splitlines()[1:]:
    if not line or line.startswith((' ', '\t', '#')):
        continue
    if ':' in line:
        key, value = line.split(':', 1)
        fields[key.strip()] = value.strip().strip('"')
name = fields.get('name')
if not name:
    print(f"[FAIL] {path}: missing 'name' in frontmatter")
    sys.exit(1)
if name != expected_name:
    print(f"[FAIL] {path}: name '{name}' does not match file '{expected_name}.md'")
    sys.exit(1)
if not re.fullmatch(name_regex, name):
    print(f"[FAIL] {path}: name '{name}' must be lowercase kebab-case")
    sys.exit(1)
if len(name) > 64:
    print(f'[FAIL] {path}: name exceeds 64 chars')
    sys.exit(1)
if not fields.get('description'):
    print(f"[FAIL] {path}: missing 'description' in frontmatter")
    sys.exit(1)
for unsupported in ('hooks', 'mcpServers', 'permissionMode'):
    if unsupported in fields:
        print(f"[FAIL] {path}: plugin agents must not declare unsupported '{unsupported}' frontmatter")
        sys.exit(1)
PY
    then
      failed=1
    fi
  done

  hooks_file="$plugin_dir/hooks/hooks.json"
  if [[ -f "$hooks_file" ]]; then
    if ! python3 - "$hooks_file" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}')
    sys.exit(1)
if not isinstance(data, dict):
    print(f'[FAIL] {path}: hooks file must contain a JSON object')
    sys.exit(1)
if 'hooks' not in data:
    print(f'[FAIL] {path}: missing top-level \"hooks\" object')
    sys.exit(1)
if not isinstance(data['hooks'], dict):
    print(f'[FAIL] {path}: top-level \"hooks\" must be an object')
    sys.exit(1)
PY
    then
      failed=1
    fi
  fi

  # ── Validate .codex-plugin/plugin.json (if present) ──

  codex_manifest="$plugin_dir/.codex-plugin/plugin.json"
  if [[ -f "$codex_manifest" ]]; then
    if ! python3 -c "
import json, re, sys
from pathlib import Path

path, expected_name, name_regex = sys.argv[1], sys.argv[2], sys.argv[3]
claude_path = sys.argv[4]
manifest_path = Path(path).resolve()
plugin_dir = manifest_path.parent.parent
meta_dir = manifest_path.parent

try:
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}')
    sys.exit(1)

name = data.get('name')
if not name:
    print(f'[FAIL] {path}: missing name')
    sys.exit(1)
if name != expected_name:
    print(f'[FAIL] {path}: name \"{name}\" does not match directory \"{expected_name}\"')
    sys.exit(1)
if not re.fullmatch(name_regex, name):
    print(f'[FAIL] {path}: name \"{name}\" must be lowercase kebab-case')
    sys.exit(1)

version = data.get('version')
if not version:
    print(f'[FAIL] {path}: missing version')
    sys.exit(1)
if not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?', version):
    print(f'[FAIL] {path}: version \"{version}\" is not semantic-version shaped')
    sys.exit(1)

if not data.get('description'):
    print(f'[FAIL] {path}: missing description')
    sys.exit(1)

extras = sorted(p.name for p in meta_dir.iterdir() if p.name != 'plugin.json')
if extras:
    joined = ', '.join(extras)
    print(f'[FAIL] {meta_dir}: only plugin.json belongs in .codex-plugin (found: {joined})')
    sys.exit(1)

def validate_path_entry(key, entry):
    if not isinstance(entry, str):
        print(f'[FAIL] {path}: {key} entries must be strings')
        sys.exit(1)
    if not entry.startswith('./'):
        print(f'[FAIL] {path}: {key} path \"{entry}\" must start with ./')
        sys.exit(1)
    resolved = (plugin_dir / entry[2:]).resolve()
    try:
        resolved.relative_to(plugin_dir)
    except ValueError:
        print(f'[FAIL] {path}: {key} path \"{entry}\" escapes the plugin root')
        sys.exit(1)
    if not resolved.exists():
        print(f'[FAIL] {path}: {key} path \"{entry}\" does not exist')
        sys.exit(1)

for key in ('skills', 'apps'):
    value = data.get(key)
    if value is None:
        continue
    entries = [value] if isinstance(value, str) else value
    if not isinstance(entries, list):
        print(f'[FAIL] {path}: {key} must be a string or list of strings')
        sys.exit(1)
    for entry in entries:
        validate_path_entry(key, entry)

for key in ('mcpServers',):
    value = data.get(key)
    if value is None or isinstance(value, dict):
        continue
    entries = [value] if isinstance(value, str) else value
    if not isinstance(entries, list):
        print(f'[FAIL] {path}: {key} must be a relative path, list of relative paths, or inline object')
        sys.exit(1)
    for entry in entries:
        validate_path_entry(key, entry)

# Cross-check against Claude manifest
claude = json.loads(Path(claude_path).read_text(encoding='utf-8'))
if name != claude.get('name'):
    print(f'[FAIL] {path}: name \"{name}\" does not match .claude-plugin name \"{claude.get(\"name\")}\"')
    sys.exit(1)
if version != claude.get('version'):
    print(f'[FAIL] {path}: version \"{version}\" does not match .claude-plugin version \"{claude.get(\"version\")}\"')
    sys.exit(1)
" "$codex_manifest" "$plugin_name" "$name_regex" "$manifest"; then
      failed=1
    fi
  fi

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

# ── Validate Codex marketplace ──

codex_marketplace=".agents/plugins/marketplace.json"
if [[ -f "$codex_marketplace" ]]; then
  python3 -c "
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}')
    sys.exit(1)

plugins = data.get('plugins', [])
if not isinstance(plugins, list):
    print(f'[FAIL] {path}: plugins must be a list')
    sys.exit(1)

for i, plugin in enumerate(plugins):
    name = plugin.get('name')
    source = plugin.get('source', {})
    rel_path = source.get('path')
    if not name:
        print(f'[FAIL] {path}: plugins[{i}] missing name')
        sys.exit(1)
    if not rel_path:
        print(f'[FAIL] {path}: plugins[{i}] (\"{name}\") missing source.path')
        sys.exit(1)
    plugin_dir = Path(rel_path)
    if not plugin_dir.exists():
        print(f'[FAIL] {path}: plugins[{i}] (\"{name}\") points to missing path {rel_path!r}')
        sys.exit(1)
    codex_manifest = plugin_dir / '.codex-plugin' / 'plugin.json'
    if not codex_manifest.exists():
        print(
            f'[FAIL] {path}: plugins[{i}] (\"{name}\") points to {rel_path!r} '
            'but that folder has no .codex-plugin/plugin.json'
        )
        sys.exit(1)

print(f'  [OK] {path} ({len(plugins)} plugins)')
" "$codex_marketplace" || failed=1
else
  echo "[WARN] No .agents/plugins/marketplace.json found"
fi

# ── Validate versions.json ──

versions_file="versions.json"
if [[ "$SKIP_VERSIONS" == "true" ]]; then
  echo "  [SKIP] versions.json (--skip-versions)"
elif [[ -f "$versions_file" ]]; then
  python3 -c "
import json
import sys
from pathlib import Path

def extract_version(path: Path) -> str | None:
    in_frontmatter = False
    in_metadata = False
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.rstrip('\n')
        if line == '---':
            if not in_frontmatter:
                in_frontmatter = True
                continue
            break
        if not in_frontmatter:
            continue
        if line.startswith('metadata:'):
            in_metadata = True
            continue
        if in_metadata and line.startswith('  version:'):
            return line.split(':', 1)[1].strip().strip('\"')
        if in_metadata and line and not line.startswith('  '):
            in_metadata = False
    return None

def is_disabled_model_invocation(path: Path) -> bool:
    in_frontmatter = False
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.rstrip('\n')
        if line == '---':
            if not in_frontmatter:
                in_frontmatter = True
                continue
            break
        if not in_frontmatter:
            continue
        if line.strip() == 'disable-model-invocation: true':
            return True
    return False

path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'[FAIL] {path}: cannot parse JSON: {exc}')
    sys.exit(1)

expected = {}
missing_versions = []
for manifest in sorted(Path('.').glob('*/.claude-plugin/plugin.json')):
    plugin_dir = manifest.parent.parent
    plugin_name = plugin_dir.name
    versioned_skill_found = False
    for skill_file in sorted((plugin_dir / 'skills').glob('*/SKILL.md')):
        if is_disabled_model_invocation(skill_file):
            continue
        skill_name = skill_file.parent.name
        version = extract_version(skill_file)
        if not version:
            missing_versions.append(str(skill_file))
            continue
        expected[skill_name] = version
        versioned_skill_found = True

    if not versioned_skill_found:
        try:
            manifest_data = json.loads(manifest.read_text(encoding='utf-8'))
        except Exception as exc:
            print(f'[FAIL] {manifest}: cannot parse JSON: {exc}')
            sys.exit(1)
        version = manifest_data.get('version')
        if not version:
            missing_versions.append(str(manifest))
            continue
        expected[plugin_name] = version

if missing_versions:
    for version_file in missing_versions:
        print(f'[FAIL] {version_file}: missing version metadata')
    sys.exit(1)

actual = data.get('skills')
if data.get('schema_version') != 1:
    print(f'[FAIL] {path}: schema_version must be 1')
    sys.exit(1)
if not isinstance(actual, dict):
    print(f'[FAIL] {path}: skills must be an object')
    sys.exit(1)
if actual != expected:
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    mismatched = sorted(
        skill for skill in expected
        if skill in actual and actual[skill] != expected[skill]
    )
    if missing:
        print(f'[FAIL] {path}: missing skills: {\", \".join(missing)}')
    if extra:
        print(f'[FAIL] {path}: unexpected skills: {\", \".join(extra)}')
    for skill in mismatched:
        print(
            f'[FAIL] {path}: {skill} version {actual[skill]!r} does not match '
            f'frontmatter {expected[skill]!r}'
        )
    sys.exit(1)

print(f'  [OK] {path} ({len(expected)} skills)')
" "$versions_file" || failed=1
else
  echo "[FAIL] $versions_file: missing file"
  failed=1
fi

# ── Validate bundled TypeScript helpers ──

finish_lane_script="code/skills/code/scripts/finish-lane.ts"
if [[ -f "$finish_lane_script" ]]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "[FAIL] $finish_lane_script: bun is required to validate this helper"
    failed=1
  elif bun build "$finish_lane_script" --target=bun --outfile /tmp/skills-validate-finish-lane.js >/tmp/skills-validate-finish-lane.log 2>&1; then
    echo "  [OK] $finish_lane_script (bun build)"
    rm -f /tmp/skills-validate-finish-lane.js /tmp/skills-validate-finish-lane.log
  else
    echo "[FAIL] $finish_lane_script: bun build failed"
    cat /tmp/skills-validate-finish-lane.log
    rm -f /tmp/skills-validate-finish-lane.js /tmp/skills-validate-finish-lane.log
    failed=1
  fi
fi

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Validation passed."
