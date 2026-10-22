# Repo guidance for coding agents

This repo is a Claude Code plugin marketplace plus a Codex plugin repo. Each
top-level folder is a plugin shipping `.claude-plugin/plugin.json` and usually
`.codex-plugin/plugin.json`.

Authoring, structure, and packaging rules live in `docs/skill-authoring.md`.
Read it before you create or restructure a skill. `bin/skills gate` enforces
most of them.

## Invariants

- Namespaced commands are skill subdirectories
  (`<plugin>/skills/<name>/SKILL.md` → `/<plugin>:<name>`), never plugin-root
  `commands/`.
- Every skill entrypoint is human-invocable only:
  `disable-model-invocation: true` in `SKILL.md` and
  `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. The
  exceptions are `show-me` and `visual-pr` (model-invocable in both products)
  and `codex-exec` (Claude only), listed in `scripts/lib/structure.ts`.
- No runtime self-update checks or installer side effects in skill bodies.

## Process

- Skill behavior or instruction changes need a real subagent dogfood pass
  (`harness/skills/harness/dogfood.md`) before you call the skill ready.
  Packaging/version-only changes may skip it — say so in the proof.
- When you change a plugin, bump it once with `bin/skills bump <plugin>`
  (`patch` by default; `minor` or `major` as a second argument). The bump is
  measured against `origin/main`, so rerunning it after a rebase or restack is
  a no-op, and it rewrites the derived version surfaces for you.
- Before you call work done, run the whole lane. It stops at the first failing
  gate and prints the command that reruns just that gate:

```bash
bin/skills gate
```

- `bin/skills check` is the fast offline subset (pre-commit runs it).
  `bin/skills fix` rewrites derived version surfaces after a merge conflict.
  `bin/skills gate --list` shows every gate. Report any gate that was skipped
  or "not proven" (no network, no python3) rather than calling it passed.
- Eve evals are not a gate. Run `bin/skills evals smoke` (Docker + Node 24)
  when you touch `evals/eve/` or skill routing.
