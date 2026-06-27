# Composer Setup

Verify that this machine can use Cursor Composer from headless agent workflows.
OpenAI Codex login is optional and only matters when the workflow will also use
Codex for review.

## Auth resolution (do this before the first headless call)

The invoking agent should determine auth before running generate/review:

1. Confirm `agent` (or `cursor-agent`) is installed.
2. Run `agent status --format json` (or `agent status`) without `CURSOR_API_KEY`
   in the environment.
3. If authenticated → browser login is ready; use `agent -p ...` with no key.
4. If not authenticated → check for `CURSOR_API_KEY` (never print it).
5. If neither is available → stop and ask the user to run `agent login` or
   `export CURSOR_API_KEY=...`.

Best pattern: **browser login first, API key fallback, hard stop if neither**.

## Preflight

Run:

```bash
composer/skills/composer/scripts/cursor-agent-doctor.sh
```

Default `--auth auto` follows the login-first fallback above. For API-key-only
automation:

```bash
CURSOR_ENV_FILE=/path/to/cursor-key.env composer/skills/composer/scripts/cursor-agent-doctor.sh --auth api-key
```

For an API-key end-to-end smoke:

```bash
CURSOR_ENV_FILE=/path/to/cursor-key.env composer/skills/composer/scripts/cursor-agent-doctor.sh --auth api-key --smoke
```

For browser-login-only proof:

```bash
composer/skills/composer/scripts/cursor-agent-doctor.sh --auth login --smoke
```

Direct Cursor CLI auth is `agent login`. Do **not** pass `--auth` to `agent`;
that flag belongs to the Composer wrapper only. Headless runs use `agent -p ...`;
the CLI reads `CURSOR_API_KEY` from the environment automatically — do not
"log in" with the key.

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

- `agent` or `cursor-agent` is installed.
- Cursor auth works through browser login after the smoke passes, or through
  `CURSOR_API_KEY` when API-key mode is intentional.
- `agent models` succeeds and includes `composer-2.5` or `composer-2.5-fast`.
- `codex login status` succeeds when OpenAI/Codex review is part of the loop.
- The smoke returns `composer-smoke-ok`.
- For review readiness, a `composer-2.5-fast` or `composer-2.5` smoke passes
  without sending repo files or diffs.

## Setup Guidance

- Cursor auth can use browser login (`agent login`) or `CURSOR_API_KEY`.
- Prefer browser login on local dev machines; prefer `CURSOR_API_KEY` for CI and
  unattended automation.
- `--auth` is the Composer wrapper's auth selector, not a Cursor CLI flag.
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
