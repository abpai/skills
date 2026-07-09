#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_RUN="$ROOT_DIR/codex-exec/skills/codex-exec/scripts/codex-run.sh"
CLAUDE_RUN="$ROOT_DIR/claude/skills/claude/scripts/claude-run.sh"

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

session_id=""
previous=""
for arg in "$@"; do
  if [[ "$previous" == "--session-id" || "$previous" == "--resume" ]]; then
    session_id="$arg"
  fi
  previous="$arg"
done
[[ -n "$session_id" ]] || session_id="00000000-0000-4000-8000-000000000001"
cat > "${FAKE_CLAUDE_PROMPT_FILE:-/dev/null}"
[[ -z "${FAKE_CLAUDE_ARGV_FILE:-}" ]] || printf '%s\n' "$*" > "$FAKE_CLAUDE_ARGV_FILE"

project_key="$(printf '%s' "$PWD" | sed 's/[^A-Za-z0-9-]/-/g')"
claude_home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
project_dir="$claude_home/projects/$project_key"
parent_transcript="$project_dir/$session_id.jsonl"
child_dir="$project_dir/$session_id/subagents"
mkdir -p "$project_dir" "$child_dir"
printf '{"type":"user","message":{"role":"user","content":"fake prompt"}}\n' > "$parent_transcript"
printf '{"type":"system","subtype":"init","session_id":"%s"}\n' "$session_id"

if [[ -n "${FAKE_CLAUDE_MUTATE_FILE:-}" ]]; then
  printf 'mutated by fake Claude\n' > "$FAKE_CLAUDE_MUTATE_FILE"
fi

if [[ "${FAKE_CLAUDE_CHILD_MODE:-}" == "active" ]]; then
  child="$child_dir/agent-active.jsonl"
  for step in 1 2 3; do
    printf '{"type":"assistant","message":{"role":"assistant","stop_reason":null,"content":[{"type":"text","text":"child step %s"}]}}\n' "$step" >> "$child"
    sleep 1
  done
  printf '{"type":"assistant","message":{"role":"assistant","stop_reason":"end_turn","content":[{"type":"text","text":"child active final"}]}}\n' >> "$child"
  printf '{"type":"user","message":{"role":"user","content":"child consumed"}}\n' >> "$parent_transcript"
elif [[ "${FAKE_CLAUDE_CHILD_MODE:-}" == "pending" ]]; then
  child="$child_dir/agent-pending.jsonl"
  printf '{"type":"assistant","message":{"role":"assistant","stop_reason":"end_turn","content":[{"type":"text","text":"salvage this child report"}]}}\n' > "$child"
  sleep 60
fi

if [[ "${FAKE_CLAUDE_HANG:-}" == "1" ]]; then
  sleep 60
fi

if [[ "${FAKE_CLAUDE_BACKGROUND_WRITER:-}" == "1" ]]; then
  (
    trap '' TERM
    while :; do
      printf 'background writer still owns stdout\n'
      sleep 1
    done
  ) &
fi

printf '{"type":"assistant","message":{"role":"assistant","stop_reason":"end_turn","content":[{"type":"text","text":"fake claude final"}]}}\n' >> "$parent_transcript"
printf '{"type":"result","subtype":"success","result":"fake claude final","session_id":"%s"}\n' "$session_id"
EOF

  chmod +x "$fakebin/codex" "$fakebin/claude"
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

