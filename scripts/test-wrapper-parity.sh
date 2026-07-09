#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_RUN="$ROOT_DIR/codex-exec/skills/codex-exec/scripts/codex-run.sh"
CLAUDE_RUN="$ROOT_DIR/claude/skills/claude/scripts/claude-tmux-run.sh"

# Resolve an outer-timeout binary once (GNU coreutils `timeout`, or `gtimeout`
# from brew coreutils on macOS). Empty if neither exists — monitor calls then
# run unguarded, bounded only by their internal TIMEOUT_SECONDS. The monitor
# cases below self-bound (returning 124), but if one ever fails to, the whole
# suite would otherwise hang until the CI job ceiling (GitHub's 6h default);
# the guard turns that into a fast, useful failure. CI (Linux) always has it.
TIMEOUT_CMD=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD="gtimeout"
fi
MONITOR_OUTER_TIMEOUT="${MONITOR_OUTER_TIMEOUT:-60}"
MONITOR_STATUS=0

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

assert_empty_file() {
  local path="$1"
  assert_file "$path"
  [[ ! -s "$path" ]] || fail "expected empty file: $path"
}

assert_not_exists() {
  [[ ! -e "$1" ]] || fail "unexpected file exists: $1"
}

# Run the claude wrapper's `monitor` under the outer-timeout guard, capturing
# combined output to <outfile> and setting MONITOR_STATUS to the wrapper's exit.
# Pass env via `env KEY=VAL ...` so the assignments survive the timeout prefix.
# GNU `timeout` also exits 124 on fire (colliding with the monitor's own 124
# self-timeout), so a genuine hang is disambiguated by wall-clock: a run lasting
# >= the outer bound means the guard fired, and we hard-fail with the output
# rather than let an assertion mistake a hang for the expected self-timeout.
# Usage: run_monitor <outfile> env [KEY=VAL ...] bash "$CLAUDE_RUN" monitor ...
run_monitor() {
  local outfile="$1"
  shift
  local start="$SECONDS"
  set +e
  if [[ -n "$TIMEOUT_CMD" ]]; then
    "$TIMEOUT_CMD" "$MONITOR_OUTER_TIMEOUT" "$@" > "$outfile" 2>&1
  else
    "$@" > "$outfile" 2>&1
  fi
  MONITOR_STATUS=$?
  set -e
  if [[ -n "$TIMEOUT_CMD" && $(( SECONDS - start )) -ge "$MONITOR_OUTER_TIMEOUT" ]]; then
    echo "---- monitor output (outer ${MONITOR_OUTER_TIMEOUT}s guard fired) ----" >&2
    cat "$outfile" >&2
    fail "monitor exceeded ${MONITOR_OUTER_TIMEOUT}s outer guard (internal TIMEOUT_SECONDS failed to bound it): $*"
  fi
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
if [[ -n "${FAKE_CODEX_STALL_COUNTER:-}" ]]; then
  attempt="$(cat "$FAKE_CODEX_STALL_COUNTER" 2>/dev/null || printf 0)"
  attempt=$((attempt + 1))
  printf '%s' "$attempt" > "$FAKE_CODEX_STALL_COUNTER"
  stall_attempts="${FAKE_CODEX_STALL_ATTEMPTS:-1}"
  if (( attempt <= stall_attempts )); then
    if [[ -n "${FAKE_CODEX_MUTATE_FILE:-}" ]]; then
      printf 'mutated during first attempt\n' > "$FAKE_CODEX_MUTATE_FILE"
    fi
    if [[ "${FAKE_CODEX_IGNORE_TERM:-}" == "1" ]]; then
      trap '' TERM
    fi
    sleep 10
  fi
fi
if [[ -n "${FAKE_CODEX_SPAWN_ON_TERM_PID_FILE:-}" ]]; then
  spawn_on_term() {
    trap - TERM
    (
      trap '' TERM
      while :; do sleep 1; done
    ) &
    spawned_pid=$!
    printf '%s' "$spawned_pid" > "$FAKE_CODEX_SPAWN_ON_TERM_PID_FILE"
    exit 0
  }
  trap spawn_on_term TERM
  while :; do sleep 1; done
fi
if [[ "${FAKE_CODEX_HANG:-}" == "1" ]]; then
  if [[ "${FAKE_CODEX_IGNORE_TERM:-}" == "1" ]]; then
    trap '' TERM
  fi
  if [[ -n "${FAKE_CODEX_CHILD_PID_FILE:-}" ]]; then
    sleep 60 &
    hang_pid=$!
    printf '%s' "$hang_pid" > "$FAKE_CODEX_CHILD_PID_FILE"
    wait "$hang_pid"
  else
    sleep 60
  fi
fi
if [[ -n "${FAKE_CODEX_PROGRESS_FILE:-}" ]]; then
  for progress_step in 1 2 3 4; do
    printf 'progress %s\n' "$progress_step" > "$FAKE_CODEX_PROGRESS_FILE"
    sleep 1
  done
fi
if [[ "${FAKE_CODEX_NO_STDOUT:-}" == "1" ]]; then
  :
elif [[ "${FAKE_CODEX_JSON_STDOUT:-}" == "1" ]]; then
  printf '{"type":"agent_message","message":"fake json stdout"}\n'
elif [[ "${FAKE_CODEX_STDERR_VERDICT:-}" == "1" ]]; then
  printf 'fake review verdict from stderr\n' >&2
elif [[ "${FAKE_CODEX_STDERR_NOISE:-}" == "1" ]]; then
  printf 'rmcp auth-token error: token expired\n' >&2
  printf 'confstr() failed: errno 22\n' >&2
  printf 'xcodebuild: error writing cache\n' >&2
  printf 'fake review verdict from stderr\n' >&2
else
  printf 'fake codex stdout\n'
fi
printf 'session id: fake-session-123\n' >&2
if [[ -n "$out_file" && "${FAKE_CODEX_SKIP_FINAL:-}" != "1" ]]; then
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
    [[ "${FAKE_TMUX_HAS_SESSION:-1}" == "1" ]] || exit 1
    ;;
  capture-pane)
    # When a counter file is set, emit per-call-changing content so a test can
    # mimic Claude Code's TUI animating its "esc to interrupt - Ns" line every
    # capture. Otherwise behave like the catch-all (no stdout) so other tests
    # keep getting an empty pane.
    if [[ -n "${FAKE_TMUX_PANE_COUNTER:-}" ]]; then
      _pane_n="$(cat "$FAKE_TMUX_PANE_COUNTER" 2>/dev/null || printf 0)"
      _pane_n=$((_pane_n + 1))
      printf '%s' "$_pane_n" > "$FAKE_TMUX_PANE_COUNTER"
      printf 'working - %ss esc to interrupt\n' "$_pane_n"
    else
      echo "fake tmux $*" >> "${FAKE_TMUX_LOG:-/dev/null}"
    fi
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
  assert_private_file "$run_dir/status.json"
  assert_private_file "$run_dir/prompt.txt"
  assert_private_file "$run_dir/command.txt"
  assert_executable_private "$run_dir/monitor.sh"
  assert_executable_private "$run_dir/continue.sh"
  assert_contains "$run_dir/final.md" "fake codex final"
  assert_contains "$run_dir/status.env" "state=finished"
  assert_contains "$run_dir/status.json" '"state": "finished"'
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

