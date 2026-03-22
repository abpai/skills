---
name: claude
description: >
  Run Claude Code CLI for code analysis and automated edits. Use when users ask
  to run `claude -p`, continue or resume a Claude Code session, delegate a
  coding task to Claude, or get machine-readable output from Claude Code in the
  terminal.
license: MIT
metadata:
  author: Andy Pai
  version: "1.2"
---

# Claude Code CLI

Use this skill when you need the local `claude` CLI, especially from a Codex-style
terminal harness where non-interactive runs, safe permissions, and structured
output matter more than the interactive REPL.

This skill is intentionally biased toward `claude -p` workflows. Prefer interactive
Claude only when the user explicitly wants to stay inside Claude itself.

## First Check

Before relying on CLI behavior, confirm the installed version and current auth state:

```bash
claude --version
claude auth status --text
```

If auth is missing or broken, stop and report that before proposing retries.

## Codex Harness Defaults

For this harness, start with these defaults unless the user asks for something else:

- Use `-p` / `--print` for almost all delegated runs.
- Use `--no-session-persistence` for one-shot tasks.
- Use `--permission-mode plan` for read-only analysis and review.
- Use `--permission-mode acceptEdits` only when Claude should modify local files.
- Use `--output-format json` when you need machine-readable output or reliable post-processing.
- Use `sonnet` as the default model alias.
- Use `high` effort for real delegated work; `medium` for ordinary tasks; `low` for simple checks.

Avoid `--dangerously-skip-permissions` unless the user explicitly wants it and the
environment is already safely sandboxed.

## Workflow

1. Choose the session pattern:
   - New one-shot run: `claude -p`
   - Continue the most recent session in this directory: `claude -c -p`
   - Resume a specific session: `claude -r <session-id> -p`
   - Resume but branch into a new session: add `--fork-session`
2. Pick the permission mode:
   - `plan` for analysis, review, and read-only exploration
   - `acceptEdits` for local edits
   - `dontAsk` only when broad tool autonomy is explicitly intended
   - `auto` only when the user specifically wants Claude's automatic permission behavior
3. Decide whether persistence is useful:
   - Add `--no-session-persistence` for disposable one-shot runs
   - Omit it only when follow-up turns or future resume support are desirable
4. Add structure and limits when helpful:
   - `--output-format json` for machine-readable results
   - `--json-schema ...` for validated structured output
   - `--max-turns N` to cap agentic loops
   - `--max-budget-usd X` to bound spend in print mode
5. Run the command.
6. Validate the result:
   - non-zero exit code = failure
   - empty stdout = soft failure; retry once with a tighter prompt and explicit output contract
7. Summarize the useful output for the user and state what flags mattered.

## Tool Control

Claude has three related knobs that do different things:

- `--tools`: restrict which built-in tools exist at all
- `--allowedTools`: tools that may run without permission prompts
- `--disallowedTools`: tools removed from Claude's context and blocked from use

Use them in this order:

1. `--disallowedTools` when you want to remove a few dangerous tools
2. `--allowedTools` when you want to auto-approve a safe subset
3. `--tools` only when you need a hard built-in tool restriction and are willing
   to test the exact behavior on the installed CLI first

Observed locally: aggressive `--tools` restrictions can behave worse than a
lighter `--allowedTools` / `--disallowedTools` combination, so do not treat
`--tools` as the default choice for ordinary harness runs.

Examples:

```bash
# Keep the full toolset, but block editing
claude -p \
  --disallowedTools "Edit" \
  --permission-mode plan \
  --no-session-persistence \
  "Review this repo for risky shell scripts"

# Keep normal tools, but auto-allow a subset
claude -p \
  --allowedTools "Read Grep Glob Bash(git status) Bash(git diff *)" \
  --permission-mode plan \
  --no-session-persistence \
  "Summarize the uncommitted changes"
```

## Prompt Injection and System Prompt Flags

Most of the time, prefer appending instructions instead of replacing Claude's
built-in system prompt.

- Prefer `--append-system-prompt` or `--append-system-prompt-file`
- Use `--system-prompt` or `--system-prompt-file` only when you truly want to replace the default behavior

This matches Anthropic's docs: append preserves Claude Code's built-in capabilities,
while replacement is for full override scenarios.

