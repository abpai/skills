---
name: claude
description: Run Claude Code CLI for code analysis and automated edits. Use when users ask to run `claude -p`, continue a prior Claude session, or delegate software engineering work to Claude Code.
---

# Claude Code Skill Guide

## Workflow

1. Confirm task mode:
   - New run: use `claude -p`.
   - Continue prior run: use `claude -c -p` with stdin prompt.
   - Resume specific session: use `claude -r <session-id> -p`.
2. Set defaults unless user overrides:
   - Model: `sonnet` (default).
   - Effort: `high` (default for delegated work).
   - Permission mode: `plan` unless edits are required.
3. Build command with required flags:
   - Always include `-p` (print mode) for non-interactive execution.
   - Always include `--no-session-persistence` unless the user will need to resume the session later.
4. For long or multi-line prompts, write prompt text to a temp file and pass it via command substitution to avoid shell-escaping issues:
   - `cat > /tmp/claude_prompt.txt <<'EOF' ... EOF`
   - `claude -p ... \"$(cat /tmp/claude_prompt.txt)\"`
5. Run command and validate output quality:
   - If exit code is non-zero: handle as failure.
   - If exit code is zero but stdout is empty/whitespace: treat as a soft failure and retry once using the temp-file prompt pattern plus an explicit output contract (for example: "Reply in sections 1..N").
6. Summarize outcome and ask what to do next.
7. After completion, if session persistence was enabled for the run, remind user they can continue with `claude -c -p` or resume a specific session with `claude -r <session-id> -p`.

### Quick Reference

| Use case                       | Permission mode   | Key flags                                                      |
| ------------------------------ | ----------------- | -------------------------------------------------------------- |
| Read-only review or analysis   | `plan`            | `--permission-mode plan --no-session-persistence -p`           |
| Apply local edits              | `acceptEdits`     | `--permission-mode acceptEdits --no-session-persistence -p`    |
| Permit all tool use            | `dontAsk`         | `--permission-mode dontAsk --no-session-persistence -p`        |
| Continue most recent session   | Inherited         | `-c -p`                                                        |
| Resume specific session        | Inherited         | `-r <session-id> -p`                                           |
| Run from another directory     | Match task needs  | `--add-dir <DIR>` plus other flags                             |
| Budget-capped run              | Match task needs  | `--max-budget-usd <amount> --no-session-persistence -p`        |
| Restrict available tools       | Match task needs  | `--allowedTools "Read Grep Glob" --no-session-persistence -p`  |
| Structured JSON output         | Match task needs  | `--output-format json --json-schema '<schema>' --no-session-persistence -p` |
| Run in a worktree              | Match task needs  | `-w --no-session-persistence -p`                               |

## Command Patterns

### New run

```bash
claude -p \
  --model sonnet \
  --effort high \
  --permission-mode plan \
  --no-session-persistence \
  "your prompt here"
```

### New run (robust for long prompts)

```bash
cat > /tmp/claude_prompt.txt <<'EOF'
your long multi-line prompt here
EOF

claude -p \
  --model sonnet \
  --effort high \
  --permission-mode plan \
  --no-session-persistence \
  "$(cat /tmp/claude_prompt.txt)"
```

### New run with edits

```bash
claude -p \
  --model sonnet \
  --effort high \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "your prompt here"
```

### Continue most recent session

```bash
echo "your follow-up prompt" | claude -c -p
```

When continuing, do not add configuration flags unless the user explicitly asks for changes (for example, different model or effort level).

### Resume specific session

```bash
echo "your follow-up prompt" | claude -r <session-id> -p
```

### Run in a worktree

```bash
claude -p -w \
  --model sonnet \
  --effort high \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "your prompt here"
```

### Budget-capped run

```bash
claude -p \
  --max-budget-usd 5.00 \
  --model sonnet \
  --permission-mode acceptEdits \
  --no-session-persistence \
  "your prompt here"
```

### Tool-restricted run

```bash
claude -p \
  --allowedTools "Read Grep Glob Bash" \
  --permission-mode plan \
  --no-session-persistence \
  "your prompt here"
```

### Structured output

```bash
claude -p \
  --output-format json \
  --json-schema '{"type":"object","properties":{"summary":{"type":"string"},"issues":{"type":"array","items":{"type":"string"}}},"required":["summary","issues"]}' \
  --no-session-persistence \
  "your prompt here"
```

## Model Options

| Model      | Best for                                  | Key features                                 |
| ---------- | ----------------------------------------- | -------------------------------------------- |
| `sonnet` ⭐ | Default for most coding tasks             | Best balance of speed and capability         |
| `opus`     | Complex architecture, deep analysis       | Most capable; higher cost and latency        |
| `haiku`    | Fast/cheap tasks, simple queries          | Fastest and cheapest; less capable           |

`sonnet` is the default for software engineering tasks.

### Effort Levels

- `high` - Default for delegated work (deep analysis, thorough implementation)
- `medium` - Standard tasks (feature additions, bug fixes)
- `low` - Simple tasks (quick fixes, formatting, documentation)

## Permission Modes

| Mode              | Description                                        | Equivalent Codex sandbox   |
| ----------------- | -------------------------------------------------- | -------------------------- |
| `plan`            | Read-only; Claude can explore but not edit          | `read-only`                |
| `default`         | Claude asks permission for each tool use            | N/A                        |
| `acceptEdits`     | Auto-approve file edits; ask for Bash               | `workspace-write`          |
| `dontAsk`         | Auto-approve all tool use without confirmation      | `danger-full-access`       |
| `bypassPermissions` | Skip all permission checks (sandboxed envs only) | N/A                        |

## Following Up

- After every run, ask for next steps or clarifications.
- When proposing another run, restate model, effort level, and permission mode.
- For continuation, use `-c -p` with stdin when the earlier run used session persistence.

## Error Handling

- If `claude --version` or `claude -p` exits non-zero, report failure and ask before retrying.
- Ask permission before high-impact flags unless already granted: `--permission-mode dontAsk`, `--dangerously-skip-permissions`.
- If output includes warnings or partial results, summarize and ask how to proceed.
- If `claude -p` exits `0` but returns empty output, rerun once with the robust temp-file prompt pattern and a stricter output instruction; if still empty, report the run as failed/indeterminate.

## CLI Version

Use a current Claude Code version. Check with:

```bash
claude --version
```
