#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_RUN="$ROOT_DIR/codex-exec/skills/codex-exec/scripts/codex-run.sh"
CLAUDE_RUN="$ROOT_DIR/claude/skills/claude/scripts/claude-tmux-run.sh"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/skills-wrapper-parity.XXXXXX")"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

pass() {
  echo "[OK] $*"
}

assert_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

assert_executable_private() {
  assert_file "$1"
  local mode
  mode="$(file_mode "$1")"
  [[ "$mode" == "700" ]] || fail "expected 700 mode for $1, got $mode"
}

assert_private_file() {
  assert_file "$1"
  local mode
  mode="$(file_mode "$1")"
  [[ "$mode" == "600" ]] || fail "expected 600 mode for $1, got $mode"
}

assert_contains() {
  local path="$1"
  local needle="$2"
  grep -F -- "$needle" "$path" >/dev/null || fail "expected $path to contain: $needle"
}

assert_not_contains() {
  local path="$1"
  local needle="$2"
  if grep -F -- "$needle" "$path" >/dev/null; then
    fail "expected $path not to contain: $needle"
  fi
}

assert_not_exists() {
  [[ ! -e "$1" ]] || fail "unexpected file exists: $1"
}

extract_run_dir() {
  local output="$1"
  local run_dir
  run_dir="$(sed -n 's/.*run_dir=\([^ ]*\).*/\1/p' "$output" | tail -1)"
  run_dir="${run_dir#\'}"
  run_dir="${run_dir%\'}"
  [[ -n "$run_dir" ]] || fail "could not extract run_dir from $output"
  printf '%s\n' "$run_dir"
}

write_fake_tools() {
  local fakebin="$1"
  mkdir -p "$fakebin"

  cat > "$fakebin/codex" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--version" ]]; then
  echo "codex fake 1.0.0"
  exit 0
fi

if [[ "${1:-}" == "exec" && "${2:-}" == "--version" ]]; then
  echo "codex exec fake 1.0.0"
  exit 0
fi

if [[ "${1:-}" != "exec" ]]; then
  echo "unexpected codex argv: $*" >&2
  exit 64
fi

out_file=""
previous=""
for arg in "$@"; do
  if [[ "$previous" == "-o" ]]; then
    out_file="$arg"
    break
  fi
  previous="$arg"
done

cat >/dev/null || true
printf 'fake codex stdout\n'
printf 'session id: fake-session-123\n' >&2
if [[ -n "$out_file" ]]; then
  printf 'fake codex final\n' > "$out_file"
fi
EOF

  cat > "$fakebin/claude" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--version" ]]; then
  echo "claude fake 1.0.0"
  exit 0
fi

if [[ "${1:-}" == "auth" && "${2:-}" == "status" ]]; then
  echo "authenticated"
  exit 0
fi

echo "fake claude invoked"
EOF

  cat > "$fakebin/tmux" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  -V)
    echo "tmux fake 3.4"
    ;;
  list-sessions)
    echo "fake-session: 1 windows"
    ;;
  has-session)
    exit 0
    ;;
  *)
    echo "fake tmux $*" >> "${FAKE_TMUX_LOG:-/dev/null}"
    ;;
esac
EOF

  chmod +x "$fakebin/codex" "$fakebin/claude" "$fakebin/tmux"
}

setup_workspace() {
  local workspace="$1"
  mkdir -p "$workspace"
  git -C "$workspace" init -q
  git -C "$workspace" config user.email "wrapper-parity@example.test"
  git -C "$workspace" config user.name "Wrapper Parity"
}

