---
name: claude
description: >
  Run Claude Code from Codex. Use when users ask to delegate work to Claude,
  drive a Claude Code tmux/TUI session, continue or resume a Claude Code
  session, manually take over Claude, run `claude -p`, or get machine-readable
  output from Claude Code in the terminal.
license: MIT
metadata:
  author: Andy Pai
  version: "1.6"
---

# Claude Code CLI

Use this skill when you need the local `claude` CLI from a Codex-style harness.
Bias toward tmux-backed Claude Code TUI sessions so the user can watch, attach,
and take over. Use non-interactive `claude -p` only when the user explicitly
wants a plain one-shot command, JSON output, or a pipe-friendly API-like call.

## First Check

Confirm the CLI is healthy before you build a workflow around it:

```bash
claude --version
claude auth status --text
tmux -V
```

If `claude` or auth fails, stop and report the setup problem. If `tmux` is
missing, use the `claude -p` fallback only if the user accepts losing the TUI
and manual takeover path.

## Default: Tmux Claude Code

Use the bundled wrapper for ordinary delegation. Resolve
`scripts/claude-tmux-run.sh` relative to this `SKILL.md` before running it.

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode plan \
  --effort high \
  --prompt "Review the current changes. Findings first."
```

The wrapper starts or reuses a real tmux session running interactive Claude
Code, pastes the prompt into the TUI, and monitors Claude's transcript for the
completed turn. The prompt is pasted as-is; monitoring uses a transcript
baseline instead of adding marker text to Claude's conversation. It writes
`run.env`, `status.env`, `monitor.sh`, `prompt.txt`, `prompt-to-send.txt`,
`final.md`, `command.txt`, `preflight.log`, `pane.txt`, `continue.sh`,
`submit.sh`, and `resend.sh`.

The monitor has a finite default timeout so schema drift or TUI state cannot
hang Codex forever. Pass `--timeout 0` only for an intentionally unattended
watch, and be ready to attach manually.

If a prompt is pasted but not submitted, run the generated `<run-dir>/submit.sh`
helper. If the local terminal needs a different submit key, pass
`--submit-key C-j` or another tmux key name. If the prompt does not appear at
all after a fresh session starts, run `<run-dir>/resend.sh`.

To let the user take over:

```bash
scripts/claude-tmux-run.sh attach --run-dir <run-dir>
```

Detach without stopping Claude with `Ctrl-b d`.

### Analysis

Use `--permission-mode plan` for read-only review, critique, summarization, and
planning:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode plan \
  --effort medium \
  --prompt "Summarize the uncommitted changes and call out risks."
```

### Edits

Use `--permission-mode auto` or `acceptEdits` only when Claude should make file
changes:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode auto \
  --effort high \
  --prompt "Fix the failing tests. Keep the patch focused."
```

Narrow the working set first if the change is broad or the repo is noisy.
For unattended edit modes, be explicit about whether Claude may commit, push, or
run live side effects; otherwise assume it should only edit and report back.

### Continue Or Resume

The wrapper prints and stores the run directory. For follow-ups in the same
Claude Code tmux session, prefer the generated continuation helper:

```bash
<run-dir>/continue.sh --prompt "Continue from the prior result and focus on the tests."
```

This loads the prior `tmux_session`, `session_id`, and `workspace`, while
writing fresh artifacts for the follow-up run. It also preserves the prior
run-root, startup wait, and prompt-submit settings unless you override them. If
you need to reconstruct the call manually, use
`scripts/claude-tmux-run.sh run --continue-run <run-dir>`.

If the tmux pane is gone, resume the Claude Code conversation into a new tmux
pane:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --resume-session <session-id> \
  --prompt "Pick up where we left off."
```

Use `start` when the user wants an attachable Claude Code pane before giving it
work:

```bash
scripts/claude-tmux-run.sh start \
  --workspace "$PWD" \
  --permission-mode auto \
  --name "repo-review"
```

## Review And Plan Critique

Use the same workflow for code review and implementation-plan critique. Start
broad once, then narrow scope if needed. Avoid repeated retries with slightly
different wording.

### Broad attempt

Use repo-native review for ordinary local-change review:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --effort medium \
  --permission-mode plan \
  --prompt "Review the current uncommitted changes in this repo. Focus on concrete bugs, regressions, misleading docs, packaging issues, and risky assumptions. Output sections in this exact order: Findings, Open questions, Residual risks. Findings should come first with file references. If there are no findings, say 'No findings'."