test_codex_run_dir_file_contract() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-run-dir-file"
  local output="$TMP_DIR/codex-run-dir-file-output.txt"
  local run_dir_file="$TMP_DIR/codex-run-dir-pointer/run-dir.txt"

  setup_workspace "$workspace"

  PATH="$fakebin:$PATH" bash "$CODEX_RUN" exec \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/codex-run-dir-file-runs" \
    --run-dir-file "$run_dir_file" \
    --prompt "record run dir for background launch" \
    --dry-run \
    > "$output" 2>&1

  assert_private_file "$run_dir_file"
  local run_dir
  run_dir="$(cat "$run_dir_file")"
  [[ -d "$run_dir" ]] || fail "run-dir-file pointed at missing directory: $run_dir"
  # status.env/run.env and event=paths store paths %q-quoted; match that form so
  # the assertions hold even when TMPDIR contains shell-special characters.
  local quoted_run_dir_file
  quoted_run_dir_file="$(printf '%q' "$run_dir_file")"
  assert_contains "$output" "run_dir_file=$quoted_run_dir_file"
  assert_contains "$run_dir/status.env" "run_dir_file=$quoted_run_dir_file"
  assert_contains "$run_dir/run.env" "RUN_DIR_FILE=$quoted_run_dir_file"
  assert_contains "$run_dir/status.env" "state=dry-run"

  # A relative --run-dir-file must resolve against the caller's cwd, not the
  # run root, so exercise the absolute_path branch from inside the workspace.
  local rel_output="$TMP_DIR/codex-run-dir-file-rel-output.txt"
  (
    cd "$workspace" || exit 1
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" exec \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-run-dir-file-rel-runs" \
      --run-dir-file "rel-run-dir.txt" \
      --prompt "record run dir via relative pointer" \
      --dry-run \
      > "$rel_output" 2>&1
  )
  local workspace_real
  workspace_real="$(cd "$workspace" && pwd -P)"
  local rel_pointer="$workspace_real/rel-run-dir.txt"
  assert_private_file "$rel_pointer"
  local rel_run_dir
  rel_run_dir="$(cat "$rel_pointer")"
  [[ -d "$rel_run_dir" ]] || fail "relative run-dir-file pointed at missing directory: $rel_run_dir"
  assert_contains "$rel_output" "run_dir_file="

  pass "codex-exec writes --run-dir-file for exact MonitorTool handoff"
}

