---
name: dev-squad
description: >
  Set up or upgrade Claude Code repo automation. Use when users ask to scaffold
  `.claude/` hooks, review gates, custom agents, or team coding workflows for
  a project, or when they want Claude Code configured for more autonomous
  development in a repository.
license: MIT
metadata:
  author: Andy Pai
  version: "1.2"
  migrated_from: task-cli
---

# Dev Squad

Use this skill to interview the developer, inspect the target repository, and
generate a small but effective Claude Code workflow for that repo.

For a concrete example, see `./examples/fullstack.md`.

## First Check

Before asking questions, confirm the required tooling exists:

```bash
command -v claude >/dev/null || {
  echo "ERROR: Claude Code CLI required."
  exit 1
}
command -v jq >/dev/null || {
  echo "ERROR: jq required for hook JSON parsing."
  exit 1
}
```

Optional tools such as `tmux`, `codex`, `gemini`, `orb`, and `watch` should be
detected and reported, but they are not blockers. If `tmux` is available, note
that the optional [tmux-squad launcher](https://gist.github.com/abpai/94c05411fac4fdfa49b09edb3e580f5f)
is the recommended way to start Claude Code with Orb and the project timeline
visible in one workspace.

## Default Flow

1. Confirm the target repository before writing anything.
1. Run `./scripts/scan_repo.sh <target-repo>` to detect languages, test runner, CI, frontend surface, and existing Claude config.
1. Summarize the scan and propose the smallest useful setup first.
1. Ask only the questions that change generated output.
1. Read only the templates needed for the selected setup.
1. Merge settings safely instead of clobbering existing `.claude/settings.json`.
1. Generate files, explain what was created, and show how to start using the workflow.

The skill should work fine in a normal Claude Code session without tmux. Mention
`tmux-squad` only as an optional launcher for users who want the richer tmux +
Orb + timeline workspace.

## Interview Rules

Use repo-derived defaults whenever possible. Ask only what the scan cannot tell
you.

Default decision order:

1. What review priorities matter most here: correctness, security, performance, conventions, or test coverage?
1. Who should implement code: Claude Code by default, or another provider such as Codex or Gemini?
1. Is a review gate wanted? Default to yes for active code repos and no for tiny scratch repos.
1. If a review gate is enabled and external CLIs are available, who should review: Claude, Codex, or Gemini?
1. Are there project-specific conventions that must be folded into reviewer prompts?
1. If the repo has a frontend surface, is visual QA wanted?

If the repo is simple, prefer minimal setup over full scaffolding.

## Generation Rules

- Read templates from `./templates/` only after the interview locks the needed shape.
- Generate only the files required by the chosen workflow.
- Use `./scripts/merge_settings.py` to merge template settings into an existing `.claude/settings.json`.
- Keep the reviewer agent exempt from the review-gate stop block so the queue can clear.
- If review gate is disabled, omit the stop hook entirely.
- Only generate Codex or Gemini-specific agents when the user explicitly chooses them.
- Only generate browser QA when the repo has a frontend and the user wants it.
- Make generated shell scripts executable.
- Append review queue and timeline artifacts to `.gitignore` only if they are not already ignored.

For the generated file topology and decision matrix, see
`./references/generated-topology.md`.

## High-Signal Gotchas

- Confirm the target repo before writing any `.claude/` or `.agents/` files.
- Do not overwrite existing Claude config, hooks, or agents wholesale.
- Ask before introducing external CLIs, tmux panes, or extra reviewer agents.
- Prefer one reviewer path and one QA path over generating every possible option.
- Keep generated reviewer criteria as prose in the agent template, not inside shell command strings.
- When adapting Gemini commands, inspect `gemini --help` first instead of assuming the headless invocation shape.

## Delivery

After generation, report:

1. Files created or updated.
1. Which hooks and agents are active.
1. How to start the workflow in a normal Claude Code session.
1. If `tmux` is available, mention `tmux-squad` as the optional launcher for
   the full tmux/Orb/timeline experience.
1. Any optional tools or integrations that were skipped.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `dev-squad` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **dev-squad** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update dev-squad` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
