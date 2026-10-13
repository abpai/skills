# HumanLayer sync

Compared against `humanlayer/skills` main at
`653b6411c1f70c275a18e37673b042ff99f67ceb` on 2026-10-13.

## show-me

No upstream behavior is missing from the local adaptation. Upstream changes
`4d8d644` (tree glyphs), `d3138e5` (open HTML), `6ab9013` (focused visual guidance),
and `bba9d13` (explicit invocation) are already represented.
The local adaptation preserves additional concise-prose and diagram-size guidance,
portable file preview instructions, and Claude/Codex packaging.

For direct upstream installs, use the migration commands in the root README.
This comparison does not uninstall a plugin in a user's local application.

## visual-pr

Imported the plugin introduced in upstream commit `4e39d8f`, with its PR template
and visual examples. Preserved the MIT license and HumanLayer copyright.

Local compatibility changes:

- Explicit-only invocation policies and discoverable descriptions for both runtimes.
- Sibling reference paths instead of HumanLayer's `{SKILLBASE}` placeholder.
- Portable artifact previews and real file links instead of HumanLayer-only artifact
  rendering and cloud-permalink assumptions.
- Claude/Codex manifests and both marketplace entries.

To resync, compare these files with `plugins/visual-pr` at the recorded upstream
revision and review later upstream commits, retaining the compatibility changes.
There is no runtime fetch or automatic update behavior.

## Verification

The required subagent dogfood pass used the imported skill on this actual change,
read all three references, and drafted a template-conforming PR description.
No skill-caused friction was observed in context gathering or drafting.
Remote publication remained with the parent agent and was outside that pass.

The full skill validator and real `npx skills` discovery check passed (39 skills).
The Claude runner regression used a writable `CLAUDE_CONFIG_DIR` because the
managed environment's home directory is read-only.
