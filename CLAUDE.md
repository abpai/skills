# Repo guidance for Claude Code

This repo is a Claude Code plugin marketplace + Codex plugin repo. Each top-level
folder is a plugin.

## Namespaced commands MUST be skill subdirectories — never `commands/`

To expose a namespaced command like `/code:review-and-commit` or
`/engineering:tdd`, create a **skill subdirectory**:

```
<plugin>/skills/<name>/SKILL.md   →   /<plugin>:<name>
```

Do **not** add a plugin-root `commands/` directory. Flat Markdown files under a
plugin's `commands/` do **not** acquire the plugin namespace — the command never
appears in the `/` menu. This is per the official rule that only `skills/<name>/`
subdirectories deterministically produce `/<plugin>:<name>`
(["Use `skills/` for new plugins"](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)).
We hit this exact bug once; the fix was converting every `commands/*.md` wrapper
into `skills/<name>/SKILL.md`. Don't reintroduce `commands/`.

### Grouped workflow pack pattern

- `skills/<plugin>/SKILL.md` — model-invocable **umbrella** skill that collapses
  to `/<plugin>` and routes to bundled workflow modules
  (`skills/<plugin>/*.md`, loose support files, not skills).
- `skills/<workflow>/SKILL.md` — one **per-command** skill per workflow,
  surfacing `/<plugin>:<workflow>`. Set `disable-model-invocation: true` on
  these so only the user triggers them directly while the model auto-routes
  through the umbrella skill.

## Other conventions

- Only `plugin.json` lives in `.claude-plugin/` (and `.codex-plugin/`). All
  runtime dirs (`skills/`, `agents/`, `hooks/`, `internal/`) sit at the plugin
  root.
- Paths referenced from a skill must stay **inside the owning plugin** —
  installed plugins are copied into a runtime cache.
- Bump the plugin `version` in `.claude-plugin/plugin.json`,
  `.codex-plugin/plugin.json`, the umbrella `SKILL.md` `metadata.version`, and
  the root `versions.json` when you change a plugin, so users receive the update.

See the README section ["Why every namespaced command is a
`skills/<name>/SKILL.md`"](README.md#why-every-namespaced-command-is-a-skillsnameskillmd)
for the full rationale.
