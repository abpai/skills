---
name: codex-exec
description: >
  Run the Codex CLI for non-interactive coding work. Use when users ask to run
  `codex exec`, `codex review`, or `codex exec resume`, continue a prior Codex
  session, or delegate software engineering work to OpenAI Codex from the
  terminal.
argument-hint: "[exec|review|resume] [prompt]"
allowed-tools: Bash(codex *) Bash(git status *) Bash(git rev-parse *)
metadata:
  author: Andy Pai
  version: "1.3"
---

# Codex CLI

Use this skill when you need the local `codex` CLI from a terminal harness.
Bias toward non-interactive runs. Use the interactive Codex UI only when the
user explicitly wants to stay inside it.

## Environment (preflight)

```!
echo "CODEX_EXEC_PREFLIGHT_$(date +%s%N)"
timeout 3 codex --version 2>&1 || echo "codex: not installed"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git status --short 2>/dev/null | head -40
```

The block above runs at skill-load time; treat it as ground truth. If it shows
`codex: not installed`, stop and report the setup issue instead of retrying.
If it shows `not a git repo`, note that `codex review --uncommitted` and
similar git-dependent flows will not work.

## Default Stance

Unless the user asks for something else:

- Use `codex exec` for one-shot work.
- Use `codex review` for code-review requests.
- Use `codex exec resume --last` to continue the most recent saved session.
- Use `gpt-5.4` as the default model.
- Use `medium` reasoning for ordinary work, `high` for harder tasks, and `low` for tiny checks.
- Use `--sandbox read-only` for `codex exec` analysis runs, and use `codex review` for review tasks.
- Expand to `workspace-write` or `--full-auto` only when Codex should edit files.
- Use `--json` or `--output-schema` only when another tool will parse the result.

Do not hide stderr by default, and do not add `--skip-git-repo-check` unless you
are intentionally running outside a Git repo.

For the current flag surface and example command matrix, see
`./references/codex-cli.md`.

## Pick The Run Shape

### One-shot run

Default choice for most delegated work:

```bash
codex exec \
  --model gpt-5.4 \
  --sandbox read-only \
  -c model_reasoning_effort="medium" \
  "Summarize the uncommitted changes"
```

### Code review

Use the dedicated review subcommand instead of hand-rolling a review prompt
through `exec`:

```bash
codex review --uncommitted \
  "Focus on bugs, regressions, and missing tests. Findings first."
```

### Resume the latest session

Use stdin when the follow-up prompt is large or multi-line:

```bash
printf '%s\n' "Continue and focus on the failing tests only" | \
  codex exec resume --last -
```

When resuming, keep prior settings unless the user explicitly wants to change
model, sandbox, or autonomy level.

## Codex-Specific Gotchas

- `codex review` is the default review path when the task is code review.
- `codex exec` reads instructions from stdin when the prompt argument is omitted or set to `-`.
- `codex exec resume --last` is the non-interactive continuation path; do not replace it with the top-level interactive `codex resume` command.
- `--full-auto` is only a convenience alias for editable autonomous runs. It is not appropriate for read-only analysis.
- `--skip-git-repo-check` is a situational escape hatch, not a default.
- `--ephemeral` is useful for disposable runs when session persistence would add noise.

## Structured Output

Use structured output only when another tool needs to consume the result:

```bash
codex exec \
  --model gpt-5.4 \
  --sandbox read-only \
  --output-schema schema.json \
  "Review the current diff"
```

## Troubleshooting

- If the preflight block above showed `codex: not installed`, report a CLI setup issue.
- If `codex exec` or `codex review` exits non-zero, treat the run as failed.
- If a non-interactive run needs too much context, switch from argv text to stdin.
- If the task is review-oriented, use `codex review` before inventing a custom `exec` prompt.
- If a run needs edits, change the sandbox and autonomy deliberately instead of piling on flags by habit.
- If output includes warnings or partial results, summarize what Codex completed and what remains uncertain.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `codex-exec` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **codex-exec** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update codex-exec` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