test_codex_generate_is_an_exact_run_write_alias() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-generate-alias"
  local run_output="$TMP_DIR/codex-run-alias-output.txt"
  local generate_output="$TMP_DIR/codex-generate-alias-output.txt"

  setup_workspace "$workspace"

  PATH="$fakebin:$PATH" bash "$CODEX_RUN" run \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/codex-run-alias-runs" \
    --write \
    --prompt "same implementation prompt" \
    --dry-run \
    > "$run_output" 2>&1
  PATH="$fakebin:$PATH" bash "$CODEX_RUN" generate \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/codex-generate-alias-runs" \
    --prompt "same implementation prompt" \
    --dry-run \
    > "$generate_output" 2>&1

  local run_dir generate_dir
  run_dir="$(extract_run_dir "$run_output")"
  generate_dir="$(extract_run_dir "$generate_output")"
  cmp "$run_dir/prompt.txt" "$generate_dir/prompt.txt" >/dev/null || \
    fail "generate rewrote the prompt instead of acting as an alias"
  assert_contains "$run_dir/command.txt" "--sandbox workspace-write"
  assert_contains "$generate_dir/command.txt" "--sandbox workspace-write"
  assert_contains "$run_dir/command.txt" 'model_reasoning_effort=\"medium\"'
  assert_contains "$generate_dir/command.txt" 'model_reasoning_effort=\"medium\"'
  assert_contains "$generate_output" 'event=deprecated old=generate replacement="run --write"'
  assert_not_contains "$run_dir/command.txt" "--output-schema"
  assert_not_contains "$generate_dir/command.txt" "--output-schema"

  pass "codex-exec generate is an exact deprecated alias for run --write"
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

test_codex_monitor_status_is_not_sourced() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-monitor"
  local output="$TMP_DIR/codex-monitor-output.txt"
  local monitor_output="$TMP_DIR/codex-monitor-malicious.txt"
  local pwned="$TMP_DIR/codex-monitor-pwned"

  setup_workspace "$workspace"

  # A dry run still writes a real monitor. Remove status.json to exercise the
  # compatibility status.env parser without allowing shell execution.
  PATH="$fakebin:$PATH" bash "$CODEX_RUN" exec \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/codex-monitor-runs" \
    --prompt "safe monitor prompt" \
    --sandbox read-only \
    --dry-run \
    > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_executable_private "$run_dir/monitor.sh"
  rm -f "$run_dir/status.json"

  {
    printf 'state=finished\n'
    printf 'exit_code=0\n'
    printf 'EVIL=%s\n' "\$(touch $(printf '%q' "$pwned"))"
  } > "$run_dir/status.env"

  CODEX_EXEC_MONITOR_POLL_SECONDS=1 CODEX_EXEC_MONITOR_REPORT_SECONDS=1 \
    bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1

  assert_not_exists "$pwned"
  assert_contains "$monitor_output" "monitor=done state=finished exit_code=0"

  pass "codex-exec monitor parses status.env without executing shell"
}

test_codex_stall_retries_once_without_workspace_changes() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-stall"
  local output="$TMP_DIR/codex-stall-output.txt"
  local counter="$TMP_DIR/codex-stall-attempts"

  setup_workspace "$workspace"

  FAKE_CODEX_STALL_COUNTER="$counter" PATH="$fakebin:$PATH" \
    bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-stall-runs" \
      --prompt "retry a silent startup once" \
      --heartbeat 1 \
      --stall-timeout 1 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$output" "event=stall"
  assert_contains "$output" "event=retry reason=stall attempt=2"
  assert_contains "$output" "event=spawn attempt=2"
  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/final.md" "fake codex final"
  [[ "$(cat "$counter")" == "2" ]] || fail "expected exactly two Codex attempts"

  pass "codex-exec retries one silent stall when the workspace is unchanged"
}