```

For long prompts, write a prompt file and use `--prompt-file`:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --effort medium \
  --permission-mode plan \
  --prompt-file /tmp/claude_prompt.txt
```

### Narrowing ladder

If scope needs tightening, narrow in this order:

1. `git diff --staged` when the user clearly means staged work
2. `git diff --unified=3 -- <paths...>` when the worktree is noisy or large
3. one file or subsystem at a time if the narrowed diff is still too broad

Example narrowed diff review:

```bash
git diff --unified=3 -- path/to/file1 path/to/file2 > /tmp/review.diff
cat > /tmp/claude-review.md <<'EOF'
Review this diff only. Focus on concrete bugs, regressions, misleading docs,
packaging issues, and risky assumptions. Findings first with file references.
If there are no findings, say "No findings".

EOF
cat /tmp/review.diff >> /tmp/claude-review.md

scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode plan \
  --effort medium \
  --prompt-file /tmp/claude-review.md
```

Repo-native review can inspect unrelated worktree changes. Use staged or
file-scoped diffs when scope matters.

## Non-Interactive Fallback

Use `claude -p` only when tmux is not desired or machine-readable JSON is the
point of the task. Use exactly one prompt source:

- short prompt: pass it as the trailing argument
- long or multi-line prompt: pass it over stdin

Do not mix stdin with a trailing prompt argument. The CLI can merge both inputs.

```bash
claude -p \
  --model sonnet \
  --effort medium \
  --permission-mode plan \
  --no-session-persistence \
  --output-format json \
  "Summarize the current diff"
```

`--output-format json` returns an envelope, not raw model text. The main body is
usually in `result`. Check `subtype` and `errors`, not only `is_error`.

## Hard Rules

Treat every failed or suspicious run as one of these cases, then take the
single next action listed here.

### Preflight failure

`claude --version` or `claude auth status --text` fails.

Next action: stop and report the setup or auth problem.

### Non-zero exit

The wrapper or `claude -p` exits non-zero.

Next action: stop and report the exit reason or stderr. Do not rerun the same
shape.

### Waiting For Permission Or User Input

The tmux-backed run is still active but the transcript is not complete.

Next action: inspect `pane.txt` or attach with `tmux attach -t <session>`. Do
not kill the session just because the monitor is still waiting.

If `pane.txt` shows a trust prompt, permission prompt, or the pasted prompt
still sitting in Claude's input box, attach or run `<run-dir>/submit.sh` in the
existing tmux session. If the prompt is absent, run `<run-dir>/resend.sh`. Do
not restart the run unless the session is unrecoverable.

### Slow but still running

The command is still running and has not failed.

Next action: wait once. If it remains too slow for the task, attach or narrow
scope.

### Empty stdout

The wrapper finishes but `final.md` is empty or not useful.

Next action: inspect `pane.txt`, `preflight.log`, and the transcript path in
`status.env`; then attach if the session is recoverable.

### JSON envelope issue

JSON mode returns an envelope but the useful payload is missing or unusable.

Next action: check `result`, `subtype`, and `errors`. If the envelope still does
not give a usable answer, rerun once with `--output-format text`.

### Scope too broad

Claude is slow, vague, or obviously reviewing the wrong surface.

Next action: switch to the narrowing ladder. Change scope, not wording.

### Tool or configuration limit

Claude reports a tool limit, configuration limit, or similar execution problem.

Next action: simplify the scope or prompt. Do not retry the same broad command
with slightly different phrasing.

### Retry budget

For review and plan critique:

- allow at most one broad attempt
- allow at most one narrowed attempt
- after that, stop and summarize what failed, what was tried, and the next
  safest narrower attempt

## Advanced Knobs

Keep the main workflow simple. Advanced flags drift more often and should be
verified against the local CLI help before first use in a new environment.

Read [references/claude-cli.md](references/claude-cli.md) only when you need:

- tool allow or deny lists
- system prompt control
- `claude -p` streaming output
- built-in Claude `--worktree --tmux`
- worktree mode
- settings overrides
- more detailed JSON behavior notes

## Update Check

On first use in a session, silently check:

1. `https://raw.githubusercontent.com/abpai/skills/main/versions.json`
2. Compare the remote `claude` version to this file's `metadata.version`
3. If remote is newer, pause before the task and ask whether to run:

```bash
npx skills update claude
```

If the fetch fails, skip the check silently.
