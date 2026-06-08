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

# Namespaced commands MUST be skills/<name>/SKILL.md — never a plugin-root
# commands/ dir, and never a 'commands' manifest path (flat commands/*.md do not
# acquire the plugin namespace). See CLAUDE.md 'Namespaced commands MUST be skill
# subdirectories'.
if 'commands' in data:
    print(f'[FAIL] {path}: declares a \"commands\" path — flat commands/*.md do not acquire the plugin namespace; convert each into skills/<name>/SKILL.md (see CLAUDE.md)')
    sys.exit(1)
if (plugin_dir / 'commands').is_dir():
    print(f'[FAIL] {plugin_dir}: plugin-root commands/ directory is forbidden — flat commands/*.md do not acquire the plugin namespace; convert each into skills/<name>/SKILL.md (see CLAUDE.md)')
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

for key in ('agents', 'skills', 'outputStyles'):
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

  AGENT_FILES=()
  while IFS= read -r f; do
    AGENT_FILES+=("$f")
  done < <(find "$plugin_dir/agents" -name '*.md' -type f 2>/dev/null | sort)

  if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
    has_agents="$(printf '%s\n' "${AGENT_FILES[@]}" | head -1)"
    if [[ -z "$has_agents" ]]; then
      echo "[FAIL] $plugin_dir: no skills or agents found"
      failed=1
    fi
  fi

  # Does this plugin have an umbrella skill (skills/<plugin>/SKILL.md)? If so,
  # every NON-umbrella sibling skill is a per-command wrapper that must be hidden.
  has_umbrella=0
  if [[ -f "$plugin_dir/skills/$plugin_name/SKILL.md" ]]; then
    has_umbrella=1
  fi

  # Validate each SKILL.md. name/description are parsed from the FIRST '---'
  # fenced YAML frontmatter block only (a body line like `name:` must not count,
  # and a SKILL.md with no frontmatter fence fails). Wrapper-hiding flags are
  # enforced for every non-umbrella sibling when the plugin has an umbrella.
  for skill_file in "${SKILL_FILES[@]}"; do
    skill_subdir="$(dirname "$skill_file")"
    skill_name="$(basename "$skill_subdir")"
    if ! python3 - "$skill_file" "$skill_name" "$plugin_name" "$name_regex" "$has_umbrella" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
skill_name = sys.argv[2]
plugin_name = sys.argv[3]
name_regex = sys.argv[4]
has_umbrella = sys.argv[5] == '1'

text = path.read_text(encoding='utf-8')
lines = text.splitlines()

# ── Parse the FIRST '---' fenced YAML frontmatter block once ──
if not lines or lines[0].strip() != '---':
    print(f"[FAIL] {path}: missing opening frontmatter fence ('---' as first line)")
    sys.exit(1)

fm_lines = []
closed = False
for line in lines[1:]:
    if line.strip() == '---':
        closed = True
        break
    fm_lines.append(line)
if not closed:
    print(f'[FAIL] {path}: missing closing frontmatter fence')
    sys.exit(1)

# Top-level scalar fields and the description (supporting block/folded scalars).
fields = {}
description = None
i = 0
while i < len(fm_lines):
    line = fm_lines[i]
    if not line or line[0] in (' ', '\t', '#'):
        i += 1
        continue
    if ':' not in line:
        i += 1
        continue
    key, value = line.split(':', 1)
    key = key.strip()
    value = value.strip()
    if key == 'description':
        # Folded/literal block scalar: collect following indented lines.
        if value in ('>', '|', '>-', '|-', '>+', '|+', ''):
            parts = []
            j = i + 1
            while j < len(fm_lines) and (fm_lines[j].startswith(('  ', '\t')) or fm_lines[j] == ''):
                stripped = fm_lines[j].strip()
                if stripped:
                    parts.append(stripped)
                j += 1
            description = ' '.join(parts)
            i = j
            continue
        description = value.strip('"').strip("'")
    else:
        fields[key] = value.strip('"').strip("'")
    i += 1

failed = False

# ── name (Finding 8: must come from frontmatter) ──
actual_name = fields.get('name')
if not actual_name:
    print(f"[FAIL] {path}: missing 'name' in frontmatter")
    sys.exit(1)