test_codex_exec_continue_contract() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex"
  local prompt="$TMP_DIR/codex-prompt.txt"
  local output="$TMP_DIR/codex-output.txt"
  local monitor_output="$TMP_DIR/codex-monitor.txt"
  local continue_output="$TMP_DIR/codex-continue.txt"

  setup_workspace "$workspace"
  printf 'codex prompt secret should stay out of command.txt\n' > "$prompt"

  PATH="$fakebin:$PATH" bash "$CODEX_RUN" exec \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/codex-runs" \
    --prompt-file "$prompt" \
    --sandbox read-only \
    --reasoning high \
    --heartbeat 1 \
    > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_file "$run_dir/run.env"
  assert_file "$run_dir/status.env"
  assert_private_file "$run_dir/prompt.txt"
  assert_private_file "$run_dir/command.txt"
  assert_executable_private "$run_dir/monitor.sh"
  assert_executable_private "$run_dir/continue.sh"
  assert_contains "$run_dir/final.md" "fake codex final"
  assert_contains "$run_dir/status.env" "state=finished"
  assert_contains "$run_dir/run.env" "SESSION_ID=fake-session-123"
  assert_contains "$run_dir/command.txt" "--sandbox read-only"
  assert_not_contains "$run_dir/command.txt" "codex prompt secret"
  assert_contains "$run_dir/prompt.txt" "codex prompt secret"

  CODEX_EXEC_MONITOR_POLL_SECONDS=1 CODEX_EXEC_MONITOR_REPORT_SECONDS=1 \
    bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  assert_contains "$monitor_output" "monitor=done state=finished exit_code=0"

  PATH="$fakebin:$PATH" bash "$run_dir/continue.sh" \
    --prompt "continue in same fake session" \
    --dry-run \
    > "$continue_output" 2>&1

  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/command.txt" "resume fake-session-123"
  assert_contains "$continue_dir/command.txt" "--sandbox read-only"
  assert_contains "$continue_dir/status.env" "state=dry-run"

  pass "codex-exec wrapper preserves prompt transport, artifacts, monitor, and session continuation"
}

test_codex_continue_env_is_not_sourced() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-malicious"
  local prior="$TMP_DIR/codex-prior"
  local output="$TMP_DIR/codex-malicious-output.txt"
  local pwned="$TMP_DIR/codex-pwned"

  setup_workspace "$workspace"
  mkdir -p "$prior"
  {
    printf 'WORKSPACE=%q\n' "$workspace"
    printf 'RUN_ROOT=%q\n' "$TMP_DIR/codex-runs"
    printf 'SESSION_ID=%q\n' "safe-codex-session"
    printf 'HEARTBEAT_SECONDS=1\n'
    printf 'TIMEOUT_SECONDS=0\n'
    printf 'REASONING=medium\n'
    printf 'SANDBOX=read-only\n'
    printf 'EPHEMERAL=false\n'
    printf 'EVIL=%s\n' "\$(touch $(printf '%q' "$pwned"))"
  } > "$prior/run.env"

  PATH="$fakebin:$PATH" bash "$CODEX_RUN" resume \
    --continue-run "$prior" \
    --prompt "safe follow-up" \
    --dry-run \
    > "$output" 2>&1

  assert_not_exists "$pwned"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/command.txt" "resume safe-codex-session"

  pass "codex-exec continuation parses run.env without executing shell"
}

