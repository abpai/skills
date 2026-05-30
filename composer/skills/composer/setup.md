# Composer Setup

Verify that this machine can use both Cursor Composer and OpenAI Codex from
headless agent workflows.

## Preflight

Run:

```bash
composer/skills/composer/scripts/cursor-agent-doctor.sh
```

If the repo-local worktree does not contain the `.env` file with
`CURSOR_API_KEY`, pass it explicitly:

```bash
CURSOR_ENV_FILE=/path/to/.env composer/skills/composer/scripts/cursor-agent-doctor.sh
```

For an end-to-end smoke:

```bash
CURSOR_ENV_FILE=/path/to/.env composer/skills/composer/scripts/cursor-agent-doctor.sh --smoke
```

## What Good Looks Like

- `cursor-agent` is installed.
- `CURSOR_API_KEY` is present in the environment or loaded from `.env`.
- `cursor-agent models` succeeds and includes `composer-2.5` or
  `composer-2.5-fast`.
- `codex login status` succeeds when OpenAI/Codex review is part of the loop.
- The optional smoke returns `composer-smoke-ok`.

## Setup Guidance

- Cursor auth can use `CURSOR_API_KEY` or `cursor-agent login`.
- Codex auth can use `codex login`, `codex login --device-auth`,
  `codex login --with-api-key`, or existing cached login.
- Do not paste secrets into chat. Ask the user to place them in `.env`,
  shell env, or their platform credential store.
- If `cursor-agent status` hangs, prefer the API-key path and rely on
  `cursor-agent models` plus the smoke test as the real proof.

## Report

Summarize:

- Cursor CLI version.
- Whether API-key auth was found, without printing the key.
- Whether Composer models are available.
- Whether Codex login is ready.
- Smoke status if run.
- Any exact next setup step if blocked.