if actual_name != skill_name:
    print(f"[FAIL] {path}: name '{actual_name}' does not match folder '{skill_name}'")
    failed = True
if not re.fullmatch(name_regex, actual_name):
    print(f"[FAIL] {path}: name '{actual_name}' must be lowercase kebab-case")
    failed = True
if len(actual_name) > 64:
    print(f'[FAIL] {path}: name exceeds 64 chars')
    failed = True

# ── description (Finding 8: must come from frontmatter) ──
if not description:
    print(f"[FAIL] {path}: missing 'description' in frontmatter")
    failed = True

# agentskills.io spec: SKILL.md recommended <= 500 lines
if len(lines) > 500:
    print(f'[WARN] {path}: {len(lines)} lines exceeds 500-line spec recommendation')

# agentskills.io spec: description must be <= 1024 chars
if description and len(description) > 1024:
    print(f'[FAIL] {path}: description is {len(description)} chars (max 1024)')
    failed = True

# ── Wrapper-hiding flags (frontmatter-scoped) ──
disable_mi = fields.get('disable-model-invocation') == 'true'
user_invocable = fields.get('user-invocable')

# metadata.internal: true (nested under a `metadata:` block).
internal = False
in_meta = False
for line in fm_lines:
    if re.fullmatch(r'metadata:\s*', line):
        in_meta = True
        continue
    if in_meta:
        if line and not line[0].isspace():
            in_meta = False
        elif re.fullmatch(r'\s+internal:\s*true\s*', line):
            internal = True

is_umbrella = (skill_name == plugin_name)

# Finding 9: when a plugin has an umbrella, EVERY non-umbrella sibling skill is a
# per-command wrapper and MUST be hidden — set disable-model-invocation: true,
# metadata.internal: true, and user-invocable: false. The documented exception is
# `pi`, which has NO umbrella (handled by has_umbrella being false there). See
# CLAUDE.md "Grouped workflow pack pattern".
if has_umbrella and not is_umbrella:
    if not disable_mi:
        print(f"[FAIL] {path}: per-command wrapper in an umbrella pack must set 'disable-model-invocation: true' (so the model routes through the umbrella, not the wrapper; see CLAUDE.md)")
        failed = True
    if not internal:
        print(f"[FAIL] {path}: per-command wrapper requires 'metadata.internal: true' (user-only wrappers must be hidden from flat-list installers like npx skills/Codex; add a metadata block with 'internal: true')")
        failed = True
    if user_invocable != 'false':
        print(f"[FAIL] {path}: per-command wrapper in an umbrella pack requires 'user-invocable: false' (wrappers must stay out of the Claude Code / menu so the umbrella is the only scoped entry)")
        failed = True
elif disable_mi:
    # Wrapper outside an umbrella pack (e.g. pi phase commands): still must be
    # hidden from flat-list installers, but stays user-invocable since there is
    # no umbrella router to fall back to.
    if not internal:
        print(f"[FAIL] {path}: 'disable-model-invocation: true' requires 'metadata.internal: true' (hide user-only wrappers from flat-list installers like npx skills/Codex; add a metadata block with 'internal: true')")
        failed = True

sys.exit(1 if failed else 0)
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
from pathlib import Path
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

failed = False
names = set()
# entry_path maps each marketplace entry name to the plugin folder it points at,
# so we can verify the source path matches the corresponding manifest.
entry_path = {}
for i, p in enumerate(plugins):
    n = p.get('name')
    if not n:
        print(f'[FAIL] {path}: plugins[{i}] missing name'); sys.exit(1)
    if n in names:
        print(f'[FAIL] {path}: duplicate plugin name \"{n}\"'); sys.exit(1)
    names.add(n)
    source = p.get('source')
    if not source:
        print(f'[FAIL] {path}: plugins[{i}] (\"{n}\") missing source'); sys.exit(1)
    # source may be a string ('./foo') or a dict (e.g. git-subdir with a 'path').
    if isinstance(source, str):
        sp = source
    elif isinstance(source, dict):
        sp = source.get('path')
    else:
        sp = None
    if sp:
        entry_path[n] = Path(sp.lstrip('./')).name

