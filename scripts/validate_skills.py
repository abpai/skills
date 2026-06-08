#!/usr/bin/env python3
"""Structural + content validation for every plugin in this marketplace.

This is the single source of truth that `scripts/validate-skills.sh` drives. It
used to live as ~8 separate `python3 -c "..."` / heredoc blocks embedded in the
bash script, each re-implementing its own frontmatter parser; consolidating them
here means every SKILL.md / agent / manifest is parsed exactly once, with a
single strict-YAML frontmatter parser (the same spec-compliant behaviour the
`npx skills` installer relies on — see validate-npx-install.sh).

The bash wrapper still owns the toolchain checks (bun build/test, `bash -n`,
`py_compile`, `bun build` for TS) because those orchestrate external tools.

Output contract (unchanged, relied on by humans + CI logs):
  - "Found N plugins."
  - "  [OK] <plugin>" per plugin (printed even if a sub-item failed, matching
    the original; a malformed *manifest* is the only thing that skips it)
  - "  [OK] marketplace.json (N plugins)" / codex marketplace / versions.json
  - "[FAIL] ..." / "[WARN] ..." / "  [SKIP] ..." lines as before
Exit 0 when everything passed, 1 when any [FAIL] was emitted. The wrapper prints
the final "Validation passed."/"Validation failed." line after also running the
toolchain checks.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - exercised via the wrapper's WARN path
    yaml = None

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SEMVER_RE = re.compile(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?")

# Whether the strict-YAML frontmatter parse is active. Mirrors the original
# behaviour where a missing PyYAML degraded to a one-line WARN per SKILL.md
# rather than failing the run.
_YAML_WARNED = False


class Reporter:
    """Collects pass/fail state while printing in the original line order."""

    def __init__(self) -> None:
        self.failed = False

    def fail(self, msg: str) -> None:
        print(f"[FAIL] {msg}")
        self.failed = True

    @staticmethod
    def warn(msg: str) -> None:
        print(f"[WARN] {msg}")

    @staticmethod
    def ok(msg: str) -> None:
        print(f"  [OK] {msg}")


def load_json(path: Path, rep: Reporter) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - report any parse error verbatim
        rep.fail(f"{path}: cannot parse JSON: {exc}")
        return None


def parse_frontmatter(path: Path, rep: Reporter) -> tuple[dict | None, int]:
    """Return (frontmatter_dict, total_line_count).

    Emits the same fence/YAML failures the embedded parser did and returns
    (None, n) on any hard failure so callers can stop. When PyYAML is missing we
    emit a single WARN (once) and fall back to an empty dict so name/description
    checks still run via the dict's .get returning None — matching the original
    degraded mode where the strict check was skipped.
    """
    global _YAML_WARNED
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    if not lines or lines[0].strip() != "---":
        rep.fail(f"{path}: missing opening frontmatter fence ('---' as first line)")
        return None, len(lines)

    fm_lines: list[str] = []
    closed = False
    for line in lines[1:]:
        if line.strip() == "---":
            closed = True
            break
        fm_lines.append(line)
    if not closed:
        rep.fail(f"{path}: missing closing frontmatter fence")
        return None, len(lines)

    if yaml is None:
        if not _YAML_WARNED:
            rep.warn(
                f"{path}: PyYAML not installed; skipping strict YAML frontmatter check"
            )
            _YAML_WARNED = True
        return {}, len(lines)

    try:
        data = yaml.safe_load("\n".join(fm_lines))
    except yaml.YAMLError as exc:
        detail = str(getattr(exc, "problem", exc) or exc).strip()
        rep.fail(
            f"{path}: frontmatter is not valid YAML ({detail}) — "
            f"the `npx skills` installer would skip this skill. "
            f"Quote any value containing ': ' (e.g. wrap the description in double quotes)."
        )
        return None, len(lines)

    if data is None:
        data = {}
    if not isinstance(data, dict):
        rep.fail(f"{path}: frontmatter does not parse to a mapping")
        return None, len(lines)
    return data, len(lines)


def validate_manifest(
    path: Path,
    expected_name: str,
    rep: Reporter,
    *,
    flavor: str,
    path_keys: tuple[str, ...],
    object_keys: tuple[str, ...],
    forbid_commands: bool,
    cross_check: dict | None = None,
) -> bool:
    """Validate a .claude-plugin / .codex-plugin plugin.json.

    flavor is the human label used in the "only plugin.json belongs in ..."
    message (".claude-plugin" or ".codex-plugin"). Returns True on success.
    """
    manifest_path = path.resolve()
    plugin_dir = manifest_path.parent.parent
    meta_dir = manifest_path.parent

    # Read via the (relative) `path` so parse-error messages match the original
    # embedded validator, which reported the relative manifest path.
    data = load_json(path, rep)
    if data is None:
        return False

    name = data.get("name")
    if not name:
        rep.fail(f"{path}: missing name")
        return False
    if name != expected_name:
        rep.fail(f'{path}: name "{name}" does not match directory "{expected_name}"')
        return False
    if not NAME_RE.fullmatch(name):
        rep.fail(f'{path}: name "{name}" must be lowercase kebab-case')
        return False

    version = data.get("version")
    if not version:
        rep.fail(f"{path}: missing version")
        return False
    if not SEMVER_RE.fullmatch(str(version)):
        rep.fail(f'{path}: version "{version}" is not semantic-version shaped')
        return False

    if not data.get("description"):
        rep.fail(f"{path}: missing description")
        return False

    if forbid_commands:
        if "commands" in data:
            rep.fail(
                f'{path}: declares a "commands" path — flat commands/*.md do not '
                "acquire the plugin namespace; convert each into "
                "skills/<name>/SKILL.md (see CLAUDE.md)"
            )
            return False
        if (plugin_dir / "commands").is_dir():
            rep.fail(
                f"{plugin_dir}: plugin-root commands/ directory is forbidden — flat "
                "commands/*.md do not acquire the plugin namespace; convert each "
                "into skills/<name>/SKILL.md (see CLAUDE.md)"
            )
            return False

    extras = sorted(p.name for p in meta_dir.iterdir() if p.name != "plugin.json")
    if extras:
        rep.fail(
            f"{meta_dir}: only plugin.json belongs in {flavor} (found: {', '.join(extras)})"
        )
        return False

    def validate_path_entry(key: str, entry: object) -> bool:
        if not isinstance(entry, str):
            rep.fail(f"{path}: {key} entries must be strings")
            return False
        if not entry.startswith("./"):
            rep.fail(f'{path}: {key} path "{entry}" must start with ./')
            return False
        resolved = (plugin_dir / entry[2:]).resolve()
        try:
            resolved.relative_to(plugin_dir)
        except ValueError:
            rep.fail(f'{path}: {key} path "{entry}" escapes the plugin root')
            return False
        if not resolved.exists():
            rep.fail(f'{path}: {key} path "{entry}" does not exist')
            return False
        return True

    for key in path_keys:
        value = data.get(key)
        if value is None:
            continue
        entries = [value] if isinstance(value, str) else value
        if not isinstance(entries, list):
            rep.fail(f"{path}: {key} must be a string or list of strings")
            return False
        for entry in entries:
            if not validate_path_entry(key, entry):
                return False

    for key in object_keys:
        value = data.get(key)
        if value is None or isinstance(value, dict):
            continue
        entries = [value] if isinstance(value, str) else value
        if not isinstance(entries, list):
            rep.fail(
                f"{path}: {key} must be a relative path, list of relative paths, "
                "or inline object"
            )
            return False
        for entry in entries:
            if not validate_path_entry(key, entry):
                return False

    if cross_check is not None:
        if name != cross_check.get("name"):
            rep.fail(
                f'{path}: name "{name}" does not match .claude-plugin name '
                f'"{cross_check.get("name")}"'
            )
            return False
        if version != cross_check.get("version"):
            rep.fail(
                f'{path}: version "{version}" does not match .claude-plugin version '
                f'"{cross_check.get("version")}"'
            )
            return False

    return True


def validate_skill_md(
    path: Path, skill_name: str, plugin_name: str, has_umbrella: bool, rep: Reporter
) -> None:
    data, line_count = parse_frontmatter(path, rep)
    if data is None:
        return

    name = data.get("name")
    if not name:
        rep.fail(f"{path}: missing 'name' in frontmatter")
        return
    if name != skill_name:
        rep.fail(f"{path}: name '{name}' does not match folder '{skill_name}'")
    if not NAME_RE.fullmatch(str(name)):
        rep.fail(f"{path}: name '{name}' must be lowercase kebab-case")
    if len(str(name)) > 64:
        rep.fail(f"{path}: name exceeds 64 chars")

    description = data.get("description")
    if not description:
        rep.fail(f"{path}: missing 'description' in frontmatter")

    if line_count > 500:
        rep.warn(f"{path}: {line_count} lines exceeds 500-line spec recommendation")

    if description and len(str(description)) > 1024:
        rep.fail(f"{path}: description is {len(str(description))} chars (max 1024)")

    disable_mi = data.get("disable-model-invocation") is True
    user_invocable = data.get("user-invocable")
    metadata = data.get("metadata")
    internal = isinstance(metadata, dict) and metadata.get("internal") is True

    is_umbrella = skill_name == plugin_name

    # Finding 9: when a plugin has an umbrella, EVERY non-umbrella sibling skill
    # is a per-command wrapper and MUST be hidden — disable-model-invocation +
    # metadata.internal + user-invocable: false. `pi` has no umbrella, so its
    # phase commands fall into the elif branch. See CLAUDE.md.
    if has_umbrella and not is_umbrella:
        if not disable_mi:
            rep.fail(
                f"{path}: per-command wrapper in an umbrella pack must set "
                "'disable-model-invocation: true' (so the model routes through the "
                "umbrella, not the wrapper; see CLAUDE.md)"
            )
        if not internal:
            rep.fail(
                f"{path}: per-command wrapper requires 'metadata.internal: true' "
                "(user-only wrappers must be hidden from flat-list installers like "
                "npx skills/Codex; add a metadata block with 'internal: true')"
            )
        if user_invocable is not False:
            rep.fail(
                f"{path}: per-command wrapper in an umbrella pack requires "
                "'user-invocable: false' (wrappers must stay out of the Claude Code "
                "/ menu so the umbrella is the only scoped entry)"
            )
    elif disable_mi and not internal:
        rep.fail(
            f"{path}: 'disable-model-invocation: true' requires 'metadata.internal: "
            "true' (hide user-only wrappers from flat-list installers like npx "
            "skills/Codex; add a metadata block with 'internal: true')"
        )


def validate_agent(path: Path, expected_name: str, rep: Reporter) -> None:
    data, _ = parse_frontmatter(path, rep)
    if data is None:
        return
    name = data.get("name")
    if not name:
        rep.fail(f"{path}: missing 'name' in frontmatter")
        return
    if name != expected_name:
        rep.fail(f"{path}: name '{name}' does not match file '{expected_name}.md'")
        return
    if not NAME_RE.fullmatch(str(name)):
        rep.fail(f"{path}: name '{name}' must be lowercase kebab-case")
        return
    if len(str(name)) > 64:
        rep.fail(f"{path}: name exceeds 64 chars")
        return
    if not data.get("description"):
        rep.fail(f"{path}: missing 'description' in frontmatter")
        return
    for unsupported in ("hooks", "mcpServers", "permissionMode"):
        if unsupported in data:
            rep.fail(
                f"{path}: plugin agents must not declare unsupported "
                f"'{unsupported}' frontmatter"
            )
            return


def validate_hooks(path: Path, rep: Reporter) -> None:
    data = load_json(path, rep)
    if data is None:
        return
    if not isinstance(data, dict):
        rep.fail(f'{path}: hooks file must contain a JSON object')
        return
    if "hooks" not in data:
        rep.fail(f'{path}: missing top-level "hooks" object')
        return
    if not isinstance(data["hooks"], dict):
        rep.fail(f'{path}: top-level "hooks" must be an object')


def validate_plugin(plugin_dir: Path, rep: Reporter) -> None:
    plugin_name = plugin_dir.name
    manifest = plugin_dir / ".claude-plugin" / "plugin.json"

    if not validate_manifest(
        manifest,
        plugin_name,
        rep,
        flavor=".claude-plugin",
        path_keys=("agents", "skills", "outputStyles"),
        object_keys=("hooks", "mcpServers", "lspServers"),
        forbid_commands=True,
    ):
        return  # malformed manifest skips the rest of this plugin (and its [OK])

    skill_files = sorted((plugin_dir / "skills").glob("*/SKILL.md"))
    agent_files = sorted((plugin_dir / "agents").glob("*.md"))

    if not skill_files and not agent_files:
        rep.fail(f"{plugin_dir}: no skills or agents found")

    has_umbrella = (plugin_dir / "skills" / plugin_name / "SKILL.md").is_file()

    for skill_file in skill_files:
        validate_skill_md(
            skill_file, skill_file.parent.name, plugin_name, has_umbrella, rep
        )

    for agent_file in agent_files:
        validate_agent(agent_file, agent_file.stem, rep)

    hooks_file = plugin_dir / "hooks" / "hooks.json"
    if hooks_file.is_file():
        validate_hooks(hooks_file, rep)

    codex_manifest = plugin_dir / ".codex-plugin" / "plugin.json"
    if codex_manifest.is_file():
        claude_data = load_json(manifest, rep)
        validate_manifest(
            codex_manifest,
            plugin_name,
            rep,
            flavor=".codex-plugin",
            path_keys=("skills", "apps"),
            object_keys=("mcpServers",),
            forbid_commands=False,
            cross_check=claude_data or {},
        )

    rep.ok(plugin_name)


def _marketplace_entry_path(source: object) -> str | None:
    if isinstance(source, str):
        return Path(source.lstrip("./")).name
    if isinstance(source, dict):
        sp = source.get("path")
        if sp:
            return Path(sp.lstrip("./")).name
    return None


def validate_marketplace(path: Path, rep: Reporter) -> None:
    data = load_json(path, rep)
    if data is None:
        return
    if not data.get("name"):
        rep.fail(f"{path}: missing name")
        return
    if not data.get("owner"):
        rep.fail(f"{path}: missing owner")
        return
    plugins = data.get("plugins", [])
    if not plugins:
        rep.fail(f"{path}: no plugins listed")
        return

    names: set[str] = set()
    entry_path: dict[str, str] = {}
    for i, p in enumerate(plugins):
        n = p.get("name")
        if not n:
            rep.fail(f"{path}: plugins[{i}] missing name")
            return
        if n in names:
            rep.fail(f'{path}: duplicate plugin name "{n}"')
            return
        names.add(n)
        source = p.get("source")
        if not source:
            rep.fail(f'{path}: plugins[{i}] ("{n}") missing source')
            return
        sp = _marketplace_entry_path(source)
        if sp:
            entry_path[n] = sp

    expected: set[str] = set()
    manifest_name: dict[str, str] = {}
    for manifest in sorted(Path(".").glob("*/.claude-plugin/plugin.json")):
        pdir = manifest.parent.parent.name
        data2 = load_json(manifest, rep)
        if data2 is None:
            return
        expected.add(pdir)
        manifest_name[pdir] = data2.get("name")

    missing = sorted(expected - names)
    extra = sorted(names - expected)
    if missing:
        rep.fail(
            f"{path}: missing plugins (have Claude manifest but no marketplace "
            f"entry): {', '.join(missing)}"
        )
    if extra:
        rep.fail(
            f"{path}: unexpected plugins (marketplace entry with no Claude "
            f"manifest): {', '.join(extra)}"
        )

    for n in sorted(names & expected):
        if n in entry_path and entry_path[n] != n:
            rep.fail(
                f'{path}: plugin "{n}" source path points at "{entry_path[n]}" '
                f'(expected folder "{n}")'
            )
        if manifest_name.get(n) != n:
            rep.fail(
                f'{path}: plugin "{n}" manifest name is {manifest_name.get(n)!r} '
                f'(expected "{n}")'
            )

    if not rep.failed:
        rep.ok(f"marketplace.json ({len(plugins)} plugins)")


def validate_codex_marketplace(path: Path, rep: Reporter) -> None:
    data = load_json(path, rep)
    if data is None:
        return
    plugins = data.get("plugins", [])
    if not isinstance(plugins, list):
        rep.fail(f"{path}: plugins must be a list")
        return

    local_failed = False
    names: set[str] = set()
    entry_path: dict[str, str] = {}
    for i, plugin in enumerate(plugins):
        name = plugin.get("name")
        source = plugin.get("source", {})
        rel_path = source.get("path") if isinstance(source, dict) else source
        if not name:
            rep.fail(f"{path}: plugins[{i}] missing name")
            return
        if name in names:
            rep.fail(f'{path}: duplicate plugin name "{name}"')
            return
        names.add(name)
        if not rel_path:
            rep.fail(f'{path}: plugins[{i}] ("{name}") missing source.path')
            return
        plugin_dir = Path(rel_path)
        if not plugin_dir.exists():
            rep.fail(
                f'{path}: plugins[{i}] ("{name}") points to missing path {rel_path!r}'
            )
            return
        if not (plugin_dir / ".codex-plugin" / "plugin.json").exists():
            rep.fail(
                f'{path}: plugins[{i}] ("{name}") points to {rel_path!r} but that '
                "folder has no .codex-plugin/plugin.json"
            )
            return
        entry_path[name] = plugin_dir.name

    expected: set[str] = set()
    manifest_name: dict[str, str] = {}
    for manifest in sorted(Path(".").glob("*/.codex-plugin/plugin.json")):
        pdir = manifest.parent.parent.name
        data2 = load_json(manifest, rep)
        if data2 is None:
            return
        expected.add(pdir)
        manifest_name[pdir] = data2.get("name")

    missing = sorted(expected - names)
    extra = sorted(names - expected)
    if missing:
        rep.fail(
            f"{path}: missing plugins (have Codex manifest but no marketplace "
            f"entry): {', '.join(missing)}"
        )
        local_failed = True
    if extra:
        rep.fail(
            f"{path}: unexpected plugins (marketplace entry with no Codex manifest, "
            f"e.g. the Codex-excluded pi): {', '.join(extra)}"
        )
        local_failed = True

    for name in sorted(names & expected):
        if entry_path.get(name) != name:
            rep.fail(
                f'{path}: plugin "{name}" source path points at '
                f'"{entry_path.get(name)}" (expected folder "{name}")'
            )
            local_failed = True
        if manifest_name.get(name) != name:
            rep.fail(
                f'{path}: plugin "{name}" manifest name is '
                f'{manifest_name.get(name)!r} (expected "{name}")'
            )
            local_failed = True

    if not local_failed:
        rep.ok(f"{path} ({len(plugins)} plugins)")


def _skill_md_version(path: Path) -> str | None:
    """Extract metadata.version from a SKILL.md (line-based, fence-scoped)."""
    in_frontmatter = False
    in_metadata = False
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line
        if line == "---":
            if not in_frontmatter:
                in_frontmatter = True
                continue
            break
        if not in_frontmatter:
            continue
        if line.startswith("metadata:"):
            in_metadata = True
            continue
        if in_metadata and line.startswith("  version:"):
            return line.split(":", 1)[1].strip().strip('"')
        if in_metadata and line and not line.startswith("  "):
            in_metadata = False
    return None


def _skill_md_disabled(path: Path) -> bool:
    in_frontmatter = False
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line
        if line == "---":
            if not in_frontmatter:
                in_frontmatter = True
                continue
            break
        if not in_frontmatter:
            continue
        if line.strip() == "disable-model-invocation: true":
            return True
    return False


def validate_versions(path: Path, rep: Reporter) -> None:
    data = load_json(path, rep)
    if data is None:
        return

    expected: dict[str, str] = {}
    missing_versions: list[str] = []
    for manifest in sorted(Path(".").glob("*/.claude-plugin/plugin.json")):
        plugin_dir = manifest.parent.parent
        plugin_name = plugin_dir.name
        versioned_skill_found = False
        for skill_file in sorted((plugin_dir / "skills").glob("*/SKILL.md")):
            if _skill_md_disabled(skill_file):
                continue
            version = _skill_md_version(skill_file)
            if not version:
                missing_versions.append(str(skill_file))
                continue
            expected[skill_file.parent.name] = version
            versioned_skill_found = True

        if not versioned_skill_found:
            manifest_data = load_json(manifest, rep)
            if manifest_data is None:
                return
            version = manifest_data.get("version")
            if not version:
                missing_versions.append(str(manifest))
                continue
            expected[plugin_name] = version

    if missing_versions:
        for version_file in missing_versions:
            rep.fail(f"{version_file}: missing version metadata")
        return

    actual = data.get("skills")
    if data.get("schema_version") != 1:
        rep.fail(f"{path}: schema_version must be 1")
        return
    if not isinstance(actual, dict):
        rep.fail(f"{path}: skills must be an object")
        return
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        mismatched = sorted(
            s for s in expected if s in actual and actual[s] != expected[s]
        )
        if missing:
            rep.fail(f"{path}: missing skills: {', '.join(missing)}")
        if extra:
            rep.fail(f"{path}: unexpected skills: {', '.join(extra)}")
        for skill in mismatched:
            rep.fail(
                f"{path}: {skill} version {actual[skill]!r} does not match "
                f"frontmatter {expected[skill]!r}"
            )
        return

    rep.ok(f"{path} ({len(expected)} skills)")


def main(argv: list[str]) -> int:
    skip_versions = "--skip-versions" in argv
    rep = Reporter()

    plugin_dirs = sorted(
        m.parent.parent
        for m in Path(".").glob("*/.claude-plugin/plugin.json")
    )
    if not plugin_dirs:
        print("No plugins found (no .claude-plugin/plugin.json files).")
        return 1

    print(f"Found {len(plugin_dirs)} plugins.")
    for plugin_dir in plugin_dirs:
        validate_plugin(plugin_dir, rep)

    marketplace = Path(".claude-plugin/marketplace.json")
    if marketplace.is_file():
        validate_marketplace(marketplace, rep)
    else:
        rep.warn("No .claude-plugin/marketplace.json found")

    codex_marketplace = Path(".agents/plugins/marketplace.json")
    if codex_marketplace.is_file():
        validate_codex_marketplace(codex_marketplace, rep)
    else:
        rep.warn("No .agents/plugins/marketplace.json found")

    versions_file = Path("versions.json")
    if skip_versions:
        print("  [SKIP] versions.json (--skip-versions)")
    elif versions_file.is_file():
        validate_versions(versions_file, rep)
    else:
        rep.fail(f"{versions_file}: missing file")

    return 1 if rep.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