test_claude_dry_run_continue_contract() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude"
  local prompt="$TMP_DIR/claude-prompt.txt"
  local output="$TMP_DIR/claude-output.txt"
  local monitor_output="$TMP_DIR/claude-monitor.txt"
  local continue_output="$TMP_DIR/claude-continue.txt"

  setup_workspace "$workspace"
  printf 'claude prompt secret should stay out of command.txt\n' > "$prompt"

  PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" run \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/claude-runs" \
    --session-id "claude-session-123" \
    --tmux-session "claude-test" \
    --prompt-file "$prompt" \
    --startup-wait 0 \
    --paste-settle 0 \
    --submit-key C-j \
    --dry-run \
    > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_file "$run_dir/run.env"
  assert_file "$run_dir/status.env"
  assert_private_file "$run_dir/prompt.txt"
  assert_private_file "$run_dir/prompt-to-send.txt"
  assert_private_file "$run_dir/command.txt"
  assert_executable_private "$run_dir/monitor.sh"
  assert_executable_private "$run_dir/continue.sh"
  assert_executable_private "$run_dir/submit.sh"
  assert_executable_private "$run_dir/resend.sh"
  assert_contains "$run_dir/status.env" "state=dry-run"
  assert_contains "$run_dir/run.env" "SESSION_ID=claude-session-123"
  assert_contains "$run_dir/run.env" "TMUX_SESSION=claude-test"
  assert_not_contains "$run_dir/command.txt" "claude prompt secret"
  assert_contains "$run_dir/prompt-to-send.txt" "claude prompt secret"

  PATH="$fakebin:$PATH" bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  assert_contains "$monitor_output" "event=finish state=dry-run exit_code=0"

  PATH="$fakebin:$PATH" bash "$run_dir/continue.sh" \
    --prompt "continue in same fake Claude session" \
    --dry-run \
    > "$continue_output" 2>&1

  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/run.env" "SESSION_ID=claude-session-123"
  assert_contains "$continue_dir/run.env" "TMUX_SESSION=claude-test"
  assert_contains "$continue_dir/prompt-to-send.txt" "continue in same fake Claude session"

  pass "Claude tmux wrapper preserves prompt transport, artifacts, monitor, and session continuation"
}

test_claude_run_env_is_not_sourced() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-malicious"
  local prior="$TMP_DIR/claude-prior"
  local output="$TMP_DIR/claude-malicious-output.txt"
  local monitor_output="$TMP_DIR/claude-malicious-monitor.txt"
  local pwned_continue="$TMP_DIR/claude-pwned-continue"
  local pwned_monitor="$TMP_DIR/claude-pwned-monitor"

  setup_workspace "$workspace"
  mkdir -p "$prior"
  {
    printf 'RUN_ID=malicious\n'
    printf 'SESSION_ID=%q\n' "safe-claude-session"
    printf 'TMUX_SESSION=%q\n' "safe-claude-tmux"
    printf 'WORKSPACE=%q\n' "$workspace"
    printf 'RUN_ROOT=%q\n' "$TMP_DIR/claude-runs"
    printf 'RUN_DIR=%q\n' "$prior"
    printf 'STATUS_FILE=%q\n' "$prior/status.env"
    printf 'FINAL_FILE=%q\n' "$prior/final.md"
    printf 'STARTUP_WAIT_SECONDS=0\n'
    printf 'HEARTBEAT_SECONDS=1\n'
    printf 'TIMEOUT_SECONDS=0\n'
    printf 'PASTE_SETTLE_SECONDS=0\n'
    printf 'SUBMIT_KEY=C-m\n'
    printf 'EVIL=%s\n' "\$(touch $(printf '%q' "$pwned_continue"))"
  } > "$prior/run.env"
  {
    printf 'state=dry-run\n'
    printf 'exit_code=0\n'
    printf 'EVIL=%s\n' "\$(touch $(printf '%q' "$pwned_monitor"))"
  } > "$prior/status.env"

  PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" run \
    --continue-run "$prior" \
    --prompt "safe follow-up" \
    --dry-run \
    > "$output" 2>&1

  assert_not_exists "$pwned_continue"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/run.env" "SESSION_ID=safe-claude-session"
  assert_contains "$run_dir/run.env" "TMUX_SESSION=safe-claude-tmux"

  PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$prior" > "$monitor_output" 2>&1
  assert_not_exists "$pwned_monitor"
  assert_contains "$monitor_output" "event=finish state=dry-run exit_code=0"

  pass "Claude tmux runner parses run.env/status.env without executing shell"
}

main() {
  local fakebin="$TMP_DIR/fakebin"
  write_fake_tools "$fakebin"
  export FAKE_TMUX_LOG="$TMP_DIR/fake-tmux.log"

  test_codex_exec_continue_contract
  test_codex_continue_env_is_not_sourced
  test_claude_dry_run_continue_contract
  test_claude_run_env_is_not_sourced
}

main "$@"
