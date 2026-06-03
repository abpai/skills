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
  surfacing `/<plugin>:<workflow>`. Set `disable-model-invocation: true` **and**
  `metadata.internal: true` on these. `disable-model-invocation` keeps the model
  routing through the umbrella while the user can still call `/<plugin>:<workflow>`
  directly in Claude. `metadata.internal: true` hides the wrapper from agents that
  flatten every `SKILL.md` into one selectable list — notably the `npx skills`
  installer Codex uses — so they surface only the umbrella pack instead of a
  sprawling list of per-command wrappers. Claude Code ignores `metadata.internal`,
  so the `/<plugin>:<workflow>` command is unaffected. (Power users can still pull
  the wrappers into a flat-list agent with `INSTALL_INTERNAL_SKILLS=1`.)
- Give each umbrella a **subcommand router** so the pack still works where the
  `:` namespace does not exist (e.g. Codex): accept `<plugin> <workflow> …` and
  `<plugin> --<workflow> …`, strip a leading `--`, match the first token against
  the workflow names, and load `skills/<plugin>/<workflow>.md`. Add a matching
  `argument-hint` to the umbrella frontmatter. (A Claude-only pack like `pi`
  needs no Codex router, but its user-only wrappers still set
  `metadata.internal: true` so they stay out of flat-list installers.)
- `scripts/validate-skills.sh` **enforces** the invariant
  `disable-model-invocation: true` ⟹ `metadata.internal: true` and fails CI (via
  `validate-pr.yml`) if a wrapper omits it, so the Codex-sprawl regression cannot
  silently recur.

## Other conventions

- Only `plugin.json` lives in `.claude-plugin/` (and `.codex-plugin/`). All
  runtime dirs (`skills/`, `agents/`, `hooks/`, `internal/`) sit at the plugin
  root.
- Paths referenced from a skill must stay **inside the owning plugin** —
  installed plugins are copied into a runtime cache.
- Bump the plugin `version` in `.claude-plugin/plugin.json`,
  `.codex-plugin/plugin.json`, the model-invocable `SKILL.md`
  `metadata.version` when the plugin has one, and the root `versions.json` when
  you change a plugin, so users receive the update. Command-only plugins use the
  plugin manifest version as their version source.

See the README section ["Why every namespaced command is a
`skills/<name>/SKILL.md`"](README.md#why-every-namespaced-command-is-a-skillsnameskillmd)
for the full rationale.
