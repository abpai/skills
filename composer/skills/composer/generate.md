# Composer Generate

Delegate implementation to Cursor Composer while the parent agent remains the
planner, reviewer, and release coordinator.

## Workflow

1. Confirm there is a concrete implementation brief. If the user gave only a
   vague request, write a short plan first and keep scope narrow.
2. Resolve Cursor auth before the first headless call (see `setup.md`):
   `agent status --format json` → browser login if authenticated → else
   `CURSOR_API_KEY` → else stop and ask the user to log in or provide a key.
   Run `composer/skills/composer/scripts/cursor-agent-doctor.sh --smoke` when
   this session has not already proved headless readiness.
3. Create or choose an isolated branch/worktree before handing work to
   Composer. Prefer one coherent task per branch.
4. Write a prompt file that includes the exact task, files/areas in scope,
   validation expectations, commit/PR expectations, and explicit stop rules.
   Include a behavioral rule: do not ask clarifying questions; make reasonable
   assumptions, state them in the final answer, apply changes, run relevant
   checks, and report what changed.
5. Run Composer through the wrapper (default `--auth auto` = login first, key
   fallback):

```bash
composer/skills/composer/scripts/composer-run.sh generate \
  --model composer-2.5-fast \
  --output-format stream-json \
  --prompt-file /path/to/prompt.md \
  --workspace /path/to/worktree
```

Use `--model composer-2.5` for slower/careful execution. Use `--worktree NAME`
and `--worktree-base REF` only when you want Cursor Agent to create its own
worktree under `~/.cursor/worktrees`.

The wrapper uses Cursor's headless CLI (`agent -p`), not the TypeScript SDK.
Generate runs default to `--force --trust --approve-mcps` (Run Everything
equivalent). Use `--no-force` when the user only wants proposed changes, not
applied edits. Use `--no-approve-mcps` when MCP auto-approval is not wanted.

Direct headless flags are things like `-p`/`--print`, `--force`, `--trust`,
`--approve-mcps`, `--workspace`, `--model`, and `--output-format`. Do not pass
`--auth` to `agent`; it is wrapper-only.

Only set `CURSOR_ENV_FILE` or `--env-file` when intentionally supplying a
Cursor API-key file. If browser login is healthy, do not hunt unrelated project
`.env` files for keys.

6. Inspect Composer's changes yourself in the workspace Composer actually used:
   `git status`, `git diff`, tests, and the repo's existing validation gates.
   If you used `--worktree NAME`, do not inspect only the original checkout;
   Cursor writes under `~/.cursor/worktrees/<repo>/<name>` (or a generated
   sibling when no name was supplied), so run `git -C <cursor-worktree> status`,
   `git -C <cursor-worktree> diff`, and validation there.
7. If Composer left findings or partial work, either repair directly or run a
   focused follow-up Composer prompt in the same branch.
8. Open a draft PR only when the user asked for PR output or the brief calls
   for branch/PR delivery.

## Prompt Contract

Composer implementation prompts should say:

- What to build or fix.
- Why it matters.
- Non-goals and files/areas to avoid.
- Required validation commands.
- Whether to commit, push, or only leave a diff.
- That secrets and `.env` files must not be read aloud, committed, or logged.
- That unrelated cleanup belongs in a follow-up note, not the patch.
- Do not ask the user for clarification; make reasonable assumptions and proceed.

## Parent-Agent Responsibilities

- Do not trust Composer's summary without reading the diff.
- Do not merge multiple unrelated Composer branches into one PR.
- Re-run the important checks yourself before opening or merging a PR.
- Keep PR descriptions behavior-led: what changed, why it matters, how it was
  verified.

## Output

Report:

- Branch/worktree used.
- Auth path (browser login or API key present — never the key itself).
- Model used.
- Composer result summary.
- Files changed.
- Validation run and outcomes.
- PR URL when opened.
- Any residual risks or follow-up tasks.
