# Repo guidance for coding agents

This repo is a Claude Code plugin marketplace + Codex plugin repo. Each top-level
folder is a plugin shipping `.claude-plugin/plugin.json` and (usually)
`.codex-plugin/plugin.json`.

## Namespaced commands MUST be skill subdirectories — never `commands/`

To expose a namespaced command such as `/code:review-and-commit` or
`/engineering:tdd`, create a **skill subdirectory** — one `SKILL.md` per command:

```
<plugin>/skills/<name>/SKILL.md   →   /<plugin>:<name>
```

Do **not** add a plugin-root `commands/` directory. Flat Markdown files under a
plugin's `commands/` do **not** acquire the plugin namespace, so the command is
silently missing from the `/` menu. Only `skills/<name>/` subdirectories
deterministically produce `/<plugin>:<name>`. We hit this bug and fixed it by
converting every `commands/*.md` wrapper into `skills/<name>/SKILL.md` — don't
reintroduce `commands/`.

Grouped workflow packs use a model-invocable umbrella skill
(`skills/<plugin>/SKILL.md` → `/<plugin>`) plus one per-command skill
(`skills/<workflow>/SKILL.md`) carrying `disable-model-invocation: true`.

When you change a plugin, bump its `version` in `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, the umbrella `SKILL.md` `metadata.version`, and the
root `versions.json`.

Full rationale: see [CLAUDE.md](CLAUDE.md) and the README section ["Why every
namespaced command is a
`skills/<name>/SKILL.md`"](README.md#why-every-namespaced-command-is-a-skillsnameskillmd).
