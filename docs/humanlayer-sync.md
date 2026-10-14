# HumanLayer sync

Last compared against `humanlayer/skills` main at
`653b6411c1f70c275a18e37673b042ff99f67ceb` on 2026-10-13.

## show-me

In sync. Every upstream change up to that commit is already in the local
adaptation, which also keeps its own diagram-size guidance and Claude/Codex
packaging.

## visual-pr

Imported from upstream commit `4e39d8f`. HumanLayer's MIT license and copyright
are kept in `visual-pr/LICENSE`.

Local changes, to keep when resyncing:

- Runs in any repository: no `.humanlayer/` task paths, HumanLayer task links,
  or cloud permalinks. The PR body goes through a temporary file.
- Plain reference paths instead of HumanLayer's `{SKILLBASE}` placeholder and
  Claude-only `Read(...)` syntax, so Codex can follow them.
- Template rules live in `SKILL.md`, and the final-answer format is inlined
  there, so the template holds only PR-body text.
- `references/show-me.md` is trimmed to the views a PR outline uses. It is a
  deliberate copy: plugins cannot reference each other's files once installed.
- Explicit-only invocation and Claude/Codex manifests and marketplace entries.

To resync, diff `plugins/visual-pr` from the recorded commit to upstream main
and carry over what still applies.