test_codex_monitor_waits_through_stall_retry() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-monitor-retry"
  local output="$TMP_DIR/codex-monitor-retry-output.txt"
  local monitor_output="$TMP_DIR/codex-monitor-retry-monitor.txt"
  local counter="$TMP_DIR/codex-monitor-retry-attempts"
  local run_dir_file="$TMP_DIR/codex-monitor-retry-run-dir"

  setup_workspace "$workspace"

  CODEX_EXEC_TERM_GRACE_SECONDS=1 FAKE_CODEX_STALL_COUNTER="$counter" FAKE_CODEX_IGNORE_TERM=1 \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-monitor-retry-runs" \
      --run-dir-file "$run_dir_file" \
      --prompt "monitor the retry instead of exiting early" \
      --heartbeat 1 \
      --stall-timeout 1 \
      --timeout 10 \
      > "$output" 2>&1 &
  local wrapper_pid=$!

  local attempt
  for attempt in {1..50}; do
    : "$attempt"
    [[ -s "$run_dir_file" ]] && break
    sleep 0.1
  done
  [[ -s "$run_dir_file" ]] || fail "runner did not publish run directory"
  local run_dir
  run_dir="$(cat "$run_dir_file")"
  CODEX_EXEC_MONITOR_POLL_SECONDS=1 CODEX_EXEC_MONITOR_REPORT_SECONDS=1 \
    bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  wait "$wrapper_pid"

  assert_contains "$output" "event=retry reason=stall attempt=2"
  assert_contains "$monitor_output" "monitor=done state=finished exit_code=0"

  pass "codex-exec monitor remains attached through a safe stall retry"
}

test_codex_write_stall_never_retries() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-mutation"
  local output="$TMP_DIR/codex-mutation-output.txt"
  local counter="$TMP_DIR/codex-mutation-attempts"

  setup_workspace "$workspace"
  printf 'original\n' > "$workspace/mutable.txt"
  git -C "$workspace" add mutable.txt
  git -C "$workspace" commit -qm "add mutable fixture"

  set +e
  FAKE_CODEX_STALL_COUNTER="$counter" \
    FAKE_CODEX_MUTATE_FILE="$workspace/mutable.txt" \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-mutation-runs" \
      --write \
      --prompt "mutate, then stall" \
      --heartbeat 1 \
      --stall-timeout 1 \
      --timeout 10 \
      > "$output" 2>&1
  local status=$?
  set -e

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  [[ "$status" == "124" ]] || fail "expected mutation stall to exit 124, got $status"
  assert_contains "$output" "event=no-retry reason=unsafe-command-capabilities"
  assert_not_contains "$output" "event=spawn attempt=2"
  assert_contains "$run_dir/status.json" '"state": "stalled"'
  [[ "$(cat "$counter")" == "1" ]] || fail "expected exactly one Codex attempt after mutation"

  pass "codex-exec never retries a stalled write-capable run"
}

test_codex_capability_passthrough_disables_retry() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-bypass"
  local output="$TMP_DIR/codex-bypass-output.txt"
  local counter="$TMP_DIR/codex-bypass-attempts"

  setup_workspace "$workspace"

  set +e
  FAKE_CODEX_STALL_COUNTER="$counter" PATH="$fakebin:$PATH" \
    bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-bypass-runs" \
      --prompt "nominally read-only but sandbox bypassed" \
      --dangerously-bypass-approvals-and-sandbox \
      --heartbeat 1 \
      --stall-timeout 1 \
      --timeout 10 \
      > "$output" 2>&1
  local status=$?
  set -e

  [[ "$status" == "124" ]] || fail "expected bypassed stall to exit 124, got $status"
  assert_contains "$output" "event=no-retry reason=unsafe-command-capabilities"
  assert_not_contains "$output" "event=spawn attempt=2"
  [[ "$(cat "$counter")" == "1" ]] || fail "expected one bypassed attempt"

  pass "codex-exec does not replay a read-only label after capability passthrough"
}

test_codex_workspace_content_progress_prevents_false_stall() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-content-progress"
  local output="$TMP_DIR/codex-content-progress-output.txt"

  setup_workspace "$workspace"
  printf 'original\n' > "$workspace/progress.txt"
  git -C "$workspace" add progress.txt
  git -C "$workspace" commit -qm "add progress fixture"

  FAKE_CODEX_PROGRESS_FILE="$workspace/progress.txt" PATH="$fakebin:$PATH" \
    bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-content-progress-runs" \
      --write \
      --no-json \
      --prompt "edit one already-dirty file quietly" \
      --heartbeat 1 \
      --stall-timeout 2 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_not_contains "$output" "event=stall"
  assert_contains "$run_dir/status.json" '"state": "finished"'

  pass "codex-exec treats continuing file-content edits as meaningful progress"
}

test_codex_retry_gets_a_fresh_stall_clock() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-second-stall"
  local output="$TMP_DIR/codex-second-stall-output.txt"
  local counter="$TMP_DIR/codex-second-stall-attempts"

  setup_workspace "$workspace"

  set +e
  FAKE_CODEX_STALL_COUNTER="$counter" FAKE_CODEX_STALL_ATTEMPTS=2 \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-second-stall-runs" \
      --prompt "stall twice with independent inactivity clocks" \
      --heartbeat 1 \
      --stall-timeout 3 \
      --timeout 20 \
      > "$output" 2>&1
  local status=$?
  set -e

  [[ "$status" == "124" ]] || fail "expected second stall to exit 124, got $status"
  awk '/event=spawn attempt=2/{second=1} second && /event=progress/{found=1} END{exit !found}' "$output" || \
    fail "expected attempt two to start with a fresh inactivity clock"
  [[ "$(cat "$counter")" == "2" ]] || fail "expected exactly two stalled attempts"

  pass "codex-exec resets the inactivity clock for a safe retry"
}

