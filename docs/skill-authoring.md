# Skill authoring and packaging

This is the detailed source of truth for plugin layout, skill authoring,
dogfood, packaging, and validation in this repo. Keep `AGENTS.md` compact and
route here instead of duplicating these rules.

## Plugin layout

Each top-level directory is a plugin. Only `plugin.json` lives in
`.claude-plugin/` and `.codex-plugin/`. Runtime directories such as `skills/`,
`agents/`, `hooks/`, and `internal/` stay at the plugin root.

Paths referenced from a skill must stay inside the owning plugin. Installed
plugins are copied into runtime caches, so checkout-relative paths like
`skills/<plugin>/<workflow>.md` go stale.

## Namespaced commands

To expose a namespaced command such as `/code:review-and-commit` or
`/engineering:tdd`, create one skill subdirectory per command:

```text
<plugin>/skills/<name>/SKILL.md   ->   /<plugin>:<name>
```

Do not add a plugin-root `commands/` directory. Flat Markdown files under
`commands/` do not acquire the plugin namespace and can silently disappear from
the command menu. This repo already hit that bug and fixed it by converting
`commands/*.md` wrappers into `skills/<name>/SKILL.md`.

This follows Claude Code's rule to use `skills/` for new plugins:
https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name

## Grouped workflow packs

Grouped workflow packs use two layers:

- `skills/<plugin>/SKILL.md`: model-invocable umbrella skill that routes to flat
  sibling workflow modules such as `./prepare-pr.md`.
- `skills/<workflow>/SKILL.md`: hidden per-command wrapper that loads the
  umbrella module via `../<plugin>/<workflow>.md` and passes arguments through.

Hidden wrappers must set all three fields:

```yaml
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
```

`scripts/validate-skills.sh` enforces this wrapper shape. It fails when a hidden
wrapper omits `metadata.internal: true`, and for packs with an umbrella it also
requires `user-invocable: false`.

Keep wrappers tiny. They should load the module, pass arguments, stop if the
module cannot be read, and preserve only one or two workflow-specific invariants.
Broad tool allowlists belong on the umbrella, not the wrapper.

Umbrellas should accept `<plugin> <workflow> ...` and `<plugin> --<workflow> ...`,
strip a leading `--`, match the first token against known workflow names, and
load the sibling module. Claude-only packs without a Codex fallback may be
exceptions, but document the reason.

## Skill quality bar

- Put concrete trigger language in frontmatter `description`. It should answer
  "use this when..." without requiring the body to be read first.
- Give every routed workflow an `argument-hint` and keep argument parsing local
  to the route that uses it.
- State completion criteria for non-trivial phases. A step is done when a module
  is loaded, a scope is selected, evidence is gathered, a verdict is emitted, or
  a file/artifact is written.
- Preserve progressive disclosure. Umbrellas route to compact sibling workflow
  modules; wrappers do not duplicate full workflow logic.
- Do not add runtime self-update checks, network fetches, or package-installer
  commands to ordinary skill bodies (`raw.githubusercontent.com`,
  `npx skills update`, etc.). Installation/update behavior belongs in installer
  skills or repo docs, not in a skill invocation.
- Prefer structured evidence channels in review skills: deterministic scanner
  output, promoted findings, skipped/noise reasons, and agent-owned review
  prompts. Scanner leads are not findings until surrounding code is inspected.

## Dogfood gate

For changes to a skill's behavior, routing, workflow steps, or instruction text,
dogfood the changed skill with a real subagent before final validation. Use the
workflow in `harness/skills/harness/dogfood.md` or an equivalent subagent run on
a representative task.

Done means:

- A subagent used the changed skill on a representative, non-toy task.
- The orchestrator reviewed the transcript or final report for skill-caused
  friction.
- Real friction was recorded as `observation | evidence | suspected skill cause`.
- The smallest durable surface was repaired, usually the skill text or route
  that caused the friction.
- A follow-up subagent run converged cleanly, or the remaining issue was
  reported as blocked or observed-only.

Do not count deterministic validators alone as dogfood. They prove packaging;
dogfood proves the skill can guide another agent unaided. Pure
packaging/version-only changes may skip dogfood, but the final proof should say
that dogfood was intentionally skipped and why.

## Packaging bundle

When changing a plugin, bump its version source so users receive the update:

- model-invocable skills: `metadata.version` in the public `SKILL.md`
- command-only plugins: `.claude-plugin/plugin.json` version
- plugin manifests: `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`
- root version index: `versions.json`

Treat public surfaces as one bundle. If a skill/frontmatter, manifest,
marketplace description, docs card, or version changes, sync all applicable
files:

- `.claude-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.agents/plugins/marketplace.json`
- `versions.json`
- `README.md`
- `docs/index.html`

`docs/index.html` is still a manual sync surface. If validation reports only a
docs-card version drift, patch the card to match the metadata source.

## Validation lane

Before opening or updating a PR for plugin changes, run:

```bash
scripts/sync-plugin-versions.sh
scripts/generate-versions.sh
scripts/validate-skills.sh
scripts/validate-npx-install.sh
git diff --check
bun scripts/skill-metadata.ts check-version-bump origin/main
```

`check-version-bump origin/main` only checks committed changes. If it reports
`Checked 0 plugin(s)` in a dirty working tree, commit first and rerun before
opening the PR.

If unrelated untracked scratch trees under `tmp/` make `scripts/validate-skills.sh`
fail on missing dependencies, validate from a clean temporary copy or detached
worktree while preserving the untracked files unchanged.

## Claude Code hooks

A plugin may ship an always-registered hook via `hooks/hooks.json` or an inline
`hooks` key in `plugin.json`. The `code` plugin registers a Claude-only
`PreToolUse(Bash)` gate in `code/hooks/gate-before-push.sh`; it is inert unless
`prepare-pr` arms the per-repo marker. Keep Codex manifests at version and
description parity, but do not declare Claude hooks there.