## Command Patterns

### One-shot review

```bash
claude -p \
  --model sonnet \
  --effort high \
  --permission-mode plan \
  --no-session-persistence \
  --output-format json \
  "Review the current diff and return findings only"
```

### Long or multi-line prompt

Prefer stdin over argv when the prompt is large.

```bash
cat > /tmp/claude_prompt.txt <<'EOF'
Review this repository change.

Output sections:
1. Findings
2. Open questions
3. Suggested fixes
EOF

claude -p \
  --model sonnet \
  --effort high \
  --permission-mode plan \
  --no-session-persistence \
  < /tmp/claude_prompt.txt
```

### Local edits

```bash
claude -p \
  --model sonnet \
  --effort high \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "Fix the failing tests in the current repo"
```

### Continue the most recent session

```bash
printf '%s\n' "Continue and focus on the test failures only" | claude -c -p
```

When continuing or resuming, do not restate model/effort/settings unless you
intend to override them.

### Resume a specific session

```bash
printf '%s\n' "Finish the refactor and summarize the remaining risks" | \
  claude -r <session-id> -p
```

### Resume but branch into a new session

```bash
printf '%s\n' "Take a different approach that avoids database changes" | \
  claude -r <session-id> -p --fork-session
```

### Worktree isolation

```bash
claude -p -w feature-auth \
  --model sonnet \
  --effort high \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "Investigate and fix the auth regression"
```

### Structured output

```bash
claude -p \
  --output-format json \
  --json-schema '{"type":"object","properties":{"summary":{"type":"string"},"issues":{"type":"array","items":{"type":"string"}}},"required":["summary","issues"]}' \
  --no-session-persistence \
  "Review the current diff"
```

Observed locally: `--output-format json` returns a result envelope with fields
like `result`, `session_id`, `num_turns`, `usage`, and `total_cost_usd`, which
is useful for automation and logging.

### Piped context

Claude can consume stdin plus a query:

```bash
cat logs.txt | claude -p "Summarize the root cause in one paragraph"
```

## Streaming Mode

Use stream JSON only for advanced integrations. It is stricter than plain print mode.

- `--output-format stream-json` is for event streams, not a single final blob
- `--include-partial-messages` only works with `--output-format stream-json`
- add `--verbose` only when you want extra progress/detail during the run

Unless you are building a streaming integration, prefer:

- `--output-format text` for human-readable output
- `--output-format json` for machine-readable output

## Settings and Scope

Do not invent a `claude config list` workflow. The interactive `/config` UI exists
inside the REPL, but CLI automation should use:

- `--settings <file-or-json>`
- `--setting-sources user,project,local`
- `--add-dir <dir>` for extra workspace access

Anthropic's settings docs say precedence is:

1. Managed
2. Command-line arguments
3. Local
4. Project
5. User

So when this harness needs a temporary override, prefer CLI flags over mutating
config files.

## Useful Non-Interactive Commands

```bash
claude --version
claude auth status --text
claude agents
claude doctor
```

Remember that some REPL slash commands, like `/config`, are not standalone shell
subcommands.

## Model and Effort Notes

- `sonnet` is the default model alias for most coding work
- `opus` is for deeper analysis when the user wants to spend more
- `haiku` is for speed-sensitive lightweight tasks
- `max` effort is only available where the installed Claude version/model supports it; the docs currently note Opus 4.6 for `max`

Use aliases like `sonnet` unless the user explicitly wants a pinned full model name.

## Error Handling

- If `claude --version` or `claude auth status --text` fails, report that the CLI/auth setup is broken
- If `claude -p` exits non-zero, treat the run as failed
- If stdout is empty, retry once with:
  - a smaller prompt
  - explicit output instructions
  - `--output-format json` when parsing matters
- If a streaming command errors, fall back to plain `json` or `text` unless streaming is required
- If the user asks for unrestricted execution, restate the risk before using `dontAsk` or dangerous permission flags

## Update Check

On first use in a session, silently check:

1. `https://raw.githubusercontent.com/abpai/skills/main/versions.json`
2. Compare the remote `claude` version to this file's `metadata.version`
3. If remote is newer, pause before the task and ask whether to run:

```bash
npx skills update claude
```

If the fetch fails, skip the check silently.