test_codex_hard_timeout_escalates_to_kill() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-hard-timeout"
  local output="$TMP_DIR/codex-hard-timeout-output.txt"
  local child_pid_file="$TMP_DIR/codex-hard-timeout-child-pid"

  setup_workspace "$workspace"

  set +e
  CODEX_EXEC_TERM_GRACE_SECONDS=1 \
    FAKE_CODEX_SPAWN_ON_TERM_PID_FILE="$child_pid_file" \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-hard-timeout-runs" \
      --prompt "ignore TERM until the runner escalates" \
      --stall-timeout 0 \
      --timeout 1 \
      > "$output" 2>&1
  local status=$?
  set -e

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  [[ "$status" == "124" ]] || fail "expected hard timeout to exit 124, got $status"
  assert_contains "$output" "event=timeout kind=hard timeout_seconds=1"
  assert_contains "$run_dir/status.json" '"state": "timed-out"'
  [[ -s "$child_pid_file" ]] || fail "TERM handler did not record its spawned descendant pid"
  if kill -0 "$(cat "$child_pid_file")" 2>/dev/null; then
    fail "provider descendant survived hard-timeout process-group escalation"
  fi

  pass "codex-exec kills descendants spawned during TERM handling"
}

test_codex_review_stderr_fallback_populates_final() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-review"
  local output="$TMP_DIR/codex-review-output.txt"

  setup_workspace "$workspace"

  FAKE_CODEX_SKIP_FINAL=1 FAKE_CODEX_STDERR_VERDICT=1 \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" review \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-review-runs" \
      --prompt "review with stderr-only fake verdict" \
      --heartbeat 1 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/final.md" "fake review verdict from stderr"
  assert_not_contains "$run_dir/final.md" "session id: fake-session-123"
  assert_contains "$run_dir/status.env" "final_source=stderr.log"
  assert_contains "$output" "event=final-fallback source=stderr.log"

  pass "codex-exec review backfills final.md from stderr when output-last-message is empty"
}

test_codex_review_stderr_noise_filtered_from_final() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-review-noise"
  local output="$TMP_DIR/codex-review-noise-output.txt"

  setup_workspace "$workspace"

  FAKE_CODEX_SKIP_FINAL=1 FAKE_CODEX_STDERR_NOISE=1 \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" review \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-review-noise-runs" \
      --prompt "review with benign stderr noise mixed into the verdict" \
      --heartbeat 1 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/final.md" "fake review verdict from stderr"
  assert_not_contains "$run_dir/final.md" "rmcp auth-token error"
  assert_not_contains "$run_dir/final.md" "confstr() failed"
  assert_not_contains "$run_dir/final.md" "xcodebuild: error writing cache"
  assert_not_contains "$run_dir/final.md" "session id: fake-session-123"
  assert_contains "$run_dir/status.env" "final_source=stderr.log"

  pass "codex-exec review stderr fallback filters benign environmental noise from final.md"
}

test_codex_json_stdout_fallback_keeps_final_empty() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-json"
  local output="$TMP_DIR/codex-json-output.txt"

  setup_workspace "$workspace"

  FAKE_CODEX_SKIP_FINAL=1 FAKE_CODEX_JSON_STDOUT=1 \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" exec \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-json-runs" \
      --prompt "json stdout should not become final markdown" \
      --json \
      --heartbeat 1 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_empty_file "$run_dir/final.md"
  assert_contains "$run_dir/stdout.log" '{"type":"agent_message","message":"fake json stdout"}'
  assert_contains "$run_dir/events.jsonl" '{"type":"agent_message","message":"fake json stdout"}'
  assert_contains "$run_dir/status.env" "final_source=empty-json-stdout"
  assert_contains "$output" "event=final-fallback source=empty-json-stdout"

  pass "codex-exec JSON stdout fallback keeps final.md empty instead of copying JSONL"
}

test_codex_review_stderr_session_only_keeps_final_empty() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-codex-review-session-only"
  local output="$TMP_DIR/codex-review-session-only-output.txt"

  setup_workspace "$workspace"

  FAKE_CODEX_SKIP_FINAL=1 FAKE_CODEX_NO_STDOUT=1 \
    PATH="$fakebin:$PATH" bash "$CODEX_RUN" review \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/codex-review-session-only-runs" \
      --prompt "session id alone should not become final markdown" \
      --heartbeat 1 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_empty_file "$run_dir/final.md"
  assert_contains "$run_dir/stderr.log" "session id: fake-session-123"
  assert_not_contains "$run_dir/final.md" "session id: fake-session-123"
  assert_contains "$run_dir/status.env" "final_source=empty"

  pass "codex-exec review stderr fallback ignores session-only stderr"
}

