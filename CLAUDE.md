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
- `skills/<workflow>/SKILL.md` — one **per-command** skill per workflow. Set
  **all three** of `disable-model-invocation: true`, `user-invocable: false`, and
  `metadata.internal: true` on these, so the wrapper is hidden on every surface and
  the umbrella stays the single scoped entry point:
  - `disable-model-invocation: true` keeps the model routing through the umbrella
    instead of auto-invoking a wrapper.
  - `user-invocable: false` keeps the wrapper out of the Claude Code `/` menu.
    A wrapper's command name is namespaced (`/<plugin>:<workflow>`), but Claude
    Code still **lists each wrapper in the `/` menu under its bare leaf name**, so
    leaving wrappers user-invocable sprays a wall of `/<workflow>` entries across
    the menu that collide with each other and with built-ins (e.g. a pack's
    `/review` sitting next to the built-in `/review`). Hiding them leaves the
    scoped `/<plugin>` umbrella as the only menu entry; users reach a workflow
    through its `/<plugin> <workflow>` router (below). Per the skills docs this
    flag together with `disable-model-invocation: true` also stops direct
    invocation, so the umbrella router — not a typed `/<plugin>:<workflow>` — is
    the access path. We hit this exact regression once when the wrappers were
    first added as user-invocable skills.
  - `metadata.internal: true` hides the wrapper from agents that flatten every
    `SKILL.md` into one selectable list — notably the `npx skills` installer Codex
    uses — so they surface only the umbrella pack instead of a sprawling list.
    (Power users can still pull the wrappers into a flat-list agent with
    `INSTALL_INTERNAL_SKILLS=1`.)
- Give each umbrella a **subcommand router** so the pack still works where the
  `:` namespace does not exist (e.g. Codex): accept `<plugin> <workflow> …` and
  `<plugin> --<workflow> …`, strip a leading `--`, match the first token against
  the workflow names, and load `skills/<plugin>/<workflow>.md`. Add a matching
  `argument-hint` to the umbrella frontmatter. (A Claude-only pack like `pi`
  needs no Codex router. `pi` also has **no umbrella** — its phase commands
  (`/pi:plan`, `/pi:execute`, …) are the primary interface with no router to fall
  back to, so they stay user-invocable and are exempt from the
  `user-invocable: false` rule below; they still set `metadata.internal: true` to
  stay out of flat-list installers.)
- `scripts/validate-skills.sh` **enforces** that every wrapper with
  `disable-model-invocation: true` also sets `metadata.internal: true`, and — when
  the wrapper's pack has an umbrella (a sibling `skills/<plugin>/SKILL.md`) — also
  `user-invocable: false`. It fails CI (via `validate-pr.yml`) if a wrapper omits
  either, so neither the Codex-sprawl regression nor the unscoped-`/`-menu
  regression can silently recur.

## Other conventions

- Only `plugin.json` lives in `.claude-plugin/` (and `.codex-plugin/`). All
  runtime dirs (`skills/`, `agents/`, `hooks/`, `internal/`) sit at the plugin
  root.
- A plugin may ship an always-registered hook via `hooks/hooks.json` (or an
  inline `hooks` key in `plugin.json`). The `code` plugin registers a
  `PreToolUse(Bash)` gate (`code/hooks/gate-before-push.sh`) that is **inert by
  default** — it NO-OPs unless `prepare-pr` has armed the per-repo marker, and
  only then blocks `git push` / `gh pr create` / PR-body edits until the branch
  is sealed. Codex has no Claude-hook system, so the gate is Claude-only; keep
  the Codex manifest at version/description parity but do not declare the hook
  there.
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
