# Contributing Skills

## Scope

Contributions should add or improve reusable skills that can be used across compatible agent runtimes.

This repo is plugin-oriented:

- Claude plugins live in top-level folders with `.claude-plugin/plugin.json`
- Codex plugins also add `.codex-plugin/plugin.json`
- Some plugins are intentionally Claude-only when their workflow depends on
  Claude plugin semantics and merely shells out to external CLIs. `pi` is the
  canonical example in this repo.

## Add a New Skill

1. Create a new folder using kebab-case (example: `my-skill`).
2. Add the appropriate plugin manifest(s):
   - always `.claude-plugin/plugin.json`
   - add `.codex-plugin/plugin.json` only when the plugin is intended to be installable in Codex
3. Keep only `plugin.json` inside `.claude-plugin/`. Put `skills/`, `agents/`,
   `hooks/`, `settings.json`, and related assets at the plugin root.
4. Put durable workflow logic in `skills/<name>/SKILL.md`.
5. Expose every namespaced slash command (`/<plugin>:<name>`) as its own
   `skills/<name>/SKILL.md` subdirectory. **Do not use a plugin-root
   `commands/` directory** — flat files there do not acquire the plugin
   namespace and never appear in the `/` menu. For a grouped pack, add a
   public umbrella skill (`skills/<plugin>/SKILL.md` → `/<plugin>`)
   plus one per-command skill (`skills/<workflow>/SKILL.md`) with
   `disable-model-invocation: true`. Every entrypoint is explicit-only
   (`disable-model-invocation: true` and, in `agents/openai.yaml`,
   `policy.allow_implicit_invocation: false`). See the README section "Why every
   namespaced command is a `skills/<name>/SKILL.md`".
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
- [ ] `metadata.version` is set in frontmatter for public skills
  (hidden per-command shims use the owning plugin version).
- [ ] Root docs mention any new plugin or runtime exception.
- [ ] Validation script passes.

## Versioning

Every public skill must have a `metadata.version` field in its YAML frontmatter. This powers the auto-update check that notifies users when a newer version is available. Hidden per-command shims (`metadata.internal: true`) intentionally use the owning plugin version instead of carrying separate version metadata. All entrypoints are explicit-only, so version ownership follows the public/internal split, not model invocability.

When publishing changes to a skill:

1. Bump `metadata.version` in the public skill's `SKILL.md`, or bump
   `.claude-plugin/plugin.json` for command-only plugins.
2. Commit and open a PR.

CI enforces that changed plugins have bumped versions. On merge, plugin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`) and `versions.json` are auto-synced from the public `SKILL.md` version when one exists; command-only plugins are tracked from the plugin manifest version.

## Validation

Run:

```bash
scripts/validate-skills.sh
```

Local validation requires Bun because the repo uses a shared Bun/TypeScript
metadata resolver and builds/tests shipped TypeScript helpers. CI installs Bun
before running the same gate.

For wrapper changes that affect `codex-exec` or `claude`, also run:

```bash
scripts/test-wrapper-parity.sh
```

`validate-skills.sh` performs local structural validation: it checks skill
names and `SKILL.md` structure against the `agentskills.io` spec (e.g. the
≤ 500-line and ≤ 1024-char description guidelines), enforces the version and
manifest checks, and also validates Claude plugin command frontmatter, plugin
agent frontmatter, plugin-manifest path safety, and `hooks/hooks.json`
structure so plugin-only workflows like `pi` stay aligned with current Claude
plugin conventions. It does not call any external validator.

The wrapper parity test uses fake `codex` and `claude` binaries to
verify prompt transport, private run artifacts, generated monitor/continue
helpers, session continuation, and safe env-file parsing without requiring real
agent subscriptions in CI.

## Pre-commit Hook

To run skill validation automatically before each commit, install pre-commit hooks:

```bash
uv tool install pre-commit
uvx pre-commit install
```

Then commits will run:

- `scripts/validate-skills.sh` (structural checks)