test_claude_dry_run_continue_contract() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude"
  local prompt="$TMP_DIR/claude-prompt.txt"
  local output="$TMP_DIR/claude-output.txt"
  local monitor_output="$TMP_DIR/claude-monitor.txt"
  local continue_output="$TMP_DIR/claude-continue.txt"
  local resume_output="$TMP_DIR/claude-resume-continue.txt"

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
  assert_contains "$run_dir/command.txt" "--permission-mode auto"
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
  assert_contains "$continue_dir/command.txt" "--permission-mode auto"
  assert_contains "$continue_dir/prompt-to-send.txt" "continue in same fake Claude session"

  FAKE_TMUX_HAS_SESSION=0 PATH="$fakebin:$PATH" bash "$run_dir/continue.sh" \
    --prompt "resume in a fresh fake tmux session" \
    --dry-run \
    > "$resume_output" 2>&1

  local resume_dir
  resume_dir="$(extract_run_dir "$resume_output")"
  assert_contains "$resume_dir/command.txt" "--resume claude-session-123"
  assert_contains "$resume_dir/run.env" "RESUME_SESSION_ID=claude-session-123"
  assert_contains "$resume_dir/run.env" "TMUX_SESSION=claude-test"
  assert_contains "$resume_dir/prompt-to-send.txt" "resume in a fresh fake tmux session"

  pass "Claude tmux wrapper preserves prompt transport, artifacts, monitor, and session continuation"
}

test_claude_monitor_tracks_transcript_phase() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-monitor"
  local run_dir="$TMP_DIR/claude-active-monitor"
  local transcript="$run_dir/transcript.jsonl"
  local tool_running_output="$TMP_DIR/claude-tool-running-monitor-output.txt"
  local partial_result_output="$TMP_DIR/claude-partial-result-monitor-output.txt"
  local thinking_output="$TMP_DIR/claude-thinking-monitor-output.txt"
  local responding_output="$TMP_DIR/claude-responding-monitor-output.txt"
  local done_output="$TMP_DIR/claude-done-monitor-output.txt"

  setup_workspace "$workspace"
  mkdir -p "$run_dir"
  : > "$run_dir/final.md"
  cat > "$transcript" <<'EOF'
{"type":"user","message":{"role":"user","content":"Old prompt."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Old final."}]}}
{"type":"system","subtype":"turn_duration"}
{"type":"user","message":{"role":"user","content":"Review this."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll inspect."},{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"printf hi"}},{"type":"tool_use","id":"toolu_2","name":"Read","input":{"file_path":"README.md"}}]}}
EOF
  {
    printf 'RUN_ID=active-monitor\n'
    printf 'SESSION_ID=claude-active-session\n'
    printf 'TMUX_SESSION=claude-active-tmux\n'
    printf 'WORKSPACE=%q\n' "$workspace"
    printf 'RUN_ROOT=%q\n' "$TMP_DIR/claude-runs"
    printf 'RUN_DIR=%q\n' "$run_dir"
    printf 'STATUS_FILE=%q\n' "$run_dir/status.env"
    printf 'FINAL_FILE=%q\n' "$run_dir/final.md"
    printf 'PANE_FILE=%q\n' "$run_dir/pane.txt"
    printf 'TRANSCRIPT_FILE=%q\n' "$transcript"
    printf 'BASE_TRANSCRIPT_LINES=3\n'
    printf 'HEARTBEAT_SECONDS=1\n'
    printf 'TIMEOUT_SECONDS=1\n'
    printf 'STARTUP_WAIT_SECONDS=0\n'
    printf 'PASTE_SETTLE_SECONDS=0\n'
    printf 'SUBMIT_KEY=C-m\n'
  } > "$run_dir/run.env"

  run_monitor "$tool_running_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  [[ "$MONITOR_STATUS" == "124" ]] || fail "expected tool-running monitor timeout, got $MONITOR_STATUS"
  assert_contains "$tool_running_output" "phase=tool-running"
  assert_contains "$tool_running_output" "last_event=tool_use"
  assert_contains "$tool_running_output" "last_tool=Read"
  assert_contains "$tool_running_output" "transcript_lines=5"

  cat >> "$transcript" <<'EOF'
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"hi"}]}}
EOF

  run_monitor "$partial_result_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  [[ "$MONITOR_STATUS" == "124" ]] || fail "expected partial-result monitor timeout, got $MONITOR_STATUS"
  assert_contains "$partial_result_output" "phase=tool-running"
  assert_contains "$partial_result_output" "last_event=tool_result"
  assert_contains "$partial_result_output" "last_tool=Read"
  assert_contains "$partial_result_output" "transcript_lines=6"

  cat >> "$transcript" <<'EOF'
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_2","content":"README"}]}}
EOF

  run_monitor "$thinking_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  [[ "$MONITOR_STATUS" == "124" ]] || fail "expected thinking monitor timeout, got $MONITOR_STATUS"
  assert_contains "$thinking_output" "phase=thinking"
  assert_contains "$thinking_output" "last_event=tool_result"
  assert_contains "$thinking_output" "last_tool=Read"
  assert_contains "$thinking_output" "transcript_lines=7"
  assert_contains "$run_dir/status.env" "state=timeout"
  assert_contains "$run_dir/status.env" "phase=thinking"
  assert_contains "$run_dir/status.env" "last_event=tool_result"

  cat >> "$transcript" <<'EOF'
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Final from Claude."}]}}
EOF

  run_monitor "$responding_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  [[ "$MONITOR_STATUS" == "124" ]] || fail "expected responding monitor timeout, got $MONITOR_STATUS"
  assert_contains "$responding_output" "phase=responding"
  assert_contains "$responding_output" "last_event=assistant_text"
  assert_contains "$responding_output" "transcript_lines=8"
  assert_contains "$run_dir/status.env" "assistant_text_seen=true"

  cat >> "$transcript" <<'EOF'
{"type":"system","subtype":"turn_duration"}
EOF

  run_monitor "$done_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  assert_contains "$done_output" "event=finish state=done exit_code=0 phase=done"
  assert_contains "$run_dir/status.env" "state=done"
  assert_contains "$run_dir/status.env" "phase=done"
  assert_contains "$run_dir/final.md" "Final from Claude."

  pass "Claude tmux monitor reports transcript phase and completion"
}

