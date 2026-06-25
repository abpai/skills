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

## Skill authoring rules that prevent routing/install drift

- Keep skill `description` trigger-focused: say when to use the skill and the
  main workflows it routes. Do not bury trigger rules in the body while leaving
  vague frontmatter behind.
- Give workflow steps explicit done criteria. A phase should say what evidence
  or artifact makes it complete, especially for review, routing, and handoff
  workflows.
- Umbrellas load sibling workflow modules as `./<subcommand>.md`. Hidden
  per-command wrappers load `../<plugin>/<workflow>.md` and pass `$ARGUMENTS`
  through. Do not use checkout-relative paths like `skills/<plugin>/...` inside
  installed skills; installed plugins run from a copied cache.
- Hidden wrappers should be tiny: explain that they load the module, pass
  arguments, stop if the module cannot be read, and preserve one or two
  workflow-specific invariants. Broad tool allowlists belong on the umbrella,
  not the hidden wrapper.
- Do not add runtime self-update checks or installer side effects to skill
  bodies (`raw.githubusercontent.com`, `npx skills update`, etc.). Skills should
  execute the user's requested workflow, not phone home or mutate the installed
  skill set unless the skill is specifically an installer/updater.

When you change a plugin, bump its `version` in `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, the model-invocable `SKILL.md` `metadata.version`
when the plugin has one, and the root `versions.json`. Command-only plugins use
the plugin manifest version as their version source. Treat manifest files,
marketplaces, `versions.json`, and `docs/index.html` as one atomic packaging
bundle, then run:

```bash
scripts/sync-plugin-versions.sh
scripts/generate-versions.sh
scripts/validate-skills.sh
scripts/validate-npx-install.sh
git diff --check
bun scripts/skill-metadata.ts check-version-bump origin/main
```

Full rationale: see [CLAUDE.md](CLAUDE.md) and the README section ["Why every
namespaced command is a
`skills/<name>/SKILL.md`"](README.md#why-every-namespaced-command-is-a-skillsnameskillmd).
