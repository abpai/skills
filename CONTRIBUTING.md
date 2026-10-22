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
   `policy.allow_implicit_invocation: false`), except `show-me` and
   `visual-pr`, which either model may start, and `codex-exec`, which Claude
   may start. See the README section "Why every
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
- [ ] `bin/skills gate` passes.

## Versioning

Every public skill must have a `metadata.version` field in its YAML frontmatter. This powers the auto-update check that notifies users when a newer version is available. Hidden per-command shims (`metadata.internal: true`) intentionally use the owning plugin version instead of carrying separate version metadata. Version ownership follows the public/internal split, not model invocability.

When publishing changes to a skill:

1. Run `bin/skills bump <plugin> [patch|minor|major]`. It bumps the version
   source (the public skill's `metadata.version`, or `.claude-plugin/plugin.json`
   for command-only plugins) once relative to `origin/main`, then rewrites
   both `plugin.json` files, `versions.json` and the `docs/index.html` card.
   Running it again after a rebase or restack does nothing.
2. Commit and open a PR.

CI (`check-version-bump`) fails a PR that changes a plugin's skills, agents,
hooks or manifests without bumping it, always measured against `main`, so a
stacked PR bumps once. Nothing commits version changes after merge: the PR
carries every version surface. If a rebase conflicts in `versions.json` or a
`plugin.json`, take either side and run `bin/skills fix`.

## Validation

One command runs the whole lane, the same gates CI runs:

```bash
bin/skills gate
```

It needs Bun (it installs the repo's one dependency, the npm `yaml` parser the
`npx skills` installer uses, on first run). It stops at the first failing gate
and prints the command that reruns only that gate. `bin/skills gate --list`
shows them all:

| Gate | Checks |
| --- | --- |
| `surfaces` | both `plugin.json` versions, `versions.json` and `docs/index.html` cards match the version sources (`bin/skills fix` repairs them) |
| `structure` | manifests, `SKILL.md` frontmatter parsed exactly as the installer parses it, `agents/openai.yaml`, plugin agents, `hooks.json`, both marketplaces |
| `tooling` | repo tooling tests, finish-lane, TypeScript builds, bash/python syntax, Codex strict-mode schemas, mirrored support docs |
| `runners` | shell fixture tests for the Claude, Codex, Cursor and Antigravity wrappers (fake binaries, no subscriptions) |
| `version` | every changed plugin is bumped once relative to `origin/main` |
| `install` | the real `npx skills` installer discovers every skill (needs network) |
| `whitespace` | `git diff --check` since `origin/main` |

Gates only read; `bin/skills fix` and `bin/skills bump` are the only commands
that write. A gate that cannot run (offline, no `python3`) is reported as
"not proven" instead of passing; CI adds `--strict`, which fails on that.
`bin/skills check` runs the fast offline subset (`surfaces`, `structure`,
`whitespace`) in well under a second. `--json` prints a machine-readable
report. Exit codes: 0 ok, 1 failed, 2 usage error, 3 prerequisite missing.

`scripts/validate-skills.sh` still works and forwards to `bin/skills`.

Eve behavioral evals are not a gate because they need Docker and Node >= 24,
and the live suite spends model tokens. `bin/skills evals check` runs packaging,
typechecking, coverage controls and discovery without Docker.
`bin/skills evals integration` runs Docker isolation and mock-model session boot.
CI runs these as independent jobs; `bin/skills evals smoke` runs both locally.
`bin/skills evals live [eval ids...]` runs real sessions.

## Pre-commit Hook

To run skill validation automatically before each commit, install pre-commit hooks:

```bash
uv tool install pre-commit
uvx pre-commit install
```

Then commits will run `bin/skills check` (surfaces, structure, whitespace).
