#!/usr/bin/env bash
# test-gate-before-push.sh — table-driven test for the code plugin's
# PreToolUse(Bash) push gate (code/hooks/gate-before-push.sh).
#
# It ARMS a temp per-repo marker (repo-id = first 16 hex of sha256 of the repo
# toplevel absolute path, exactly as the hook computes it), then pipes synthetic
# PreToolUse JSON events into the hook and asserts ALLOW (exit 0, no deny JSON)
# vs DENY (permissionDecision == "deny"). There is intentionally NO seal
# sentinel, so every gated command is armed+unsealed and must DENY.
#
# Portable /bin/sh + jq style, matching the hook and scripts/test-wrapper-parity.sh.
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT_DIR/code/hooks/gate-before-push.sh"

command -v jq >/dev/null 2>&1 || { echo "[SKIP] jq not available" >&2; exit 0; }
[ -f "$HOOK" ] || { echo "[FAIL] hook not found: $HOOK" >&2; exit 1; }

# sha256 of stdin -> hex, matching the hook's sha256_stdin helper.
sha256_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum 2>/dev/null | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 2>/dev/null | awk '{print $1}'
  else
    echo ""
  fi
}

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gate-before-push-test.XXXXXX")"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# A real git repo to gate against (self-contained temp repo so the test never
# depends on the state of the checkout it runs in).
REPO="$TMP_DIR/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.email "gate-test@example.test"
git -C "$REPO" config user.name "Gate Test"
TOPLEVEL="$(git -C "$REPO" rev-parse --show-toplevel)"

# Arm the gate: write the per-repo marker under a temp CLAUDE_PLUGIN_DATA, keyed
# by repo-id = sha256(toplevel)[:16]. No seal sentinel is created, so the branch
# is armed + unsealed and gated commands must DENY.
export CLAUDE_PLUGIN_DATA="$TMP_DIR/plugin-data"
REPO_ID="$(printf '%s' "$TOPLEVEL" | sha256_stdin | cut -c1-16)"
[ -n "$REPO_ID" ] || { echo "[FAIL] could not compute repo-id" >&2; exit 1; }
mkdir -p "$CLAUDE_PLUGIN_DATA/prepare-pr/armed"
: > "$CLAUDE_PLUGIN_DATA/prepare-pr/armed/$REPO_ID.armed"

FAILED=0

# run_case <expect: allow|deny> <command>
# Builds a PreToolUse event for the given Bash command and runs the hook.
run_case() {
  expect="$1"
  cmd="$2"

  event="$(jq -n --arg cmd "$cmd" --arg cwd "$REPO" '{
    tool_name: "Bash",
    tool_input: { command: $cmd },
    cwd: $cwd
  }')"

  out="$(printf '%s' "$event" | sh "$HOOK" 2>/dev/null)"
  rc=$?

  decision=""
  if [ -n "$out" ]; then
    decision="$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)"
  fi

  if [ "$expect" = "deny" ]; then
    if [ "$rc" -eq 0 ] && [ "$decision" = "deny" ]; then
      echo "[OK]   DENY  : $cmd"
    else
      echo "[FAIL] DENY  : $cmd (rc=$rc decision='${decision:-<none>}')"
      FAILED=1
    fi
  else
    # allow: hook exits 0 and emits no deny decision.
    if [ "$rc" -eq 0 ] && [ "$decision" != "deny" ]; then
      echo "[OK]   ALLOW : $cmd"
    else
      echo "[FAIL] ALLOW : $cmd (rc=$rc decision='${decision:-<none>}')"
      FAILED=1
    fi
  fi
}

# --- DENY: gated terminal actions while armed + unsealed --------------------
run_case deny 'git push'
run_case deny 'git -C dir push'
run_case deny 'git push --dry-run'
run_case deny 'gh pr create'
run_case deny 'gh -R owner/repo pr create'
run_case deny 'gh --repo owner/repo pr create'
run_case deny 'gh pr create --repo owner/repo'
run_case deny 'gh pr edit 5 --body-file x'
# command-position prefixes must not smuggle git/gh out of command position.
run_case deny 'FOO=bar git push'
run_case deny 'GH_TOKEN=x gh pr create'
run_case deny 'sudo -n git push'
run_case deny '{ git push; }'
run_case deny 'cd repo && git push'
# a shell terminator right after the verb must still gate.
run_case deny 'git push;'
run_case deny 'git push && x'
run_case deny 'git push|tee'
# line continuations: a verb split by `\<newline>` still executes as one command
# and must gate (regression: per-line matching used to BYPASS these).
run_case deny "$(printf 'git \\\npush')"
run_case deny "$(printf 'git \\\n  push origin main')"
run_case deny "$(printf 'gh \\\npr create')"
run_case deny "$(printf 'gh pr \\\ncreate --fill')"

# --- ALLOW: not gated (git/gh not in command position, or non-gated verb) ----
run_case allow 'echo git push'
run_case allow 'git status'
run_case allow 'git commit -m "ready to push"'
run_case allow 'echo FOO=bar git push'
run_case allow 'git push-foo'
# A continuation that joins `git push` onto a preceding token without a shell
# separator is NOT a command (Bash runs it as args of the first word), so it
# stays ALLOW — matching Bash semantics, and proving the join can't over-gate.
run_case allow "$(printf 'echo foo \\\ngit push')"
# BYPASS REGRESSION: an EVEN run of trailing backslashes is escaped literal
# backslashes, NOT a continuation — Bash keeps the newline as a real separator
# and runs `git push`. The join must NOT merge these lines (a naive `\$` match
# used to, hiding the push). Must DENY.
run_case deny "$(printf 'echo \\\\\ngit push')"
run_case deny "$(printf 'x=\\\\\ngit push')"
# An ODD run of trailing backslashes IS a real continuation (last backslash
# escapes the newline); `&& \<nl>git push` still runs the push -> DENY.
run_case deny "$(printf 'true && \\\ngit push')"

# --- Heredoc handling: SECURITY over usability -------------------------------
# We do NOT strip heredoc bodies (a parser-free stripper mis-detects openers and
# silently BYPASSES the gate — see normalize_cmd). So a heredoc body line that
# looks like a gated command is conservatively DENIED (a fail-SAFE over-block).
# Benign-but-over-blocked heredoc body (accepted limitation):
run_case deny "$(printf "cat > README.md <<'EOF'\ngit push\nEOF")"
# A real push on the heredoc OPENING line still gates.
run_case deny "$(printf 'git push <<EOF\nnote\nEOF')"
# BYPASS REGRESSIONS: a FAKE heredoc opener inside quotes or a comment must NOT
# hide a following real command. Bash runs the `git push`/`gh pr create` here,
# so the gate must DENY (the old heredoc-stripping normalizer wrongly ALLOWED).
run_case deny "$(printf "echo '<<EOF'\ngit push\nEOF")"
run_case deny "$(printf 'echo "<<EOF"\ngit push\nEOF')"
run_case deny "$(printf '# <<EOF\ngit push\nEOF')"
run_case deny "$(printf 'echo $((1<<B))\ngh pr create\nB')"

if [ "$FAILED" -ne 0 ]; then
  echo "[FAIL] one or more gate cases did not behave as expected" >&2
  exit 1
fi

echo "[OK] all gate-before-push cases passed"
