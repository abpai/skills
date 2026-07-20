#!/usr/bin/env python3
"""Structural + content validation for every plugin in this marketplace.

This is the structural validator that `scripts/validate-skills.sh` drives. It
used to live as ~8 separate `python3 -c "..."` / heredoc blocks embedded in the
bash script; consolidating those checks here means one process, structured
functions, and one place to read the structural rules. Shared version-source
metadata lives in `scripts/skill-metadata.ts` so generation, manifest sync,
docs/version drift checks, and CI version-bump checks resolve plugin versions
through the same code path.

Frontmatter handling deliberately mirrors the pre-refactor behaviour exactly:

  - SKILL.md frontmatter gets a strict-YAML *validity gate* (the same
    spec-compliant parse the `npx skills` installer relies on — see
    validate-npx-install.sh). When PyYAML is missing the gate is skipped with a
    one-line WARN, NOT a failure.
  - Structural field extraction (name/description/flags) is done by the same
    lenient line-based parser as before, regardless of whether the strict gate
    ran, so the boolean-flag semantics (string compares, quote stripping) are
    unchanged. Version-source extraction is delegated to `skill-metadata.ts`.
  - Agent frontmatter uses its own original line-based parser with no strict
    gate, matching the old block.

The bash wrapper still owns the toolchain checks (bun build/test, `bash -n`,
`py_compile`, `bun build` for TS) because those orchestrate external tools.

Output contract (unchanged, relied on by humans + CI logs): "Found N plugins.",
"  [OK] <plugin>" per plugin (printed even if a sub-item failed; only a
malformed *manifest* skips it), the marketplace/codex-marketplace/versions lines,
and [FAIL]/[WARN]/[SKIP] lines as before. Exit 0 when everything passed, 1 when
any [FAIL] was emitted; the wrapper prints the final pass/fail verdict.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - exercised via the WARN path
    yaml = None

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SEMVER_RE = re.compile(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?")
_META_OPEN_RE = re.compile(r"metadata:\s*")
_META_INTERNAL_RE = re.compile(r"\s+internal:\s*true\s*")

# Mirrors the original one-time WARN when PyYAML is unavailable.
_YAML_WARNED = False


def _class_tokens(attrs: list[tuple[str, str | None]]) -> set[str]:
    for key, value in attrs:
        if key == "class" and value:
            return set(value.split())
    return set()


def _attr_value(attrs: list[tuple[str, str | None]], name: str) -> str | None:
    for key, value in attrs:
        if key == name:
            return value
    return None


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


# ── SKILL.md ────────────────────────────────────────────────────────────────


def _strict_yaml_gate(path: Path, fm_lines: list[str], rep: Reporter) -> bool:
    """Strict-YAML validity gate. Returns False iff a hard failure was reported.

    Skipped (returns True) with a one-time WARN when PyYAML is unavailable, so
    the validator degrades exactly like the original instead of false-failing.
    """
    global _YAML_WARNED
    if yaml is None:
        if not _YAML_WARNED:
            rep.warn(
                f"{path}: PyYAML not installed; skipping strict YAML frontmatter check"
            )
            _YAML_WARNED = True
        return True
    try:
        parsed = yaml.safe_load("\n".join(fm_lines))
    except yaml.YAMLError as exc:
        detail = str(getattr(exc, "problem", exc) or exc).strip()
        rep.fail(
            f"{path}: frontmatter is not valid YAML ({detail}) — "
            f"the `npx skills` installer would skip this skill. "
            f"Quote any value containing ': ' (e.g. wrap the description in double quotes)."
        )
        return False
    if not isinstance(parsed, dict):
        rep.fail(f"{path}: frontmatter does not parse to a mapping")
        return False
    return True


def _extract_skill_fields(fm_lines: list[str]) -> tuple[dict[str, str], str | None]:
    """Lenient line-based extraction of top-level scalars + description.

    Ported verbatim from the original embedded parser (supports block/folded
    description scalars; strips one layer of surrounding quotes).
    """
    fields: dict[str, str] = {}
    description: str | None = None
    i = 0
    while i < len(fm_lines):
        line = fm_lines[i]
        if not line or line[0] in (" ", "\t", "#"):
            i += 1
            continue
        if ":" not in line:
            i += 1
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if key == "description":
            if value in (">", "|", ">-", "|-", ">+", "|+", ""):
                parts: list[str] = []
                j = i + 1
                while j < len(fm_lines) and (
                    fm_lines[j].startswith(("  ", "\t")) or fm_lines[j] == ""
                ):
                    stripped = fm_lines[j].strip()
                    if stripped:
                        parts.append(stripped)
                    j += 1
                description = " ".join(parts)
                i = j
                continue
            description = value.strip('"').strip("'")
        else:
            fields[key] = value.strip('"').strip("'")
        i += 1
    return fields, description


def _detect_internal(fm_lines: list[str]) -> bool:
    """metadata.internal: true detection (line-based, as in the original)."""
    internal = False
    in_meta = False
    for line in fm_lines:
        if _META_OPEN_RE.fullmatch(line):
            in_meta = True
            continue
        if in_meta:
            if line and not line[0].isspace():
                in_meta = False
            elif _META_INTERNAL_RE.fullmatch(line):
                internal = True
    return internal


def validate_skill_md(
    path: Path, skill_name: str, plugin_name: str, has_umbrella: bool, rep: Reporter
) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    if not lines or lines[0].strip() != "---":
        rep.fail(f"{path}: missing opening frontmatter fence ('---' as first line)")
        return
    fm_lines: list[str] = []
    closed = False
    for line in lines[1:]:
        if line.strip() == "---":
            closed = True
            break
        fm_lines.append(line)
    if not closed:
        rep.fail(f"{path}: missing closing frontmatter fence")
        return

    if not _strict_yaml_gate(path, fm_lines, rep):
        return

    fields, description = _extract_skill_fields(fm_lines)

    name = fields.get("name")
    if not name:
        rep.fail(f"{path}: missing 'name' in frontmatter")
        return
    if name != skill_name:
        rep.fail(f"{path}: name '{name}' does not match folder '{skill_name}'")
    if not NAME_RE.fullmatch(name):
        rep.fail(f"{path}: name '{name}' must be lowercase kebab-case")
    if len(name) > 64:
        rep.fail(f"{path}: name exceeds 64 chars")

    if not description:
        rep.fail(f"{path}: missing 'description' in frontmatter")

    if len(lines) > 500:
        rep.warn(f"{path}: {len(lines)} lines exceeds 500-line spec recommendation")

    if description and len(description) > 1024:
        rep.fail(f"{path}: description is {len(description)} chars (max 1024)")

    disable_mi = fields.get("disable-model-invocation") == "true"
    user_invocable = fields.get("user-invocable")
    has_allowed_tools = "allowed-tools" in fields
    internal = _detect_internal(fm_lines)
    is_umbrella = skill_name == plugin_name

    if not disable_mi:
        rep.fail(
            f"{path}: every skill entrypoint must set "
            "'disable-model-invocation: true'; skills are human-invoked only"
        )

    # A grouped pack's leaf entries are implementation shims. Pi remains a
    # command-only exception: its phase skills retain metadata.internal for
    # flat-installer packaging but stay human-invocable because it has no
    # umbrella router.
    if has_umbrella and not is_umbrella:
        if has_allowed_tools:
            rep.fail(
                f"{path}: per-command wrapper in an umbrella pack must not set "
                "'allowed-tools'; put the union allowlist on "
                f"{plugin_name}/skills/{plugin_name}/SKILL.md because the umbrella "
                "is the active routed skill"
            )
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
        if user_invocable != "false":
            rep.fail(
                f"{path}: per-command wrapper in an umbrella pack requires "
                "'user-invocable: false' (wrappers must stay out of the Claude Code "
                "/ menu so the umbrella is the only scoped entry)"
            )
    elif internal and user_invocable == "false":
        rep.fail(
            f"{path}: command-only internal skills must omit 'user-invocable' or "
            "set it to true so humans can invoke them explicitly"
        )
    elif user_invocable == "false":
        rep.fail(
            f"{path}: public explicit-only skills must omit 'user-invocable' or "
            "set it to true"
        )


def validate_openai_yaml(path: Path, skill_name: str, rep: Reporter) -> None:
    """Validate required Codex policy and optional UI metadata beside a skill."""
    text = path.read_text(encoding="utf-8")

    # Enforce the portable subset even when PyYAML is available so local and CI
    # runs apply the same quoting and indentation contract.
    portable_interface: dict[str, str] = {}
    portable_policy: dict[str, bool] = {}
    in_interface = False
    in_policy = False
    for line in text.splitlines():
        if line == "interface:":
            in_interface = True
            in_policy = False
            continue
        if line == "policy:":
            in_policy = True
            in_interface = False
            continue
        if (in_interface or in_policy) and line and not line[0].isspace():
            in_interface = False
            in_policy = False
        if in_policy:
            match = re.fullmatch(r"  allow_implicit_invocation:\s*(true|false)\s*", line)
            if match is None:
                rep.fail(
                    f"{path}: policy must contain exactly two-space indented "
                    "allow_implicit_invocation: false"
                )
                return
            portable_policy["allow_implicit_invocation"] = match.group(1) == "true"
            continue
        if not in_interface or not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.fullmatch(r'  ([a-z_]+):\s*"([^"]*)"\s*', line)
        if match is None:
            rep.fail(
                f"{path}: interface entries must use two-space indentation "
                "and quoted string values"
            )
            return
        portable_interface[match.group(1)] = match.group(2)

    if yaml is not None:
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            rep.fail(f"{path}: cannot parse YAML: {exc}")
            return
    else:
        # Keep the required interface contract enforceable in the repo's
        # supported no-PyYAML environment. Strict YAML validation remains an
        # additional gate when PyYAML is installed.
        data = {}
        if portable_interface:
            data["interface"] = portable_interface
        if portable_policy:
            data["policy"] = portable_policy

    if not isinstance(data, dict):
        rep.fail(f"{path}: must contain a YAML mapping")
        return

    policy = data.get("policy")
    if not isinstance(policy, dict) or policy.get("allow_implicit_invocation") is not False:
        rep.fail(
            f"{path}: must set policy.allow_implicit_invocation: false "
            "so Codex does not invoke this skill implicitly"
        )
        return

    interface = data.get("interface")
    if interface is None:
        return
    if not isinstance(interface, dict):
        rep.fail(f"{path}: interface must be a mapping when present")
        return

    for field in ("display_name", "short_description", "default_prompt"):
        value = interface.get(field)
        if not isinstance(value, str) or not value.strip():
            rep.fail(f"{path}: interface.{field} must be a non-empty string")

    short_description = interface.get("short_description")
    if (
        isinstance(short_description, str)
        and not 25 <= len(short_description) <= 64
    ):
        rep.fail(
            f"{path}: interface.short_description must be 25-64 characters "
            f"(found {len(short_description)})"
        )

    default_prompt = interface.get("default_prompt")
    if isinstance(default_prompt, str) and f"${skill_name}" not in default_prompt:
        rep.fail(f"{path}: interface.default_prompt must mention '${skill_name}'")


# ── Plugin agents ─────────────────────────────────────────────────────────────


def validate_agent(path: Path, expected_name: str, rep: Reporter) -> None:
    # Line-based parser matching the original agent block exactly (no strict YAML
    # gate, strips only double quotes, original fence-error messages).
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        rep.fail(f"{path}: missing opening frontmatter fence")
        return
    parts = text.split("\n---\n", 1)
    if len(parts) != 2:
        rep.fail(f"{path}: missing closing frontmatter fence")
        return
    fields: dict[str, str] = {}
    for line in parts[0].splitlines()[1:]:
        if not line or line.startswith((" ", "\t", "#")):
            continue
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip().strip('"')
    name = fields.get("name")
    if not name:
        rep.fail(f"{path}: missing 'name' in frontmatter")
        return
    if name != expected_name:
        rep.fail(f"{path}: name '{name}' does not match file '{expected_name}.md'")
        return
    if not NAME_RE.fullmatch(name):
        rep.fail(f"{path}: name '{name}' must be lowercase kebab-case")
        return
    if len(name) > 64:
        rep.fail(f"{path}: name exceeds 64 chars")
        return
    if not fields.get("description"):
        rep.fail(f"{path}: missing 'description' in frontmatter")
        return
    for unsupported in ("hooks", "mcpServers", "permissionMode"):
        if unsupported in fields:
            rep.fail(
                f"{path}: plugin agents must not declare unsupported "
                f"'{unsupported}' frontmatter"
            )
            return


# ── hooks.json ────────────────────────────────────────────────────────────────


def validate_hooks(path: Path, rep: Reporter) -> None:
    data = load_json(path, rep)
    if data is None:
        return
    if not isinstance(data, dict):
        rep.fail(f"{path}: hooks file must contain a JSON object")
        return
    if "hooks" not in data:
        rep.fail(f'{path}: missing top-level "hooks" object')
        return
    if not isinstance(data["hooks"], dict):
        rep.fail(f'{path}: top-level "hooks" must be an object')


# ── plugin.json manifests (.claude-plugin and .codex-plugin) ─────────────────


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
    """Validate a plugin.json. `flavor` is the dir label used in the
    "only plugin.json belongs in ..." message. Returns True on success."""
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


def run_guarded(rep: Reporter, label: str, fn) -> None:
    """Run one validation unit, turning an unexpected crash into a [FAIL] instead
    of aborting siblings — matching the original, where every unit ran as its own
    python3 subprocess."""
    try:
        fn()
    except Exception as exc:  # noqa: BLE001 - isolate per-unit crashes
        rep.fail(f"{label}: unexpected validation error: {exc}")


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

    # Recursive (rglob), matching the original `find ... -name`, so a SKILL.md /
    # agent .md nested deeper than one level is still validated rather than
    # silently skipped.
    skill_files = sorted((plugin_dir / "skills").rglob("SKILL.md"))
    agent_files = sorted((plugin_dir / "agents").rglob("*.md"))

    if not skill_files and not agent_files:
        rep.fail(f"{plugin_dir}: no skills or agents found")

    has_umbrella = (plugin_dir / "skills" / plugin_name / "SKILL.md").is_file()

    # Each sub-check is isolated (like the original's per-unit subprocesses): a
    # crash in one skill/agent does not abort the rest of the plugin, and the
    # plugin [OK] still prints.
    for skill_file in skill_files:
        run_guarded(
            rep,
            str(skill_file),
            lambda f=skill_file: validate_skill_md(
                f, f.parent.name, plugin_name, has_umbrella, rep
            ),
        )
        openai_yaml = skill_file.parent / "agents" / "openai.yaml"
        if not openai_yaml.is_file():
            rep.fail(
                f"{skill_file}: missing agents/openai.yaml with "
                "policy.allow_implicit_invocation: false"
            )
        else:
            run_guarded(
                rep,
                str(openai_yaml),
                lambda p=openai_yaml, name=skill_file.parent.name: validate_openai_yaml(
                    p, name, rep
                ),
            )

    for agent_file in agent_files:
        run_guarded(
            rep,
            str(agent_file),
            lambda f=agent_file: validate_agent(f, f.stem, rep),
        )

    hooks_file = plugin_dir / "hooks" / "hooks.json"
    if hooks_file.is_file():
        run_guarded(rep, str(hooks_file), lambda: validate_hooks(hooks_file, rep))

    codex_manifest = plugin_dir / ".codex-plugin" / "plugin.json"
    if codex_manifest.is_file():
        def _codex() -> None:
            claude_data = load_json(manifest, rep)
            validate_manifest(
                codex_manifest,
                plugin_name,
                rep,
                flavor=".codex-plugin",
                path_keys=("skills", "apps"),
                object_keys=("mcpServers",),
                forbid_commands=True,
                cross_check=claude_data or {},
            )

        run_guarded(rep, str(codex_manifest), _codex)

    # NOTE: printed even when a skill/agent/hooks/codex sub-check failed above —
    # only a malformed .claude-plugin manifest skips it (via the early return).
    rep.ok(plugin_name)


# ── marketplaces ──────────────────────────────────────────────────────────────


def _entry_path_name(source: object) -> str | None:
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

    # Local flag so the marketplace [OK] reflects only this check, matching the
    # original block's behaviour even when earlier plugins already failed.
    local_failed = False
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
        sp = _entry_path_name(source)
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
        local_failed = True
    if extra:
        rep.fail(
            f"{path}: unexpected plugins (marketplace entry with no Claude "
            f"manifest): {', '.join(extra)}"
        )
        local_failed = True

    for n in sorted(names & expected):
        if n in entry_path and entry_path[n] != n:
            rep.fail(
                f'{path}: plugin "{n}" source path points at "{entry_path[n]}" '
                f'(expected folder "{n}")'
            )
            local_failed = True
        if manifest_name.get(n) != n:
            rep.fail(
                f'{path}: plugin "{n}" manifest name is {manifest_name.get(n)!r} '
                f'(expected "{n}")'
            )
            local_failed = True

    if not local_failed:
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
        # This is a repo-scoped marketplace: every source.path must be a
        # repo-local "./<plugin>" — mirroring the strict Claude manifest path
        # rules. Without this, a path like "../elsewhere/distill" or an absolute
        # path ending in the plugin name could pass, since only the basename is
        # cross-checked below.
        if not isinstance(rel_path, str) or not rel_path.startswith("./"):
            rep.fail(
                f'{path}: plugins[{i}] ("{name}") source.path {rel_path!r} must start with ./'
            )
            return
        repo_root = Path(".").resolve()
        plugin_dir = Path(rel_path)
        try:
            plugin_dir.resolve().relative_to(repo_root)
        except ValueError:
            rep.fail(
                f'{path}: plugins[{i}] ("{name}") source.path {rel_path!r} escapes the repo root'
            )
            return
        if rel_path != f"./{name}":
            rep.fail(
                f'{path}: plugins[{i}] ("{name}") source.path {rel_path!r} must be "./{name}"'
            )
            return
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


# ── versions.json ─────────────────────────────────────────────────────────────


def _expected_skill_versions(rep: Reporter) -> dict[str, str] | None:
    metadata_script = Path("scripts/skill-metadata.ts")
    if not metadata_script.is_file():
        rep.fail(f"{metadata_script}: missing shared skill metadata resolver")
        return None

    try:
        result = subprocess.run(
            ["bun", str(metadata_script), "expected-versions", "--json"],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        rep.fail("bun: required to resolve shared skill metadata versions")
        return None

    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        if detail:
            for line in detail.splitlines():
                rep.fail(line)
        else:
            rep.fail("scripts/skill-metadata.ts: expected-versions failed")
        return None

    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        rep.fail(f"scripts/skill-metadata.ts: invalid expected-versions JSON: {exc}")
        return None

    if not isinstance(parsed, dict) or not all(
        isinstance(key, str) and isinstance(value, str)
        for key, value in parsed.items()
    ):
        rep.fail("scripts/skill-metadata.ts: expected-versions JSON must be a string map")
        return None

    return dict(sorted(parsed.items()))


def validate_versions(path: Path, rep: Reporter) -> None:
    data = load_json(path, rep)
    if data is None:
        return

    expected = _expected_skill_versions(rep)
    if expected is None:
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


# ── docs/index.html ───────────────────────────────────────────────────────────


class DocsIndexParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.cards: list[tuple[str, str]] = []
        self.meta_counts: list[tuple[str, str]] = []
        self.plugin_count: str | None = None
        self.result_count: str | None = None
        self._in_card = False
        self._in_card_name = False
        self._in_card_version = False
        self._capture: str | None = None
        self._card_name_parts: list[str] = []
        self._card_version_parts: list[str] = []
        self._capture_plugin_count = False
        self._capture_result_count = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = _class_tokens(attrs)
        if tag == "meta":
            name = _attr_value(attrs, "name") or _attr_value(attrs, "property")
            content = _attr_value(attrs, "content")
            if name in {"description", "og:description"} and content:
                self.meta_counts.append((name, content))
            return

        if tag == "article" and "skill-card" in classes:
            self._in_card = True
            self._card_name_parts = []
            self._card_version_parts = []
            return

        if self._in_card and tag == "h3" and "card-name" in classes:
            self._in_card_name = True
            self._capture = "card-name"
            return

        if self._in_card and tag == "span" and "card-version" in classes:
            self._in_card_version = True
            return

        if self._in_card and self._in_card_version and tag == "strong":
            self._capture = "card-version"
            return

        if tag == "strong" and _attr_value(attrs, "id") == "pluginCount":
            self._capture_plugin_count = True
            self._capture = "plugin-count"
            return

        if tag == "span" and _attr_value(attrs, "id") == "resultCount":
            self._capture_result_count = True
            self._capture = "result-count"

    def handle_data(self, data: str) -> None:
        if self._capture == "card-name":
            self._card_name_parts.append(data)
        elif self._capture == "card-version":
            self._card_version_parts.append(data)
        elif self._capture == "plugin-count":
            self.plugin_count = (self.plugin_count or "") + data
        elif self._capture == "result-count":
            self.result_count = (self.result_count or "") + data

    def handle_endtag(self, tag: str) -> None:
        if tag == "h3" and self._in_card_name:
            self._in_card_name = False
            if self._capture == "card-name":
                self._capture = None
            return

        if tag == "strong" and self._capture == "card-version":
            self._capture = None
            return

        if tag == "span" and self._in_card_version:
            self._in_card_version = False
            return

        if tag == "strong" and self._capture_plugin_count:
            self._capture_plugin_count = False
            if self._capture == "plugin-count":
                self._capture = None
            return

        if tag == "span" and self._capture_result_count:
            self._capture_result_count = False
            if self._capture == "result-count":
                self._capture = None
            return

        if tag == "article" and self._in_card:
            name = "".join(self._card_name_parts).strip()
            version = "".join(self._card_version_parts).strip()
            self.cards.append((name, version))
            self._in_card = False
            self._in_card_name = False
            self._in_card_version = False
            self._capture = None


def validate_docs_index(path: Path, rep: Reporter) -> None:
    expected = _expected_skill_versions(rep)
    if expected is None:
        return

    try:
        text = path.read_text(encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        rep.fail(f"{path}: cannot read docs index: {exc}")
        return

    parser = DocsIndexParser()
    try:
        parser.feed(text)
    except Exception as exc:  # noqa: BLE001
        rep.fail(f"{path}: cannot parse docs index HTML: {exc}")
        return

    local_failed = False
    card_versions: dict[str, str] = {}
    duplicate_cards: list[str] = []
    for name, version in parser.cards:
        if not name:
            rep.fail(f"{path}: plugin card missing card-name")
            local_failed = True
            continue
        if not version:
            rep.fail(f"{path}: plugin card for {name!r} missing card-version")
            local_failed = True
            continue
        if name in card_versions:
            duplicate_cards.append(name)
        card_versions[name] = version

    if duplicate_cards:
        rep.fail(f"{path}: duplicate plugin cards: {', '.join(sorted(set(duplicate_cards)))}")
        local_failed = True

    missing = sorted(set(expected) - set(card_versions))
    extra = sorted(set(card_versions) - set(expected))
    if missing:
        rep.fail(f"{path}: missing plugin cards: {', '.join(missing)}")
        local_failed = True
    if extra:
        rep.fail(f"{path}: unexpected plugin cards: {', '.join(extra)}")
        local_failed = True

    for name in sorted(set(expected) & set(card_versions)):
        if card_versions[name] != expected[name]:
            rep.fail(
                f"{path}: {name} card version {card_versions[name]!r} does not "
                f"match version source {expected[name]!r}"
            )
            local_failed = True

    expected_count = len(expected)
    if parser.plugin_count is None:
        rep.fail(f"{path}: missing #pluginCount stat")
        local_failed = True
    else:
        count_text = parser.plugin_count.strip()
        if count_text != str(expected_count):
            rep.fail(
                f"{path}: #pluginCount is {count_text!r} "
                f"(expected {expected_count})"
            )
            local_failed = True

    if parser.result_count is None:
        rep.fail(f"{path}: missing #resultCount text")
        local_failed = True
    else:
        result_text = " ".join(parser.result_count.split())
        expected_result = f"{expected_count} / {expected_count}"
        if result_text != expected_result:
            rep.fail(
                f"{path}: #resultCount is {result_text!r} "
                f"(expected {expected_result!r})"
            )
            local_failed = True

    if not parser.meta_counts:
        rep.fail(f"{path}: missing description/og:description plugin count")
        local_failed = True
    else:
        for label, content in parser.meta_counts:
            first_number = re.search(r"\b\d+\b", content)
            if not first_number:
                rep.fail(f"{path}: {label} meta description has no plugin count")
                local_failed = True
            elif int(first_number.group(0)) != expected_count:
                rep.fail(
                    f"{path}: {label} meta description count "
                    f"{first_number.group(0)} does not match {expected_count}"
                )
                local_failed = True

    if not local_failed:
        rep.ok(f"{path} ({expected_count} plugin cards)")


# ── entrypoint ────────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    skip_versions = "--skip-versions" in argv
    rep = Reporter()

    plugin_dirs = sorted(
        m.parent.parent for m in Path(".").glob("*/.claude-plugin/plugin.json")
    )
    if not plugin_dirs:
        print("No plugins found (no .claude-plugin/plugin.json files).")
        return 1

    # Each section is isolated too (an unexpected exception in one does not abort
    # the rest) — matching the original, where each block ran as its own python3
    # subprocess.
    print(f"Found {len(plugin_dirs)} plugins.")
    for plugin_dir in plugin_dirs:
        run_guarded(rep, str(plugin_dir), lambda d=plugin_dir: validate_plugin(d, rep))

    marketplace = Path(".claude-plugin/marketplace.json")
    if marketplace.is_file():
        run_guarded(rep, str(marketplace), lambda: validate_marketplace(marketplace, rep))
    else:
        rep.warn("No .claude-plugin/marketplace.json found")

    codex_marketplace = Path(".agents/plugins/marketplace.json")
    if codex_marketplace.is_file():
        run_guarded(
            rep,
            str(codex_marketplace),
            lambda: validate_codex_marketplace(codex_marketplace, rep),
        )
    else:
        rep.warn("No .agents/plugins/marketplace.json found")

    versions_file = Path("versions.json")
    if skip_versions:
        print("  [SKIP] versions.json (--skip-versions)")
    elif versions_file.is_file():
        run_guarded(rep, str(versions_file), lambda: validate_versions(versions_file, rep))
    else:
        rep.fail(f"{versions_file}: missing file")

    docs_index = Path("docs/index.html")
    if skip_versions:
        # docs/index.html validation cross-checks plugin cards against the
        # bun-resolved version source (_expected_skill_versions), so it is a
        # version-DERIVED surface. --skip-versions means "run without the
        # bun-backed version toolchain", so skip it here too — otherwise the
        # flag still hard-requires bun and defeats its own purpose.
        print("  [SKIP] docs/index.html (--skip-versions)")
    elif docs_index.is_file():
        run_guarded(rep, str(docs_index), lambda: validate_docs_index(docs_index, rep))
    else:
        rep.warn("No docs/index.html found")

    return 1 if rep.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
