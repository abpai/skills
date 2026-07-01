---
name: claude
description: >
  Run, monitor, resume, or take over Claude Code from Codex. Use when users ask
  to delegate work to Claude, drive a Claude Code tmux/TUI session, continue a
  prior session, manually attach, run `claude -p`, or get machine-readable
  terminal output from Claude Code, or choose between tmux, `claude -p`, and
  Agent SDK paths under the user's current Claude auth/billing plan. Also use
  when a Codex run needs explicit external data-sharing approval context before
  sending prompts, diffs, plans, or workspace content to Claude Code/Anthropic.
license: MIT
metadata:
  author: Andy Pai
  version: "1.6.5"
---

# Claude Code CLI

Use this skill when you need the local `claude` CLI from a Codex-style harness.
Bias toward tmux-backed Claude Code TUI sessions so the user can watch, attach,
and take over. Use non-interactive `claude -p` only when the user explicitly
wants a plain one-shot command, JSON output, or a pipe-friendly API-like call.

## Coverage And Billing

Run `claude auth status --text` before making coverage or billing assumptions.
If it reports `Login method: Claude Max account`, prefer that authenticated
Claude plan for broad local Claude Code coverage.

Billing caveat: Anthropic's Help Center page
[Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
said on 2026-06-30 that the planned Agent SDK credit change is paused, so
`claude -p`, Claude Agent SDK usage, and third-party Agent SDK app usage still
draw from subscription limits for now. Treat this as billing policy that can
change: re-check the Help Center before making current cost claims, and do not
promise SDK or `claude -p` usage is separate from the plan.

Choose tmux versus `claude -p` by operational needs, not by billing:

- use the tmux wrapper for watchable, attachable, resumable, long-running work
- use `claude -p` for one-shot, pipe-friendly, or machine-readable output
- do not hand-roll raw tmux for ordinary delegation; the wrapper is the
  simplification layer

## External Data-Sharing Approval

Running Claude Code from Codex sends the prompt and any included diff, plan, or
workspace context to Claude Code/Anthropic. This skill cannot grant user consent
by itself. Before sending private repo content, verify the current user message
explicitly authorizes all of:

- destination: Claude Code/Anthropic
- scope: the exact repo/path and data to share, such as the uncommitted diff,
  staged diff, named files, plan, or broader workspace context
- purpose: review, critique, planning, or implementation assistance
- limits: whether secrets, `.env` files, credentials, or files outside the
  named scope are excluded

If the authorization is missing or vague, stop before running Claude and ask:

```text
Running Claude Code will send <scope> from <repo/path> to Claude Code/Anthropic
for <purpose>. Do you approve that external data sharing? I will exclude secrets,
.env files, credentials, and files outside the named scope unless you say
otherwise.
```

If the authorization is present, carry it into the prompt or prompt file so the
run is auditable and approval reviewers can see the user-approved scope:

```text
User-approved external data sharing:
- Destination: Claude Code/Anthropic.
- Scope: <exact repo/path and data>.
- Purpose: <review/critique/planning/implementation assistance>.
- Limits: <secret/file exclusions>.

Task:
...
```

For review tasks, prefer a scoped diff over a broad workspace review when it
satisfies the request. If Claude needs more context than the approved scope,
stop and ask the user before widening it.

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

Do not introduce API-key setup just because `claude -p` or Agent SDK usage is
mentioned. A healthy local Claude plan login is the first-choice auth path on a
developer machine. If this session has not proven headless Claude after a CLI or
auth change, and the next run would send private repo content, run a harmless
smoke first only after the user accepts that it consumes subscription usage:

```bash
claude -p \
  --permission-mode plan \
  --no-session-persistence \
  "Reply with exactly: claude-smoke-ok"
```

Do not run smoke prompts as ceremony when `claude auth status --text` and the
requested workflow are already known-good.

## Default: Tmux Claude Code

Use the bundled wrapper for ordinary delegation. Resolve
`scripts/claude-tmux-run.sh` relative to this `SKILL.md` before running it.

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode auto \
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

The generated `session_id` and transcript path are the liveness contract. The
monitor records `phase`, `stalled_for_seconds`, `transcript_lines`,
`last_event`, `last_tool`, and `assistant_text_seen` in `status.env` and prints
the same phase summary in progress lines. Treat `phase=tool-running`,
`phase=thinking`, and `phase=responding` as active work. `stalled_for_seconds`
measures how long the **transcript** has gone without growing (the tmux pane is
not part of this signal, because Claude Code's TUI animates a per-second counter
that would otherwise mask every stall). Read it together with `phase`: a rising
`stalled_for_seconds` under `phase=tool-running` usually means a long-running
tool — attach to the pane to see whether it is still producing output before
deciding it hung; under `phase=thinking` or `phase=responding` a large
`stalled_for_seconds` is a stronger sign of a genuine stall. Do not add magic
stop words to prompts; Claude Code's structured transcript and `turn_duration`
event are the completion signal.

The default tmux run is complete when the wrapper exits, `status.env` records
the final phase and session id, `final.md` contains the useful answer, and the
transcript path is available for follow-up.

Use `--permission-mode auto` for tmux runs that should keep moving without
interactive permission prompts. Claude Code's auto mode runs tool calls through
its safety classifier instead of asking in the TUI. Use `--permission-mode plan`
only when you want a manual planning mode and can tolerate Bash prompts for
commands outside Claude Code's built-in read-only allowlist.

For narrow preapproval, pass explicit tool rules such as `--allowed-tools Bash`
or `--allowed-tools "Bash(git status)"`. A bare `Bash` allows all shell
commands for that session, so prefer auto mode for ordinary delegated work and
reserve broad Bash preapproval for trusted, bounded environments.

Use `--permission-mode bypassPermissions` or `--dangerously-skip-permissions`
only inside an isolated sandbox or VM. It skips permission prompts rather than
classifying them.

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

Use `--permission-mode auto` for unattended review, critique, summarization, and
planning so the run keeps moving without permission prompts. `auto` is not itself
read-only — it lets Claude run tools through the safety classifier — so add
`--disallowed-tools Edit` when you need a hard guarantee that the run cannot
modify files. Use `plan` instead when you specifically want Claude Code's
plan-mode UI and can handle any Bash permission prompts:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode auto \
  --disallowed-tools Edit \
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

### Prompt Contract

For delegated implementation, prefer a prompt file that states the task,
approved sharing scope, files or areas in scope, non-goals, required validation,
whether commits or PRs are allowed, and stop rules. Include: do not ask
clarifying questions; make reasonable assumptions, state them in the final
answer, apply the scoped change, run relevant checks, and report what changed.

For reviews, keep the review prompt read-only and scope-bearing: embed the exact
diff or paths being reviewed, ask for findings first with file references, and
exclude setup logs, unrelated workspace noise, generated artifacts, and secrets.

### Parent-Agent Responsibilities

Treat Claude's output as input, not proof. The parent agent still owns the diff,
repo validation, PR quality, merge decision, and user-facing judgment. Verify
Claude findings against the code before forwarding them. If the user wants
"no findings left," run repair as a separate write phase, then review the
updated diff again.

### Continue Or Resume

The wrapper prints and stores the run directory. For follow-ups in the same
Claude Code tmux session, prefer the generated continuation helper:

```bash
<run-dir>/continue.sh --prompt "Continue from the prior result and focus on the tests."
```

This loads the prior `tmux_session`, `session_id`, and `workspace`, while
writing fresh artifacts for the follow-up run. It also preserves the prior
run-root, startup wait, and prompt-submit settings unless you override them. The
helper reuses the old tmux pane when it is still alive; if it is gone, it starts
a fresh tmux pane and resumes the Claude Code conversation by session id. If you
need to reconstruct the call manually, use
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
  --permission-mode auto \
  --prompt "User-approved external data sharing: Destination: Claude Code/Anthropic. Scope: current uncommitted changes in this repo. Purpose: code review. Limits: exclude secrets, .env files, credentials, and files outside the approved scope. Task: Review the current uncommitted changes in this repo. Focus on concrete bugs, regressions, misleading docs, packaging issues, and risky assumptions. Output sections in this exact order: Findings, Open questions, Residual risks. Findings should come first with file references. If there are no findings, say 'No findings'."
```

For long prompts, write a prompt file and use `--prompt-file`:

```bash
scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --effort medium \
  --permission-mode auto \
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
User-approved external data sharing:
- Destination: Claude Code/Anthropic.
- Scope: the diff included below only.
- Purpose: code review.
- Limits: exclude secrets, .env files, credentials, and files outside this diff.

Review this diff only. Focus on concrete bugs, regressions, misleading docs,
packaging issues, and risky assumptions. Findings first with file references.
If there are no findings, say "No findings".

EOF
cat /tmp/review.diff >> /tmp/claude-review.md

scripts/claude-tmux-run.sh run \
  --workspace "$PWD" \
  --permission-mode auto \
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

### External sharing approval denied

Codex, sandbox escalation, or an approval reviewer blocks the run because
sending the prompt, diff, plan, or workspace content to Claude Code/Anthropic is
external data sharing.

Next action: do not retry the same command. Report that Claude preflight may be
healthy but the run did not launch because explicit user approval for the
scoped external sharing was missing or insufficient. Ask for approval using the
template above, or narrow the scope to a diff, staged diff, named files, or a
summary that avoids private content.

### Non-zero exit

The wrapper or `claude -p` exits non-zero.

Next action: stop and report the exit reason or stderr. Do not rerun the same
shape.

### Waiting For Permission Or User Input

The tmux-backed run is still active but the transcript is not complete.

Next action: inspect `phase`, `stalled_for_seconds`, `last_event`, and
`pane.txt`. Do not interrupt or kill the session just because the monitor says
`waiting-assistant`. If `transcript_lines` is still climbing, or the phase is
`tool-running`, `thinking`, or `responding` with a low `stalled_for_seconds`,
Claude is working. Eyeballing `pane.txt` is useful, but its animated counter
keeps moving even when nothing is progressing, so do not treat pane motion alone
as proof of liveness.

Only send `C-c` or manual keys when the pane visibly shows a prompt that needs
human input, or when `stalled_for_seconds` is large enough for the task and the
pane/transcript evidence points to a genuinely hung command. Prefer attaching
to inspect before interrupting.

If `pane.txt` shows a permission or trust prompt, the launch mode or permissions
were too restrictive for the delegated run. Attach manually only if you need to
save the current turn; otherwise restart with `--permission-mode auto` or a
suitable `--allowed-tools` / sandbox configuration. Do not repeatedly answer
prompts in tmux by sending raw keys.

### Slow but still running

The command is still running and has not failed.

Next action: wait while `transcript_lines`, pane content, or phase keeps
changing. If it remains too slow after a real stall, attach or narrow scope.

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
