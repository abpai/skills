# Repo guidance for coding agents

This repo is a Claude Code plugin marketplace plus a Codex plugin repo. Each
top-level folder is a plugin shipping `.claude-plugin/plugin.json` and usually
`.codex-plugin/plugin.json`.

## Where to look

- Detailed skill authoring and packaging rules: `docs/skill-authoring.md`
- Dogfood workflow for skill hardening: `harness/skills/harness/dogfood.md`
- Command-shim rationale: README section ["Why every namespaced command is a `skills/<name>/SKILL.md`"](README.md#why-every-namespaced-command-is-a-skillsnameskillmd)

## Rules

- Namespaced commands must be skill subdirectories, never plugin-root
  `commands/`: `<plugin>/skills/<name>/SKILL.md` produces `/<plugin>:<name>`.
- Grouped workflow packs use one model-invocable umbrella skill
  (`skills/<plugin>/SKILL.md`) plus hidden per-command wrappers
  (`skills/<workflow>/SKILL.md`) with `disable-model-invocation: true`,
  `user-invocable: false`, and `metadata.internal: true`.
- Keep skill `description` trigger-focused, workflow steps explicit about done
  criteria, and installed-skill paths relative to their copied cache location.
- Do not add runtime self-update checks or installer side effects to ordinary
  skill bodies.
- For skill behavior, routing, workflow-step, or instruction changes, run a real
  subagent dogfood pass before claiming the skill is ready. Review the
  transcript, patch the smallest durable surface that caused friction, and rerun
  until the next representative task converges cleanly.
- Pure packaging/version-only changes may skip dogfood, but say so in the proof.

## Packaging

When you change a plugin, bump its version source and sync the public bundle:
`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, model-invocable
`SKILL.md` `metadata.version` when present, `.claude-plugin/marketplace.json`,
`.agents/plugins/marketplace.json` when applicable, `versions.json`,
`README.md`, and `docs/index.html`.

Run the validation lane:

```bash
scripts/sync-plugin-versions.sh
scripts/generate-versions.sh
scripts/validate-skills.sh
scripts/validate-npx-install.sh
git diff --check
bun scripts/skill-metadata.ts check-version-bump origin/main
```
