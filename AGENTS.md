# Repo guidance for coding agents

This repo is a Claude Code plugin marketplace plus a Codex plugin repo. Each
top-level folder is a plugin shipping `.claude-plugin/plugin.json` and usually
`.codex-plugin/plugin.json`.

Authoring, structure, and packaging rules live in `docs/skill-authoring.md`.
Read it before you create or restructure a skill. `scripts/validate-skills.sh`
enforces most of them.

## Invariants

- Namespaced commands are skill subdirectories
  (`<plugin>/skills/<name>/SKILL.md` → `/<plugin>:<name>`), never plugin-root
  `commands/`.
- Every skill entrypoint is human-invocable only: `disable-model-invocation:
  true` in `SKILL.md`, `policy.allow_implicit_invocation: false` in its
  `agents/openai.yaml`.
- No runtime self-update checks or installer side effects in skill bodies.

## Process

- Skill behavior or instruction changes need a real subagent dogfood pass
  (`harness/skills/harness/dogfood.md`) before you call the skill ready.
  Packaging/version-only changes may skip it — say so in the proof.
- When you change a plugin, bump its version at the source the tooling reads —
  `metadata.version` in the public `SKILL.md`, or `.claude-plugin/plugin.json`
  for command-only plugins — then run the validation lane. The lane syncs the
  other version surfaces and fails on what it cannot fix:

```bash
scripts/sync-plugin-versions.sh
scripts/generate-versions.sh
scripts/validate-skills.sh
scripts/validate-npx-install.sh
git diff --check
bun scripts/skill-metadata.ts check-version-bump origin/main
```
