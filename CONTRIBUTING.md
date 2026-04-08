# Contributing Skills

## Scope

Contributions should add or improve reusable skills that can be used across compatible agent runtimes.

This repo is plugin-oriented:

- Claude plugins live in top-level folders with `.claude-plugin/plugin.json`
- Codex plugins also add `.codex-plugin/plugin.json`
- Some plugins are intentionally Claude-only when their workflow depends on
  Claude plugin semantics and merely shells out to external CLIs. `pi` is the
  canonical example.

## Add a New Skill

1. Create a new folder using kebab-case (example: `my-skill`).
2. Add the appropriate plugin manifest(s):
   - always `.claude-plugin/plugin.json`
   - add `.codex-plugin/plugin.json` only when the plugin is intended to be installable in Codex
3. Keep only `plugin.json` inside `.claude-plugin/`. Put `skills/`, `agents/`,
   `commands/`, `hooks/`, `settings.json`, and related assets at the plugin
   root.
4. Put durable workflow logic in `skills/<name>/SKILL.md`.
5. If you expose Claude slash commands, keep `commands/*.md` as thin shims; the
   long-lived protocol should still live in `skills/`.
6. Plugin agents may use normal subagent frontmatter, but Claude plugin agents
   must not rely on `hooks`, `mcpServers`, or `permissionMode`. If you need
   those, copy the agent into `.claude/agents/` or `~/.claude/agents/`.
7. If you ship hooks, put them in `hooks/hooks.json` (or inline in
   `plugin.json`) and use `${CLAUDE_PLUGIN_ROOT}` /
   `${CLAUDE_PLUGIN_DATA}` rather than assuming the current working directory.
8. Keep the skill self-contained and include optional folders only when needed:
   - `scripts/`
   - `references/`
   - `assets/`

## Forked Skills

When importing from upstream:

1. Preserve attribution and license in `SKILL.md` frontmatter (for example: `license`, `metadata.author`, `metadata.version`).
2. Keep a note of upstream source/version in frontmatter metadata.
3. Re-validate after local modifications.

## Pre-Publish Checklist

- [ ] `SKILL.md` exists for every skill folder.
- [ ] `.claude-plugin/plugin.json` exists for every published plugin folder.
- [ ] Frontmatter contains valid `name` and `description`.
- [ ] `name` matches folder name.
- [ ] `name` is lowercase kebab-case, <= 64 chars.
- [ ] `description` is specific enough to trigger correct usage.
- [ ] `metadata.version` is set in frontmatter (see Versioning below).
- [ ] Root docs mention any new plugin or runtime exception.
- [ ] Validation script passes.

## Versioning

Every skill must have a `metadata.version` field in its YAML frontmatter. This powers the auto-update check that notifies users when a newer version is available.

When publishing changes to a skill:

1. Bump `metadata.version` in the skill's `SKILL.md`.
2. Commit and open a PR.

CI enforces that changed plugins have bumped versions. On merge, plugin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`) and `versions.json` are auto-synced from the `SKILL.md` version.

## Validation

Install the official validator (recommended):

```bash
uv tool install "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"
```

Run:

```bash
scripts/validate-skills.sh
```

If `skills-ref` is installed, the script runs official validation and still enforces the local version/manifest checks. Otherwise it falls back to local structural checks plus the version/manifest checks.

The local validator also checks Claude plugin command frontmatter, plugin agent
frontmatter, plugin-manifest path safety, and `hooks/hooks.json` structure so
plugin-only workflows like `pi` stay aligned with current Claude plugin
conventions.

## Pre-commit Hook

To run skill validation automatically before each commit, install pre-commit hooks:

```bash
uv tool install pre-commit
uvx pre-commit install
```

Then commits will run:

- `scripts/validate-skills.sh` (structural checks)
- `skill-scanner` via `scripts/run_skill_scanner.py` (security scanning)