test_claude_stream_and_continue_contract() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude"
  local claude_home="$TMP_DIR/claude-home"
  local prompt="$TMP_DIR/claude-prompt.txt"
  local prompt_capture="$TMP_DIR/claude-prompt-capture.txt"
  local output="$TMP_DIR/claude-output.txt"
  local monitor_output="$TMP_DIR/claude-monitor.txt"
  local continue_output="$TMP_DIR/claude-continue.txt"
  local direct_continue_output="$TMP_DIR/claude-direct-continue.txt"
  local run_dir_pointer="$TMP_DIR/claude-run-dir.txt"

  setup_workspace "$workspace"
  printf 'original\n' > "$workspace/mutable.txt"
  git -C "$workspace" add mutable.txt
  git -C "$workspace" commit -qm "add Claude fixture"
  printf 'claude prompt secret should stay out of command.txt\n' > "$prompt"

  CLAUDE_CONFIG_DIR="$claude_home" FAKE_CLAUDE_PROMPT_FILE="$prompt_capture" \
    FAKE_CLAUDE_MUTATE_FILE="$workspace/mutable.txt" PATH="$fakebin:$PATH" \
    bash "$CLAUDE_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/claude-runs" \
      --run-dir-file "$run_dir_pointer" \
      --prompt-file "$prompt" \
      --heartbeat 1 \
      --stall-timeout 5 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir session_id
  run_dir="$(extract_run_dir "$output")"
  [[ "$(cat "$run_dir_pointer")" == "$run_dir" ]] || fail "Claude run-dir pointer did not match"
  session_id="$(jq -r .session_id "$run_dir/status.json")"
  assert_private_file "$run_dir/status.json"
  assert_private_file "$run_dir/prompt.txt"
  assert_private_file "$run_dir/command.txt"
  assert_executable_private "$run_dir/monitor.sh"
  assert_executable_private "$run_dir/continue.sh"
  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/status.json" "\"run_dir_file\": \"$run_dir_pointer\""
  assert_contains "$run_dir/status.env" "run_dir_file=$run_dir_pointer"
  assert_contains "$run_dir/run.env" "RUN_DIR_FILE=$run_dir_pointer"
  assert_contains "$output" "run_dir_file=$run_dir_pointer"
  assert_contains "$run_dir/final.md" "fake claude final"
  assert_contains "$run_dir/command.txt" "claude -p --output-format stream-json"
  assert_not_contains "$run_dir/command.txt" "claude prompt secret"
  assert_not_contains "$run_dir/command.txt" "tmux"
  assert_contains "$run_dir/workspace.diff" "mutated by fake Claude"
  cmp "$prompt" "$prompt_capture" >/dev/null || fail "Claude prompt transport changed content"

  CLAUDE_CONFIG_DIR="$claude_home" bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  assert_contains "$monitor_output" "monitor=done state=finished"

  CLAUDE_CONFIG_DIR="$claude_home" PATH="$fakebin:$PATH" bash "$run_dir/continue.sh" \
    --prompt "continue exact fake Claude session" \
    --dry-run \
    > "$continue_output" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/command.txt" "--resume $session_id"
  assert_contains "$continue_dir/run.env" "SESSION_ID=$session_id"

  CLAUDE_CONFIG_DIR="$claude_home" PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" run \
    --continue-run "$run_dir" \
    --prompt "direct continuation must resume" \
    --dry-run \
    > "$direct_continue_output" 2>&1
  local direct_continue_dir
  direct_continue_dir="$(extract_run_dir "$direct_continue_output")"
  assert_contains "$direct_continue_dir/command.txt" "--resume $session_id"

  pass "Claude headless runner preserves streams, artifacts, and exact continuation"
}

test_claude_monitor_detects_abandoned_wrapper() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-monitor-abandoned"
  local output="$TMP_DIR/claude-monitor-abandoned-output.txt"
  local monitor_output="$TMP_DIR/claude-monitor-abandoned-monitor.txt"
  local timeout_output="$TMP_DIR/claude-monitor-timeout-monitor.txt"

  setup_workspace "$workspace"
  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-monitor-abandoned-home" PATH="$fakebin:$PATH" \
    bash "$CLAUDE_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/claude-monitor-abandoned-runs" \
      --prompt "prepare monitor fixture" \
      --dry-run \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  python3 - "$run_dir/status.json" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data.update(state="running", health="active", exit_code=None, wrapper_pid=99999999)
path.write_text(json.dumps(data))
PY
  set +e
  CLAUDE_MONITOR_POLL_SECONDS=1 bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "1" ]] || fail "expected abandoned monitor exit 1, got $status"
  assert_contains "$monitor_output" "monitor=abandoned"

  python3 - "$run_dir/status.json" "$$" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data.update(state="running", health="active", exit_code=None, wrapper_pid=int(sys.argv[2]))
path.write_text(json.dumps(data))
PY
  set +e
  CLAUDE_MONITOR_TIMEOUT_SECONDS=1 CLAUDE_MONITOR_POLL_SECONDS=1 \
    bash "$run_dir/monitor.sh" > "$timeout_output" 2>&1
  status=$?
  set -e
  [[ "$status" == "124" ]] || fail "expected monitor self-timeout 124, got $status"
  assert_contains "$timeout_output" "monitor=timed-out"

  pass "Claude monitor stops for abandoned wrappers and its own deadline"
}

test_claude_reused_run_dir_clears_stale_state() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-reused-run-dir"
  local run_dir="$TMP_DIR/claude-reused-run-dir"
  local output="$TMP_DIR/claude-reused-run-dir-output.txt"

  setup_workspace "$workspace"
  mkdir -p "$run_dir/child-reports"
  printf 'stale\n' > "$run_dir/.stalled"
  printf 'stale\n' > "$run_dir/.hard-timeout"
  printf 'stale\n' > "$run_dir/child-reports/stale.md"
  mkfifo "$run_dir/.stdout.pipe" "$run_dir/.stderr.pipe"

  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-reused-run-dir-home" PATH="$fakebin:$PATH" \
    bash "$CLAUDE_RUN" run \
      --workspace "$workspace" \
      --run-dir "$run_dir" \
      --prompt "fresh run in reused artifact directory" \
      --heartbeat 1 \
      --timeout 10 \
      > "$output" 2>&1

  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_not_exists "$run_dir/.stalled"
  assert_not_exists "$run_dir/.hard-timeout"
  assert_not_exists "$run_dir/child-reports/stale.md"

  pass "Claude reused run directories clear stale markers, pipes, and child reports"
}

