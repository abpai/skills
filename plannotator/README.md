# plannotator

Interactive plan review, code review, and markdown annotation for Claude Code, packaged for installation from `abpai/skills`.

This repo vendors the upstream Plannotator Claude plugin surface from `backnotprop/plannotator` so you can install it via:

```bash
/plugin marketplace add abpai/skills
/plugin install plannotator@abpai-skills
```

## Prerequisite

Install the external `plannotator` binary first:

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

For Windows installers, version pinning, or checksum/provenance verification, see:
`https://plannotator.ai/docs/getting-started/installation/`

Restart Claude Code after installing the plugin so the hooks take effect.

## What This Plugin Adds

- `/plannotator-review`
- `/plannotator-annotate <file.md>`
- `/plannotator-last`
- `EnterPlanMode` hook via `plannotator improve-context`
- `ExitPlanMode` hook via `plannotator`

## Notes

- This is a Claude-only plugin in `abpai/skills`; it is intentionally not added to the Codex marketplace in this repo.
- The binary, backend, and UI remain upstream Plannotator functionality. This repo only vendors the Claude plugin packaging and docs.
- Upstream source: `https://github.com/backnotprop/plannotator/tree/main/apps/hook`
