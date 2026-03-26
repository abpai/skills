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
  version: "1.4"
---

# Claude Code CLI

Use this skill when you need the local `claude` CLI from a Codex-style harness.
Bias toward non-interactive `claude -p` runs. Use the interactive REPL only when
the user explicitly wants to stay inside Claude.

## First Check

Confirm the CLI works before you build a workflow around it:

```bash
claude --version
claude auth status --text
```

If either command fails, stop and report the setup problem instead of retrying
the task.

## Default Stance

Unless the user asks for something else:

- Use `claude -p` for one-shot runs.
- Use `--no-session-persistence` for disposable runs.
- Use `--permission-mode plan` for analysis, review, and read-only exploration.
- Use `--permission-mode acceptEdits` only when Claude should change files.
- Use `sonnet` as the default model alias.
- Use `medium` effort for ordinary work, `high` for harder tasks, `low` for tiny checks.
- Use `--output-format json` only when another tool will parse the result.

Avoid `--dangerously-skip-permissions` unless the user explicitly wants it and
the environment is already safely sandboxed.

## Pick The Run Shape

### One-shot run

Default choice for most delegated work:

```bash
claude -p \
  --model sonnet \
  --effort medium \
  --permission-mode plan \
  --no-session-persistence \
  "Summarize the uncommitted changes"
```

### Continue the latest session

Use when the user wants to keep going with the most recent Claude conversation
in this directory:

```bash
printf '%s\n' "Continue and focus on the test failures only" | claude -c -p
```

### Resume a specific session

Use `-r <session-id> -p` to resume, and add `--fork-session` if you want a new
branch of that conversation instead of reusing the original session.

```bash
printf '%s\n' "Finish the refactor and summarize the remaining risks" | \
  claude -r <session-id> -p
```

## Review Workflow

When the user wants a Claude review of local changes, use one of these two
paths. Do not bounce between several near-identical review commands.

### Default: review the repo changes directly

Use this first for normal "review my changes" requests:

```bash
claude -p \
  --model sonnet \
  --effort medium \
  --permission-mode plan \
  --no-session-persistence \
  "Review the current uncommitted changes in this repo. Focus on concrete bugs, regressions, misleading docs, packaging issues, and risky assumptions. Output sections in this exact order: Findings, Open questions, Residual risks. Findings should come first with file references. If there are no findings, say 'No findings'."
```

Use `high` effort if the diff is large, subtle, or high-risk.

### Narrow scope: review a specific diff

Use this when the repo-wide review is too slow or when you want to isolate a
known set of files:

```bash
git diff --unified=3 -- path/to/file1 path/to/file2 | \
  claude -p \
    --model sonnet \
    --effort medium \
    --permission-mode plan \
    --no-session-persistence \
    "Review this diff only. Focus on concrete bugs, regressions, misleading docs, packaging issues, and risky assumptions. Output sections in this exact order: Findings, Open questions, Residual risks. Findings should come first with file references. If there are no findings, say 'No findings'."
```

### Review rules

- Start with the repo-native review unless you already know the diff must be narrowed.
- If the first repo-native review is merely slow, wait before rerunning.
- If the repo-native review fails, narrow the diff locally instead of rewriting the prompt repeatedly.
- After Claude returns findings, verify exact line references from the local diff before presenting the final review.

## Common Patterns

### Long or multi-line prompt

Prefer stdin over a giant argv string:

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

### Structured output

```bash
claude -p \
  --output-format json \
  --json-schema '{"type":"object","properties":{"summary":{"type":"string"},"issues":{"type":"array","items":{"type":"string"}}},"required":["summary","issues"]}' \
  --no-session-persistence \
  "Review the current diff"
```

Observed locally: `--output-format json` returns a result envelope with fields
such as `result`, `session_id`, `num_turns`, `usage`, and `total_cost_usd`.

### Worktree isolation

```bash
claude -p -w feature-auth \
  --model sonnet \
  --effort high \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "Investigate and fix the auth regression"
```

## Flags That Matter

### Permission modes

- `plan`: review, analysis, read-only exploration
- `acceptEdits`: allow local file changes
- `dontAsk`: broad autonomy only when the user explicitly wants it
- `auto`: use only when the user specifically wants Claude's automatic permission behavior

### Tool controls

Claude exposes three different tool controls:

- `--disallowedTools`: remove a few tools
- `--allowedTools`: auto-approve a safe subset
- `--tools`: replace the available built-in tool set entirely

Prefer them in that order. `--tools` is the sharpest knob and should not be the
default for ordinary harness runs.

```bash
claude -p \
  --disallowedTools "Edit" \
  --permission-mode plan \
  --no-session-persistence \
  "Review this repo for risky shell scripts"
```

### System prompt flags

Prefer `--append-system-prompt`. Use `--system-prompt` only when you truly want
to replace Claude's built-in default behavior.

### Streaming

Use `--output-format stream-json` only for real streaming integrations.

- `stream-json` is an event stream, not a single final blob
- `--include-partial-messages` only works with `stream-json`
- `--verbose` is optional, not required

For most harness work, prefer plain `text` or `json`.

## Settings And Scope

Do not invent shell commands for REPL-only features. For CLI automation, use:

- `--settings <file-or-json>`
- `--setting-sources user,project,local`
- `--add-dir <dir>`

When this harness needs a temporary override, prefer CLI flags over mutating
config files.

Useful non-interactive commands:

```bash
claude --version
claude auth status --text
claude agents
claude doctor
```

## Troubleshooting

- If `claude --version` or `claude auth status --text` fails, report a CLI or auth issue.
- If `claude -p` exits non-zero, treat the run as failed.
- If stdout is empty, retry once with a smaller prompt and a tighter output contract.
- If Claude reports a tool or configuration limit, treat that as a run failure
  and rerun with a narrower diff or simpler prompt.
- If a repo-native review is slow but still running, wait or narrow the diff; do not spam retries.
- If a streaming command fails, fall back to `text` or `json` unless streaming is required.
- If the user asks for unrestricted execution, restate the risk before using `dontAsk` or dangerous permission flags.

## Update Check

On first use in a session, silently check:

1. `https://raw.githubusercontent.com/abpai/skills/main/versions.json`
2. Compare the remote `claude` version to this file's `metadata.version`
3. If remote is newer, pause before the task and ask whether to run:

```bash
npx skills update claude
```

If the fetch fails, skip the check silently.