test_claude_background_writer_does_not_hold_wrapper_open() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-background-writer"
  local output="$TMP_DIR/claude-background-writer-output.txt"

  setup_workspace "$workspace"
  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-background-writer-home" FAKE_CLAUDE_BACKGROUND_WRITER=1 \
    CLAUDE_TERM_GRACE_SECONDS=1 PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/claude-background-writer-runs" \
      --prompt "do not inherit the stream forever" \
      --heartbeat 1 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "finished"'

  pass "Claude runner closes inherited stream writers after the main process exits"
}

test_claude_review_denies_direct_edit_tools() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-review"
  local output="$TMP_DIR/claude-review-output.txt"

  setup_workspace "$workspace"
  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-review-home" PATH="$fakebin:$PATH" \
    bash "$CLAUDE_RUN" review \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/claude-review-runs" \
      --prompt "review without direct edits" \
      --dry-run \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/command.txt" "--disallowed-tools Edit\\,Write\\,NotebookEdit"
  assert_contains "$run_dir/run.env" "READ_ONLY=true"

  pass "Claude review mode denies direct editing tools"
}

test_claude_child_transcript_activity_prevents_false_stall() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-child-active"
  local output="$TMP_DIR/claude-child-active-output.txt"

  setup_workspace "$workspace"
  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-child-active-home" FAKE_CLAUDE_CHILD_MODE=active \
    PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/claude-child-active-runs" \
      --read-only \
      --prompt "wait for one active child" \
      --heartbeat 1 \
      --stall-timeout 2 \
      --report-timeout 2 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_not_contains "$output" "event=stall"
  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/status.json" '"child_count": 1'
  assert_contains "$run_dir/status.json" '"completed_children": 1'
  assert_contains "$run_dir/child-reports/agent-active.md" "child active final"

  pass "Claude child transcript growth counts as meaningful activity"
}

test_claude_report_pending_stops_and_salvages_child_answer() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-report-pending"
  local output="$TMP_DIR/claude-report-pending-output.txt"

  setup_workspace "$workspace"
  set +e
  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-report-pending-home" FAKE_CLAUDE_CHILD_MODE=pending \
    PATH="$fakebin:$PATH" bash "$CLAUDE_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/claude-report-pending-runs" \
      --read-only \
      --prompt "parent never consumes child" \
      --heartbeat 1 \
      --stall-timeout 10 \
      --report-timeout 1 \
      --timeout 10 \
      > "$output" 2>&1
  local status=$?
  set -e

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  [[ "$status" == "124" ]] || fail "expected report-pending timeout 124, got $status"
  assert_contains "$output" "event=stall kind=report-pending"
  assert_contains "$run_dir/status.json" '"state": "stalled"'
  assert_contains "$run_dir/status.json" '"report_pending": true'
  assert_contains "$run_dir/child-reports/agent-pending.md" "salvage this child report"

  pass "Claude runner salvages a completed child report when its parent stalls"
}

test_claude_run_env_is_not_sourced() {
  local fakebin="$TMP_DIR/fakebin"
  local workspace="$TMP_DIR/workspace-claude-malicious"
  local prior="$TMP_DIR/claude-prior"
  local output="$TMP_DIR/claude-malicious-output.txt"
  local pwned="$TMP_DIR/claude-pwned"

  setup_workspace "$workspace"
  mkdir -p "$prior"
  {
    printf 'SESSION_ID=safe-claude-session\n'
    printf 'WORKSPACE=%q\n' "$workspace"
    printf 'RUN_ROOT=%q\n' "$TMP_DIR/claude-runs"
    printf 'PERMISSION_MODE=auto\nREAD_ONLY=false\nMODEL=\nEFFORT=\n'
    printf 'HEARTBEAT_SECONDS=1\nSTALL_TIMEOUT_SECONDS=2\nREPORT_TIMEOUT_SECONDS=1\nTIMEOUT_SECONDS=10\n'
    printf 'NO_SESSION_PERSISTENCE=false\n'
    printf 'EVIL=%s\n' "\$(touch $(printf '%q' "$pwned"))"
  } > "$prior/run.env"

  CLAUDE_CONFIG_DIR="$TMP_DIR/claude-malicious-home" PATH="$fakebin:$PATH" \
    bash "$CLAUDE_RUN" resume \
      --continue-run "$prior" \
      --prompt "safe follow-up" \
      --dry-run \
      > "$output" 2>&1

  assert_not_exists "$pwned"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/command.txt" "--resume safe-claude-session"

  pass "Claude headless runner parses continuation metadata without sourcing shell"
}

main() {
  local fakebin="$TMP_DIR/fakebin"
  write_fake_tools "$fakebin"
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
  test_claude_stream_and_continue_contract
  test_claude_monitor_detects_abandoned_wrapper
  test_claude_reused_run_dir_clears_stale_state
  test_claude_background_writer_does_not_hold_wrapper_open
  test_claude_review_denies_direct_edit_tools
  test_claude_child_transcript_activity_prevents_false_stall
  test_claude_report_pending_stops_and_salvages_child_answer
  test_claude_run_env_is_not_sourced
}

main "$@"
bash "$ROOT_DIR/scripts/test-composer-runner.sh"
