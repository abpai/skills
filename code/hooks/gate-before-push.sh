#!/bin/sh
# gate-before-push.sh — code plugin PreToolUse(Bash) push gate.
#
# =============================================================================
# ARM / SEAL / DISARM LIFECYCLE
# =============================================================================
# This hook is ALWAYS registered (via code/hooks/hooks.json) but is INERT by
# default. It only "bites" when /code:prepare-pr has ARMED the gate for the
# current repo. Lifecycle:
#
#   1. ARM   — prepare-pr Phase 1 writes the arm marker
#                ${CLAUDE_PLUGIN_DATA}/prepare-pr/armed/<repo-id>.armed
#              keyed by repo (repo-id = sha256(toplevel abs path)[:16]). While
#              this marker exists, the gate is active for that repo only.
#
#   2. SEAL  — prepare-pr Phase 5 runs `finish-lane.ts --seal` AFTER quality
#              gates + source-grounded QA + independent review pass. --seal
#              writes the per-branch sentinel
#                .workflow/finish-lane/seal/<branch-slug>.sealed
#              stamping the current HEAD sha + scope_hash. The seal is FRESH
#              only while head == current HEAD AND scope_hash == freshly
#              recomputed scope hash. Any new commit, staged change, unstaged
#              edit, or new untracked file flips scope_hash and re-blocks push.
#
#   3. DISARM — prepare-pr Phase 5 deletes the arm marker after a successful
#              push / PR-create. The gate goes inert again.
#
# So the gate enforces BRIGHT LINE 1 ("gate before push"): while armed, it
# blocks `git push`, `gh pr create`, and `gh pr edit ... --body/--body-file`
# unless a fresh seal exists for the current branch.
#
# SAFETY: This is an always-registered global hook. It must NEVER crash the
# user's shell or block unrelated work. Every failure path (no jq, not a git
# repo, missing markers, unparseable input) falls through to ALLOW (exit 0 with
# no decision). It only ever emits a deny for the narrow gated+armed+unsealed
# case.
# =============================================================================

# --- helpers ---------------------------------------------------------------

# Allow with no decision (normal permission flow). Used for every non-gated /
# inert / error path so the hook is invisible unless it must block.
allow() { exit 0; }

# Deterministic sha256 of stdin -> hex (no filename), portable across
# macOS (shasum) and Linux (sha256sum). Echo empty on failure.
sha256_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum 2>/dev/null | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 2>/dev/null | awk '{print $1}'
  else
    echo ""
  fi
}

# --- 0. preconditions ------------------------------------------------------

# jq is required to read the event. If it's missing, we cannot safely inspect
# the command, so fail OPEN (allow) rather than break the shell.
command -v jq >/dev/null 2>&1 || allow

# Read the whole PreToolUse event from stdin.
INPUT=$(cat 2>/dev/null) || allow
[ -n "$INPUT" ] || allow

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

# Only Bash tool calls carry a shell command we can gate on.
[ "$TOOL_NAME" = "Bash" ] || allow
[ -n "$CMD" ] || allow
[ -n "$CWD" ] || CWD=$(pwd 2>/dev/null)

# --- 1. resolve repo -------------------------------------------------------

# Resolve the git toplevel from the event's cwd. Not a git repo -> inert.
TOPLEVEL=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null) || allow
[ -n "$TOPLEVEL" ] || allow

# --- 2. armed check (the inert-by-default switch) --------------------------

# repo-id = sha256(absolute toplevel path)[:16]. Keyed per repo so the gate
# only bites in the repo where prepare-pr is running.
REPO_ID=$(printf '%s' "$TOPLEVEL" | sha256_stdin | cut -c1-16)
[ -n "$REPO_ID" ] || allow

