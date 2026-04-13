---
name: plannotator
description: Use Plannotator when the user wants visual review or annotation of a plan, git diff, markdown file, or the assistant's last message. In Claude Code, prefer the bundled slash commands `/plannotator-review`, `/plannotator-annotate`, and `/plannotator-last`; this plugin also hooks `EnterPlanMode` and `ExitPlanMode` through the external `plannotator` CLI.
argument-hint: "[review|annotate <path>|last]"
allowed-tools:
  - Bash
  - Bash(plannotator:*)
metadata:
  version: "0.17.10"
  author: Andy Pai
  license: MIT
  upstream_plugin: https://github.com/backnotprop/plannotator/tree/main/apps/hook
  external_dependency: plannotator
---

# Plannotator

Use this plugin when the user wants a browser-based review or annotation pass instead of plain text feedback.

Source basis: vendored from the upstream Plannotator Claude plugin at `backnotprop/plannotator`, adapted for installation from `abpai/skills`.

## Prerequisite

The Claude plugin package does not bundle the `plannotator` binary. Install it first:

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

For Windows installers, version pinning, or binary verification, use the upstream install docs:
`https://plannotator.ai/docs/getting-started/installation/`

After installing or updating the plugin, restart Claude Code so hooks are reloaded.

## Preferred Surfaces In Claude Code

Use the plugin's slash commands instead of telling the user to add the upstream marketplace:

```text
/plannotator-review [optional PR URL or review target]
/plannotator-annotate path/to/file.md
/plannotator-last
```

Choose the command by intent:

1. `/plannotator-review` for uncommitted changes or a GitHub PR.
2. `/plannotator-annotate <path>` for markdown files or folders the user wants annotated.
3. `/plannotator-last` when the user wants to mark up the assistant's most recent message.

## Hook Behavior

This plugin also installs the upstream Claude hook integration:

1. `EnterPlanMode` triggers `plannotator improve-context`.
2. `ExitPlanMode` triggers `plannotator` for interactive plan approval or requested changes.

Avoid recommending duplicate manual hooks unless the user explicitly wants to bypass the plugin system. Duplicate hook configuration can cause Plannotator to run twice.

## Direct CLI Equivalents

If you need to reason about what the slash commands do, these are the underlying invocations:

```bash
plannotator review
plannotator annotate path/to/file.md
plannotator annotate-last
plannotator improve-context
```

## Gotchas

- This repo packages the Claude plugin only. Do not claim `plannotator` is installable from the Codex marketplace here.
- If the `plannotator` executable is missing, stop and tell the user to install the binary rather than pretending the plugin is broken.
- For remote or devcontainer setups, mention `PLANNOTATOR_REMOTE=1` and `PLANNOTATOR_PORT=<forwarded-port>` when browser opening or port routing matters.