# Set-equality: every Claude plugin (*/.claude-plugin/plugin.json) must appear
# exactly once, with no extras.
expected = set()
manifest_name = {}
for manifest in sorted(Path('.').glob('*/.claude-plugin/plugin.json')):
    pdir = manifest.parent.parent.name
    try:
        mname = json.loads(manifest.read_text(encoding='utf-8')).get('name')
    except Exception as exc:
        print(f'[FAIL] {manifest}: cannot parse JSON: {exc}'); sys.exit(1)
    expected.add(pdir)
    manifest_name[pdir] = mname

missing = sorted(expected - names)
extra = sorted(names - expected)
if missing:
    print(f'[FAIL] {path}: missing plugins (have Claude manifest but no marketplace entry): {\", \".join(missing)}')
    failed = True
if extra:
    print(f'[FAIL] {path}: unexpected plugins (marketplace entry with no Claude manifest): {\", \".join(extra)}')
    failed = True

# Each entry's source path/name must match the corresponding plugin folder/manifest.
for n in sorted(names & expected):
    if n in entry_path and entry_path[n] != n:
        print(f'[FAIL] {path}: plugin \"{n}\" source path points at \"{entry_path[n]}\" (expected folder \"{n}\")')
        failed = True
    if manifest_name.get(n) != n:
        print(f'[FAIL] {path}: plugin \"{n}\" manifest name is {manifest_name.get(n)!r} (expected \"{n}\")')
        failed = True

if failed:
    sys.exit(1)
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

failed = False
names = set()
entry_path = {}
for i, plugin in enumerate(plugins):
    name = plugin.get('name')
    source = plugin.get('source', {})
    rel_path = source.get('path') if isinstance(source, dict) else source
    if not name:
        print(f'[FAIL] {path}: plugins[{i}] missing name')
        sys.exit(1)
    if name in names:
        print(f'[FAIL] {path}: duplicate plugin name \"{name}\"')
        sys.exit(1)
    names.add(name)
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
    entry_path[name] = plugin_dir.name

# Set-equality: every Codex plugin (*/.codex-plugin/plugin.json) must appear
# exactly once. 'pi' is intentionally excluded from Codex (no .codex-plugin),
# so it never enters the expected set and must not appear here. See CLAUDE.md.
expected = set()
manifest_name = {}
for manifest in sorted(Path('.').glob('*/.codex-plugin/plugin.json')):
    pdir = manifest.parent.parent.name
    try:
        mname = json.loads(manifest.read_text(encoding='utf-8')).get('name')
    except Exception as exc:
        print(f'[FAIL] {manifest}: cannot parse JSON: {exc}')
        sys.exit(1)
    expected.add(pdir)
    manifest_name[pdir] = mname

missing = sorted(expected - names)
extra = sorted(names - expected)
if missing:
    print(f'[FAIL] {path}: missing plugins (have Codex manifest but no marketplace entry): {\", \".join(missing)}')
    failed = True
if extra:
    print(f'[FAIL] {path}: unexpected plugins (marketplace entry with no Codex manifest, e.g. the Codex-excluded pi): {\", \".join(extra)}')
    failed = True

for name in sorted(names & expected):
    if entry_path.get(name) != name:
        print(f'[FAIL] {path}: plugin \"{name}\" source path points at \"{entry_path.get(name)}\" (expected folder \"{name}\")')
        failed = True
    if manifest_name.get(name) != name:
        print(f'[FAIL] {path}: plugin \"{name}\" manifest name is {manifest_name.get(name)!r} (expected \"{name}\")')
        failed = True

if failed:
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
    # Finding 15: emit ONE actionable bun-required message and skip every
    # bun-dependent step (build + test) so a missing bun does not spray repeated
    # 'bun: command not found' noise.
    echo "[FAIL] $finish_lane_script: bun is required to validate this helper (and to run its tests); install bun or skip these checks"
    failed=1
  else
    if bun build "$finish_lane_script" --target=bun --outfile /tmp/skills-validate-finish-lane.js >/tmp/skills-validate-finish-lane.log 2>&1; then
      echo "  [OK] $finish_lane_script (bun build)"
      rm -f /tmp/skills-validate-finish-lane.js /tmp/skills-validate-finish-lane.log
    else
      echo "[FAIL] $finish_lane_script: bun build failed"
      cat /tmp/skills-validate-finish-lane.log
      rm -f /tmp/skills-validate-finish-lane.js /tmp/skills-validate-finish-lane.log
      failed=1
    fi

    finish_lane_test="code/skills/code/scripts/finish-lane.test.ts"
    if [[ -f "$finish_lane_test" ]]; then
      if bun test "$finish_lane_test" >/tmp/skills-validate-finish-lane-test.log 2>&1; then
        echo "  [OK] $finish_lane_test (bun test)"
        rm -f /tmp/skills-validate-finish-lane-test.log
      else
        echo "[FAIL] $finish_lane_test: bun test failed"
        cat /tmp/skills-validate-finish-lane-test.log
        rm -f /tmp/skills-validate-finish-lane-test.log
        failed=1
      fi
    fi
  fi