# ${CLAUDE_PLUGIN_DATA} is plugin-owned persistent state. If unset (hook run
# outside the plugin runtime), there is no arm marker -> inert.
[ -n "$CLAUDE_PLUGIN_DATA" ] || allow
ARM_MARKER="$CLAUDE_PLUGIN_DATA/prepare-pr/armed/$REPO_ID.armed"
[ -f "$ARM_MARKER" ] || allow   # NO-OP: not armed for this repo.

# --- 3. is this a gated terminal action? -----------------------------------

# Gated actions are the terminal "share" steps: pushing, or creating/editing a
# PR body. Everything else (commit, add, validation, status, etc.) is allowed
# even while armed. Use word-boundary matching to avoid substring false
# positives (e.g. a branch literally named "push", or the word in a comment).
#
# Matched:
#   git push ...                (incl. `git -C dir push`, `git push --dry-run`)
#   gh pr create ...
#   gh pr edit ... --body / --body-file ...
#
# We intentionally still block `git push --dry-run` while armed+unsealed: it is
# rare in this workflow and blocking it is the safe default (the contract says
# "still block to be safe").
GATED=0

# A command-position prefix: start-of-string, or immediately after a shell
# separator (';', '&&', '||', '|', '(', '{', '&', newline). Any number of leading
# inline assignments (`FOO=bar git push`) and env/sudo-style wrappers
# (`env FOO=bar`, `sudo -n`, `command`, `nice`) may sit in between so a leading
# wrapper or env-var assignment doesn't smuggle git/gh out of command position.
# Kept as a reusable fragment so both the git and gh matchers anchor identically.
#
# NOTE: these matchers require the binary to be in COMMAND POSITION — so
# `echo git push` and a trailing "# ready to push" comment do NOT match, but
# `git push`, `git -C dir push`, `sudo git push`, `FOO=bar git push`,
# `GH_TOKEN=x gh pr create`, and `foo && git push` do.
CMDPOS='(^|[;&|({]|&&|\|\|)[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|#]*[[:space:]]+)|((env|sudo|command|nice|nohup|time)[[:space:]]+([-][^[:space:];&|#]*[[:space:]]+)*([A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|#]*[[:space:]]+)*))*'

# A terminator after the gated verb: whitespace, end-of-string, or a shell
# separator/redirect/grouping char (';', '&', '|', ')', '}', '<', '>'). Matching
# these means `git push;`, `git push && ...`, `git push|tee`, and `{ git push; }`
# still gate — without it a trailing separator would smuggle the verb past the
# boundary. A bare '-' is deliberately excluded so `git push-foo` isn't matched.
TERM='([[:space:];&|)}<>]|$)'

# git ... push  (git in command position, push as a later token in the SAME
# invocation: disallow shell separators and '#' comments between git and push so
# a trailing "# ready to push" comment can't smuggle a match. The optional
# middle tokens cover global options like `git -C dir`.)
if printf '%s' "$CMD" | grep -Eq "${CMDPOS}git([[:space:]]+[^|;&#]*)?[[:space:]]+push${TERM}"; then
  GATED=1
fi

# gh ... pr create  (gh in command position; tolerate global options such as
# `-R owner/repo` / `--repo owner/repo` between `gh` and `pr`. Disallow shell
# separators and '#' comments between the tokens so comments can't smuggle a
# match.)
if printf '%s' "$CMD" | grep -Eq "${CMDPOS}gh([[:space:]]+[^|;&#]*)?[[:space:]]+pr([[:space:]]+[^|;&#]*)?[[:space:]]+create${TERM}"; then
  GATED=1
fi

# gh ... pr edit ... --body / --body-file  (same global-flag tolerance as create)
if printf '%s' "$CMD" | grep -Eq "${CMDPOS}gh([[:space:]]+[^|;&#]*)?[[:space:]]+pr([[:space:]]+[^|;&#]*)?[[:space:]]+edit${TERM}"; then
  if printf '%s' "$CMD" | grep -Eq '(^|[[:space:]])--body(-file)?([[:space:]]|=|$)'; then
    GATED=1
  fi
