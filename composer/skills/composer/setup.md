# Composer Setup

Verify that this machine can use Cursor Composer from headless agent workflows.
OpenAI Codex login is optional and only matters when the workflow will also use
Codex for review.

## Auth resolution

`cursor-agent-doctor.sh` resolves auth via `--auth auto` — browser login →
`CURSOR_API_KEY` → hard stop, the same rule SKILL.md states for direct
`agent -p` calls. Run it with `CURSOR_API_KEY` unset to prove the browser-login
path, or `--auth api-key` (with `CURSOR_ENV_FILE`/`--env-file`) to prove the key
path. Never print the key; relay any hard stop to the user.

## Preflight

The commands below use the bare command name, which works when the plugin is
installed (its `bin/` is on `PATH`). From the source checkout, prefix with the
path: `composer/bin/cursor-agent-doctor.sh`.

Run:

```bash
cursor-agent-doctor.sh
```

Default `--auth auto` follows the login-first fallback above. For API-key-only
automation:

```bash
CURSOR_ENV_FILE=/path/to/cursor-key.env cursor-agent-doctor.sh --auth api-key
```

For an API-key end-to-end smoke:

```bash
CURSOR_ENV_FILE=/path/to/cursor-key.env cursor-agent-doctor.sh --auth api-key --smoke
```

For browser-login-only proof:

```bash
cursor-agent-doctor.sh --auth login --smoke
```

For adversarial review readiness without sending repo content, prefer
`composer-2.5-fast` for the cheap smoke check and skip Codex unless Codex is
part of the workflow:

```bash
cursor-agent-doctor.sh \
  --skip-codex \
  --smoke \
  --model composer-2.5-fast
```

Use `--model composer-2.5` instead when the review is a strict release gate or
the user asks for the slower path.

If you need wrapper-level proof, run `composer-run.sh review` against an empty
temporary workspace with a harmless prompt before preparing any project diff.

## What Good Looks Like

- `agent` or `cursor-agent` is installed.
- Cursor auth works through browser login after the smoke passes, or through
  `CURSOR_API_KEY` when API-key mode is intentional.
- `agent models` succeeds and includes `composer-2.5` or `composer-2.5-fast`.
- `codex login status` succeeds when OpenAI/Codex review is part of the loop.
- The smoke returns `composer-smoke-ok`.
- For review readiness, a `composer-2.5-fast` or `composer-2.5` smoke passes
  without sending repo files or diffs.

## Setup Guidance

- Prefer browser login on local dev machines; prefer `CURSOR_API_KEY` for CI and
  unattended automation.
- `agent status` is advisory; trust the doctor smoke when deciding whether
  headless automation is ready.
- Codex auth can use `codex login`, `codex login --device-auth`,
  `codex login --with-api-key`, or existing cached login.
- Do not paste secrets into chat. Ask the user to place them in shell env or a
  dedicated key file referenced by `CURSOR_ENV_FILE` / `--env-file`.

## Report

Summarize:

- Cursor CLI binary and version.
- Auth path used (browser login or API key present) without printing the key.
- Whether Composer models are available.
- Whether Codex login is ready.
- Smoke status if run.
- Any exact next setup step if blocked.