fi

# ── Syntax-check other shipped helper scripts (Finding 14) ──
#
# Low-cost syntax/parse checks across all shipped helpers, each guarded by a
# tool-availability check so a missing tool degrades gracefully (mirrors the
# `command -v bun` guard above) instead of failing the run. Helpers are
# discovered generically under each plugin's skills/ and hooks/ dirs plus the
# repo's own scripts/, excluding finish-lane.* (already built/tested above) and
# this validator itself.

# Shell helpers: `bash -n` parse check.
SHELL_HELPERS=()
while IFS= read -r f; do
  SHELL_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o -name '*.sh' -type f -print \
         | grep -vE '/scripts/validate-skills\.sh$' | sort)
if [[ ${#SHELL_HELPERS[@]} -gt 0 ]]; then
  if ! command -v bash >/dev/null 2>&1; then
    echo "  [SKIP] shell helper syntax checks (bash not found)"
  else
    for sh_file in "${SHELL_HELPERS[@]}"; do
      if ! bash -n "$sh_file" >/tmp/skills-validate-sh.log 2>&1; then
        echo "[FAIL] $sh_file: bash -n syntax check failed"
        cat /tmp/skills-validate-sh.log
        failed=1
      fi
    done
    rm -f /tmp/skills-validate-sh.log
    echo "  [OK] shell helper syntax (${#SHELL_HELPERS[@]} scripts, bash -n)"
  fi
fi

# Python helpers: `python3 -m py_compile` parse check.
PY_HELPERS=()
while IFS= read -r f; do
  PY_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o \
           -path '*/__pycache__/*' -prune -o \
           -path './.ruff_cache/*' -prune -o \
           -path './.understand/*' -prune -o \
           -path './.workflow/*' -prune -o \
           -path './scripts/*' -prune -o \
           -name '*.py' -type f -print | sort)
if [[ ${#PY_HELPERS[@]} -gt 0 ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "  [SKIP] python helper syntax checks (python3 not found)"
  else
    if python3 -m py_compile "${PY_HELPERS[@]}" >/tmp/skills-validate-py.log 2>&1; then
      echo "  [OK] python helper syntax (${#PY_HELPERS[@]} scripts, py_compile)"
    else
      echo "[FAIL] python helper py_compile failed"
      cat /tmp/skills-validate-py.log
      failed=1
    fi
    rm -f /tmp/skills-validate-py.log
  fi
fi

# Other TypeScript helpers: `bun build --target=bun` to a temp outfile. Skips
# finish-lane.ts (built above) and *.test.ts files (exercised via `bun test`).
TS_HELPERS=()
while IFS= read -r f; do
  TS_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o -name '*.ts' -type f -print \
         | grep -vE '/finish-lane(\.test)?\.ts$' \
         | grep -vE '\.test\.ts$' | sort)
if [[ ${#TS_HELPERS[@]} -gt 0 ]]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "  [SKIP] other TypeScript helper builds (bun not found)"
  else
    for ts_file in "${TS_HELPERS[@]}"; do
      if bun build "$ts_file" --target=bun --outfile /tmp/skills-validate-ts.js >/tmp/skills-validate-ts.log 2>&1; then
        rm -f /tmp/skills-validate-ts.js
      else
        echo "[FAIL] $ts_file: bun build failed"
        cat /tmp/skills-validate-ts.log
        failed=1
      fi
    done
    rm -f /tmp/skills-validate-ts.js /tmp/skills-validate-ts.log
    echo "  [OK] other TypeScript helper builds (${#TS_HELPERS[@]} scripts, bun build)"
  fi
fi

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Validation passed."