fi

[ "$GATED" -eq 1 ] || allow   # Armed but this is not a terminal action.

# --- 4. seal freshness -----------------------------------------------------

# Per-branch sentinel inside the target working tree. branch-slug = branch name
# with '/' and unsafe chars replaced by '-'.
BRANCH=$(git -C "$TOPLEVEL" rev-parse --abbrev-ref HEAD 2>/dev/null)
# printf '%s' (no newline) so the trailing newline doesn't become a '-' in the
# slug. branch-slug = branch name with '/' and other unsafe chars -> '-'.
BRANCH_SLUG=$(printf '%s' "$BRANCH" | tr -C 'A-Za-z0-9._-' '-')
SENTINEL="$TOPLEVEL/.workflow/finish-lane/seal/$BRANCH_SLUG.sealed"

# No sentinel at all -> not sealed -> BLOCK.
if [ -f "$SENTINEL" ]; then
  STORED_HEAD=$(jq -r '.head // empty' "$SENTINEL" 2>/dev/null)
  STORED_SCOPE=$(jq -r '.scope_hash // empty' "$SENTINEL" 2>/dev/null)
  STORED_BASE=$(jq -r '.base // empty' "$SENTINEL" 2>/dev/null)

  CUR_HEAD=$(git -C "$TOPLEVEL" rev-parse HEAD 2>/dev/null)

  # Recompute scope_hash exactly as finish-lane.ts --seal does, so any new
  # commit / staged / unstaged / untracked change invalidates the seal:
  #   sha256( <base>...HEAD committed diff
  #           + uncommitted (unstaged) diff
  #           + staged diff
  #           + sorted untracked file list )
  # The base ref is read from the sentinel (the base used at seal time); if the
  # sentinel lacks one we fall back to HEAD (diff portion empty, but the
  # uncommitted/staged/untracked portions still detect changes).
  SCOPE_BASE="$STORED_BASE"
  [ -n "$SCOPE_BASE" ] || SCOPE_BASE="HEAD"

  # The .workflow/ tree (the seal sentinel + changed-files.txt) is ephemeral
  # workflow state, not PR scope. It MUST be excluded from the scope hash —
  # otherwise the act of writing the sentinel adds a new untracked file that
  # changes the hash and the seal instantly invalidates itself (regardless of
  # whether the consuming repo has gitignored .workflow/ yet). finish-lane.ts
  # --seal excludes it the same way.
  CUR_SCOPE=$(
    {
      git -C "$TOPLEVEL" diff "$SCOPE_BASE"...HEAD 2>/dev/null
      git -C "$TOPLEVEL" diff 2>/dev/null
      git -C "$TOPLEVEL" diff --cached 2>/dev/null
      git -C "$TOPLEVEL" ls-files --others --exclude-standard 2>/dev/null \
        | grep -v '^\.workflow/' | LC_ALL=C sort
    } | sha256_stdin
  )

  # Fresh ONLY when head matches current HEAD AND scope_hash matches the freshly
  # recomputed scope. Both must be non-empty to count as a valid seal.
  if [ -n "$STORED_HEAD" ] && [ "$STORED_HEAD" = "$CUR_HEAD" ] && \
     [ -n "$STORED_SCOPE" ] && [ "$STORED_SCOPE" = "$CUR_SCOPE" ]; then
    allow   # Fresh seal — push/PR action is gated-on-green and permitted.
  fi
fi

# --- 5. BLOCK --------------------------------------------------------------

# JSON deny carries the actionable reason to the model (preferred over exit 2).
REASON="prepare-pr gate: run the finish-lane quality gates + source-grounded QA + independent review, then seal with \`finish-lane.ts --seal\`, before pushing or opening/editing the PR body. No fresh gates-sealed sentinel for this branch (new commits/changes since seal also invalidate it)."

jq -n --arg reason "$REASON" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
exit 0
