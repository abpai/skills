# Composer Setup

Verify that this machine can use Cursor Composer from headless agent workflows.
OpenAI Codex login is optional and only matters when the workflow will also use
Codex for review.

## Preflight

Run:

```bash
composer/skills/composer/scripts/cursor-agent-doctor.sh
```

If the repo-local worktree does not contain the `.env` file with
`CURSOR_API_KEY` and you intentionally want API-key auth, pass it explicitly:

```bash
CURSOR_ENV_FILE=/path/to/cursor-key.env composer/skills/composer/scripts/cursor-agent-doctor.sh --auth api-key
```

For an API-key end-to-end smoke:

```bash
CURSOR_ENV_FILE=/path/to/cursor-key.env composer/skills/composer/scripts/cursor-agent-doctor.sh --auth api-key --smoke
```

Use browser login when the user has already authenticated Cursor locally. The
`--auth login` flag below is a wrapper flag; do **not** pass it to `agent` or
`cursor-agent` directly:

```bash
composer/skills/composer/scripts/cursor-agent-doctor.sh --auth login --smoke
```

Direct Cursor CLI auth is `agent login` / `cursor-agent login`; direct headless
runs use `agent -p ...` / `cursor-agent -p ...`, with optional `--api-key` or
`CURSOR_API_KEY`.

For adversarial review readiness without sending repo content, prefer
`composer-2.5-fast` for the cheap smoke check and skip Codex unless Codex is
part of the workflow:

```bash
composer/skills/composer/scripts/cursor-agent-doctor.sh \
  --skip-codex \
  --smoke \
  --model composer-2.5-fast
```

Use `--model composer-2.5` instead when the review is a strict release gate or
the user asks for the slower path.

If you need wrapper-level proof, run `composer-run.sh review` against an empty
temporary workspace with a harmless prompt before preparing any project diff.

## What Good Looks Like

- `cursor-agent` is installed.
- Cursor auth works through browser login after the login smoke passes, or
  through `CURSOR_API_KEY` when API-key mode is intentional.
- `cursor-agent models` succeeds and includes `composer-2.5` or
  `composer-2.5-fast`.
- `codex login status` succeeds when OpenAI/Codex review is part of the loop.
- The optional smoke returns `composer-smoke-ok`.
- For review readiness, a `composer-2.5-fast` or `composer-2.5` smoke passes
  without sending repo files or diffs.

## Setup Guidance

- Cursor auth can use `CURSOR_API_KEY` or `cursor-agent login`.
- Prefer `--auth login` when browser login is already healthy; a Cursor API key
  is not required for interactive planner-led delegation.
- `--auth` is the Composer wrapper's auth selector. It is not supported by the
  Cursor Agent CLI itself.
- `cursor-agent status` and `cursor-agent models` can be advisory only; trust
  the smoke test when deciding whether login auth is ready for automation.
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