test_claude_monitor_stall_excludes_pane() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-stall"
  local run_dir="$TMP_DIR/claude-stall-monitor"
  local transcript="$run_dir/transcript.jsonl"
  local stall_output="$TMP_DIR/claude-stall-monitor-output.txt"

  setup_workspace "$workspace"
  mkdir -p "$run_dir"
  : > "$run_dir/final.md"
  # A frozen, in-progress turn: a tool_use is pending and never completes, so the
  # monitor keeps looping (phase=tool-running) until it times out. The transcript
  # never changes during the run, so the ONLY thing moving is the tmux pane.
  cat > "$transcript" <<'EOF'
{"type":"user","message":{"role":"user","content":"Old prompt."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Old final."}]}}
{"type":"system","subtype":"turn_duration"}
{"type":"user","message":{"role":"user","content":"Run the slow build."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_slow","name":"Bash","input":{"command":"make"}}]}}
EOF
  {
    printf 'RUN_ID=stall-monitor\n'
    printf 'SESSION_ID=claude-stall-session\n'
    printf 'TMUX_SESSION=claude-stall-tmux\n'
    printf 'WORKSPACE=%q\n' "$workspace"
    printf 'RUN_ROOT=%q\n' "$TMP_DIR/claude-runs"
    printf 'RUN_DIR=%q\n' "$run_dir"
    printf 'STATUS_FILE=%q\n' "$run_dir/status.env"
    printf 'FINAL_FILE=%q\n' "$run_dir/final.md"
    printf 'PANE_FILE=%q\n' "$run_dir/pane.txt"
    printf 'TRANSCRIPT_FILE=%q\n' "$transcript"
    printf 'BASE_TRANSCRIPT_LINES=3\n'
    printf 'HEARTBEAT_SECONDS=1\n'
    printf 'TIMEOUT_SECONDS=5\n'
    printf 'STARTUP_WAIT_SECONDS=0\n'
    printf 'PASTE_SETTLE_SECONDS=0\n'
    printf 'SUBMIT_KEY=C-m\n'
  } > "$run_dir/run.env"

  run_monitor "$stall_output" \
    env "FAKE_TMUX_PANE_COUNTER=$run_dir/pane-counter" "PATH=$fakebin:$PATH" \
    bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  [[ "$MONITOR_STATUS" == "124" ]] || fail "expected stall monitor timeout, got $MONITOR_STATUS"
  assert_contains "$stall_output" "phase=tool-running"

  # The pane must have actually churned across heartbeats, otherwise the test is
  # not exercising the regression it guards.
  local pane_ticks
  pane_ticks="$(cat "$run_dir/pane-counter" 2>/dev/null || printf 0)"
  [[ "$pane_ticks" -ge 2 ]] || fail "expected pane to churn across heartbeats, got $pane_ticks captures"

  # Despite the churning pane, stalled_for_seconds must climb because the
  # transcript stopped growing. If the pane ever re-enters the stall fingerprint,
  # last_progress_at resets every tick and this stays 0.
  local stalled
  stalled="$(sed -n 's/.*stalled_for=\([0-9][0-9]*\)s.*/\1/p' "$stall_output" | tail -1)"
  [[ -n "$stalled" && "$stalled" -ge 1 ]] || \
    fail "expected stalled_for to grow with a frozen transcript, got '${stalled:-}'"

  pass "Claude tmux monitor stall ignores pane churn and tracks transcript progress"
}

test_claude_monitor_noid_tool_result_keeps_pending() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-noid"
  local run_dir="$TMP_DIR/claude-noid-monitor"
  local transcript="$run_dir/transcript.jsonl"
  local noid_output="$TMP_DIR/claude-noid-monitor-output.txt"

  setup_workspace "$workspace"
  mkdir -p "$run_dir"
  : > "$run_dir/final.md"
  # A tool is pending, then a tool_result arrives with NO tool_use_id. The fix
  # must NOT clear an arbitrary pending tool: the phase has to stay tool-running
  # because toolu_a is still outstanding. (Before the fix, the empty id popped a
  # random pending id and the phase flipped to thinking.)
  cat > "$transcript" <<'EOF'
{"type":"user","message":{"role":"user","content":"Old prompt."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Old final."}]}}
{"type":"system","subtype":"turn_duration"}
{"type":"user","message":{"role":"user","content":"Do work."}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_a","name":"Bash","input":{"command":"true"}}]}}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"finished, but no id"}]}}
EOF
  {
    printf 'RUN_ID=noid-monitor\n'
    printf 'SESSION_ID=claude-noid-session\n'
    printf 'TMUX_SESSION=claude-noid-tmux\n'
    printf 'WORKSPACE=%q\n' "$workspace"
    printf 'RUN_ROOT=%q\n' "$TMP_DIR/claude-runs"
    printf 'RUN_DIR=%q\n' "$run_dir"
    printf 'STATUS_FILE=%q\n' "$run_dir/status.env"
    printf 'FINAL_FILE=%q\n' "$run_dir/final.md"
    printf 'PANE_FILE=%q\n' "$run_dir/pane.txt"
    printf 'TRANSCRIPT_FILE=%q\n' "$transcript"
    printf 'BASE_TRANSCRIPT_LINES=3\n'
    printf 'HEARTBEAT_SECONDS=1\n'
    printf 'TIMEOUT_SECONDS=1\n'
    printf 'STARTUP_WAIT_SECONDS=0\n'
    printf 'PASTE_SETTLE_SECONDS=0\n'
    printf 'SUBMIT_KEY=C-m\n'
  } > "$run_dir/run.env"

  run_monitor "$noid_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$run_dir"
  [[ "$MONITOR_STATUS" == "124" ]] || fail "expected no-id tool_result monitor timeout, got $MONITOR_STATUS"
  assert_contains "$noid_output" "phase=tool-running"
  assert_contains "$noid_output" "last_event=tool_result"
  assert_contains "$noid_output" "transcript_lines=6"
  assert_not_contains "$noid_output" "phase=thinking"

  pass "Claude tmux monitor keeps a pending tool when a tool_result has no id"
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

  run_monitor "$monitor_output" env "PATH=$fakebin:$PATH" bash "$CLAUDE_RUN" monitor --run-dir "$prior"
  assert_not_exists "$pwned_monitor"
  assert_contains "$monitor_output" "event=finish state=dry-run exit_code=0"

  pass "Claude tmux runner parses run.env/status.env without executing shell"
}

main() {
  local fakebin="$TMP_DIR/fakebin"
  write_fake_tools "$fakebin"
  export FAKE_TMUX_LOG="$TMP_DIR/fake-tmux.log"

  test_codex_exec_continue_contract
  test_codex_run_dir_file_contract
  test_codex_generate_is_an_exact_run_write_alias
  test_codex_continue_env_is_not_sourced
  test_codex_monitor_status_is_not_sourced
  test_codex_stall_retries_once_without_workspace_changes
  test_codex_monitor_waits_through_stall_retry
  test_codex_write_stall_never_retries
  test_codex_capability_passthrough_disables_retry
  test_codex_workspace_content_progress_prevents_false_stall
  test_codex_retry_gets_a_fresh_stall_clock
  test_codex_hard_timeout_escalates_to_kill
  test_codex_review_stderr_fallback_populates_final
  test_codex_review_stderr_noise_filtered_from_final
  test_codex_json_stdout_fallback_keeps_final_empty
  test_codex_review_stderr_session_only_keeps_final_empty
  test_claude_dry_run_continue_contract
  test_claude_monitor_tracks_transcript_phase
  test_claude_monitor_stall_excludes_pane
  test_claude_monitor_noid_tool_result_keeps_pending
  test_claude_run_env_is_not_sourced
}

main "$@"
