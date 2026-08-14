#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ANTIGRAVITY_RUN="$ROOT_DIR/antigravity/skills/antigravity/scripts/antigravity-run.sh"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/antigravity-runner.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[OK] $*"; }
assert_contains() { grep -F -- "$2" "$1" >/dev/null || fail "expected $1 to contain: $2"; }
assert_not_contains() { if grep -F -- "$2" "$1" >/dev/null; then fail "expected $1 not to contain: $2"; fi; }

extract_run_dir() {
  local path="$1" run_dir
  run_dir="$(grep -o 'run_dir=[^ ]*' "$path" | tail -1 | cut -d= -f2-)"
  run_dir="${run_dir#\'}"; run_dir="${run_dir%\'}"
  [[ -n "$run_dir" ]] || fail "could not extract run_dir from $path"
  printf '%s\n' "$run_dir"
}

setup_workspace() {
  local workspace="$1"
  mkdir -p "$workspace"
  git -C "$workspace" init -q
  git -C "$workspace" config user.email test@example.com
  git -C "$workspace" config user.name "Antigravity Test"
  printf 'base\n' > "$workspace/tracked.txt"
  git -C "$workspace" add tracked.txt
  git -C "$workspace" commit -qm fixture
}

FAKEBIN="$TMP_DIR/fakebin"
mkdir -p "$FAKEBIN"
cat > "$FAKEBIN/agy" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--version" ]]; then
  echo "agy fake 1.1.12"
  exit 0
fi
if [[ "${1:-}" == "models" ]]; then
  if [[ "${FAKE_AGY_MODELS_FAIL:-}" == "1" ]]; then
    echo "gemini-3.7-flash-high stale output"
    exit 9
  fi
  printf 'gemini-3.7-flash-high Gemini 3.7 Flash (High)\n'
  printf 'gemini-3.7-flash-medium Gemini 3.7 Flash (Medium)\n'
  exit 0
fi
if [[ "${1:-}" == "agents" ]]; then
  printf 'reviewer\n'
  exit 0
fi

conversation="agy-conversation-123"
model=""
effort=""
previous=""
prompt=""
print_value=""
for arg in "$@"; do
  case "$previous" in
    --conversation) conversation="$arg" ;;
    --model) model="$arg" ;;
    --effort) effort="$arg" ;;
    -p|--print|--prompt) print_value="$arg" ;;
  esac
  previous="$arg"
  prompt="$arg"
done
[[ "$print_value" == "$prompt" ]] || { echo "-p did not receive the final prompt" >&2; exit 64; }
[[ -z "${FAKE_AGY_ARGV_FILE:-}" ]] || printf '%s\n' "$*" > "$FAKE_AGY_ARGV_FILE"
[[ -z "${FAKE_AGY_PROMPT_FILE:-}" ]] || printf '%s' "$prompt" > "$FAKE_AGY_PROMPT_FILE"
[[ -z "${FAKE_AGY_CWD_FILE:-}" ]] || pwd > "$FAKE_AGY_CWD_FILE"

if [[ "${FAKE_AGY_HANG:-}" == "1" ]]; then
  trap '' TERM
  while :; do sleep 1; done
fi
if [[ -n "${FAKE_AGY_MUTATE_FILE:-}" ]]; then
  printf 'changed by Antigravity\n' > "$FAKE_AGY_MUTATE_FILE"
fi
if [[ -n "${FAKE_AGY_MUTATE_SOURCE_FILE:-}" ]]; then
  printf 'source changed during review\n' > "$FAKE_AGY_MUTATE_SOURCE_FILE"
fi
if [[ "${FAKE_AGY_MUTATE_CWD:-}" == "1" ]]; then
  printf 'changed inside isolated review\n' > tracked.txt
fi

printf '{"event":"init","conversation_id":"%s","init":{"cwd":"%s","permission_mode":"request-review"' "$conversation" "$PWD"
[[ -z "$model" ]] || printf ',"model":"%s"' "$model"
printf '}}\n'
if [[ "${FAKE_AGY_HANG_AFTER_INIT:-}" == "1" ]]; then
  trap '' TERM
  while :; do sleep 1; done
fi
printf '{"event":"step_update","step_update":{"conversation_id":"%s","step_index":1,"state":"DONE","step_type":"agent_response","text_delta":"fake progress"}}\n' "$conversation"
if [[ "${FAKE_AGY_STREAM_PERMISSION_DENIAL:-}" == "1" ]]; then
  printf '{"event":"step_update","step_update":{"conversation_id":"%s","step_index":2,"state":"DONE","step_type":"tool","tool_name":"run_command","tool_info":{"error":{"type":"TOOL_ERROR","message":"permission denied for command(test)"}}}}\n' "$conversation"
fi
if [[ "${FAKE_AGY_PERMISSION_DENIAL:-}" == "1" ]]; then
  echo "permission required but unavailable in headless mode" >&2
fi
status="${FAKE_AGY_RESULT_STATUS:-SUCCESS}"
error=""
[[ "$status" == "SUCCESS" ]] || error=",\"error\":\"fake failure\""
printf '{"event":"result","result":{"conversation_id":"%s","status":"%s","response":"fake antigravity final\\n"%s,"duration_seconds":1,"num_turns":1}}\n' "$conversation" "$status" "$error"
EOF
chmod +x "$FAKEBIN/agy"

test_success_artifacts_and_resume() {
  local workspace="$TMP_DIR/success-workspace"
  local prompt="$TMP_DIR/prompt.txt"
  local prompt_capture="$TMP_DIR/prompt-capture.txt"
  local argv_capture="$TMP_DIR/argv.txt"
  local pointer="$TMP_DIR/run-dir.txt"
  local output="$TMP_DIR/success-output.txt"
  local continue_output="$TMP_DIR/continue-output.txt"
  setup_workspace "$workspace"
  printf 'bounded secret prompt\n' > "$prompt"

  FAKE_AGY_PROMPT_FILE="$prompt_capture" FAKE_AGY_ARGV_FILE="$argv_capture" \
    FAKE_AGY_MUTATE_FILE="$workspace/tracked.txt" ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/runs" \
      --run-dir-file "$pointer" \
      --prompt-file "$prompt" \
      --model gemini-3.7-flash-high \
      --effort high \
      --allow-all \
      --sandbox \
      --heartbeat 1 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  [[ "$(cat "$pointer")" == "$run_dir" ]] || fail "run-dir pointer mismatch"
  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/status.json" '"conversation_id": "agy-conversation-123"'
  assert_contains "$run_dir/status.json" '"model": "gemini-3.7-flash-high"'
  assert_contains "$run_dir/status.json" '"result_status": "SUCCESS"'
  assert_contains "$run_dir/final.md" 'fake antigravity final'
  assert_contains "$run_dir/workspace.diff" 'changed by Antigravity'
  assert_contains "$run_dir/command.txt" '--dangerously-skip-permissions'
  assert_contains "$run_dir/command.txt" '--sandbox'
  assert_not_contains "$run_dir/command.txt" 'bounded secret prompt'
  cmp "$prompt" "$prompt_capture" >/dev/null || fail "prompt transport changed content"
  assert_not_contains "$output" '"event":"init"'
  bash "$run_dir/monitor.sh" > "$TMP_DIR/monitor.txt"
  assert_contains "$TMP_DIR/monitor.txt" 'monitor=done state=finished'

  ANTIGRAVITY_BIN="$FAKEBIN/agy" "$run_dir/continue.sh" \
    --prompt 'continue exact conversation' \
    --dry-run \
    > "$continue_output" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/command.txt" '--conversation agy-conversation-123'
  assert_contains "$continue_dir/command.txt" '--model gemini-3.7-flash-high'
  assert_contains "$continue_dir/command.txt" '--dangerously-skip-permissions'
  pass "Antigravity runner writes artifacts and resumes exact routing and authority"
}

test_review_isolation() {
  local workspace="$TMP_DIR/review-workspace-source"
  local output="$TMP_DIR/review-output.txt"
  local cwd_capture="$TMP_DIR/review-cwd.txt"
  setup_workspace "$workspace"
  printf 'source change\n' > "$workspace/tracked.txt"
  printf 'untracked review context\n' > "$workspace/context.txt"

  FAKE_AGY_CWD_FILE="$cwd_capture" FAKE_AGY_MUTATE_CWD=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" review \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/review-runs" \
      --prompt 'findings first' \
      --heartbeat 1 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir review_cwd
  run_dir="$(extract_run_dir "$output")"
  review_cwd="$(cat "$cwd_capture")"
  local expected_review_cwd
  expected_review_cwd="$(cd "$run_dir/review-workspace" && pwd -P)"
  [[ "$review_cwd" == "$expected_review_cwd" ]] || fail "review did not run in isolated clone (expected $expected_review_cwd, got $review_cwd)"
  [[ "$(cat "$workspace/tracked.txt")" == 'source change' ]] || fail "source workspace was mutated"
  [[ -f "$review_cwd/context.txt" ]] || fail "untracked review context missing from clone"
  assert_contains "$run_dir/status.json" '"review_isolated": true'
  assert_contains "$run_dir/status.json" '"state": "finished"'
  cmp "$run_dir/source-status-before.txt" "$run_dir/source-status-after.txt" >/dev/null || fail "source status drifted during review"

  ANTIGRAVITY_BIN="$FAKEBIN/agy" "$run_dir/continue.sh" \
    --prompt 'continue review' --dry-run > "$TMP_DIR/review-continue.txt" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$TMP_DIR/review-continue.txt")"
  assert_contains "$continue_dir/status.json" '"review_isolated": true'
  pass "Review mode isolates writes and preserves tracked and untracked context"
}

test_permission_denial_fails_closed() {
  local workspace="$TMP_DIR/denial-workspace"
  local output="$TMP_DIR/denial-output.txt"
  setup_workspace "$workspace"
  set +e
  FAKE_AGY_PERMISSION_DENIAL=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run --workspace "$workspace" --run-root "$TMP_DIR/denial-runs" \
      --prompt 'run a denied command' --heartbeat 1 --timeout 10 > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "1" ]] || fail "permission denial should exit 1, got $code"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "failed"'
  assert_contains "$run_dir/status.json" '"denial_count": 1'
  pass "Headless permission denials fail closed even after a SUCCESS result"
}

test_non_success_result_fails_closed() {
  local workspace="$TMP_DIR/error-workspace"
  local output="$TMP_DIR/error-output.txt"
  setup_workspace "$workspace"
  set +e
  FAKE_AGY_RESULT_STATUS=ERROR ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run --workspace "$workspace" --run-root "$TMP_DIR/error-runs" \
      --prompt 'fail the task' --heartbeat 1 --timeout 10 > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "1" ]] || fail "ERROR result should exit 1, got $code"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"result_status": "ERROR"'
  assert_contains "$run_dir/status.json" '"result_error": "fake failure"'
  pass "Non-success Antigravity results fail closed"
}

test_stall_terminates_process_group() {
  local workspace="$TMP_DIR/stall-workspace"
  local output="$TMP_DIR/stall-output.txt"
  setup_workspace "$workspace"
  set +e
  ANTIGRAVITY_TERM_GRACE_SECONDS=1 FAKE_AGY_HANG=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run --workspace "$workspace" --run-root "$TMP_DIR/stall-runs" \
      --prompt 'hang' --heartbeat 1 --stall-timeout 1 --timeout 10 > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "124" ]] || fail "stalled run should exit 124, got $code"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "stalled"'
  pass "Silent Antigravity runs terminate at the inactivity boundary"
}

test_unknown_model_is_rejected_before_spawn() {
  local workspace="$TMP_DIR/model-workspace"
  local output="$TMP_DIR/model-output.txt"
  setup_workspace "$workspace"
  set +e
  ANTIGRAVITY_BIN="$FAKEBIN/agy" "$ANTIGRAVITY_RUN" run \
    --workspace "$workspace" --run-root "$TMP_DIR/model-runs" --prompt hi \
    --model gemini-made-up > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "2" ]] || fail "unknown model should exit 2, got $code"
  assert_contains "$output" 'unknown --model gemini-made-up'
  pass "Unknown model slugs are rejected before launch"
}

test_direct_conversation_is_preserved() {
  local workspace="$TMP_DIR/direct-conversation-workspace"
  local output="$TMP_DIR/direct-conversation-output.txt"
  setup_workspace "$workspace"
  ANTIGRAVITY_BIN="$FAKEBIN/agy" "$ANTIGRAVITY_RUN" run \
    --workspace "$workspace" --run-root "$TMP_DIR/direct-conversation-runs" \
    --prompt continue --conversation direct-conversation-456 > "$output" 2>&1
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/command.txt" '--conversation direct-conversation-456'
  assert_contains "$run_dir/status.json" '"conversation_id": "direct-conversation-456"'
  pass "Direct run --conversation preserves the exact conversation"
}

test_preflight_failures_publish_terminal_status() {
  local workspace="$TMP_DIR/preflight-workspace"
  local output="$TMP_DIR/preflight-output.txt"
  local pointer="$TMP_DIR/preflight.pointer"
  setup_workspace "$workspace"
  set +e
  ANTIGRAVITY_BIN="$TMP_DIR/missing-agy" "$ANTIGRAVITY_RUN" run \
    --workspace "$workspace" --run-root "$TMP_DIR/preflight-runs" \
    --run-dir-file "$pointer" --prompt hi > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "127" ]] || fail "missing CLI should exit 127, got $code"
  local run_dir
  run_dir="$(cat "$pointer")"
  assert_contains "$run_dir/status.json" '"state": "failed"'
  [[ -x "$run_dir/monitor.sh" ]] || fail "preflight failure did not publish monitor"
  set +e
  "$run_dir/monitor.sh" > "$TMP_DIR/preflight-monitor.txt" 2>&1
  local monitor_code=$?
  set -e
  [[ "$monitor_code" == "127" ]] || fail "preflight monitor should exit 127, got $monitor_code"

  set +e
  FAKE_AGY_MODELS_FAIL=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" "$ANTIGRAVITY_RUN" run \
    --workspace "$workspace" --run-root "$TMP_DIR/model-probe-runs" \
    --prompt hi --model gemini-3.7-flash-high > "$TMP_DIR/model-probe-output.txt" 2>&1
  local model_code=$?
  set -e
  [[ "$model_code" == "2" ]] || fail "failed model probe should exit 2, got $model_code"
  local model_run_dir
  model_run_dir="$(extract_run_dir "$TMP_DIR/model-probe-output.txt")"
  assert_contains "$model_run_dir/status.json" '"state": "failed"'
  pass "Preflight failures publish terminal status and finite monitors"
}

test_stream_denial_fails_closed() {
  local workspace="$TMP_DIR/stream-denial-workspace"
  local output="$TMP_DIR/stream-denial-output.txt"
  setup_workspace "$workspace"
  set +e
  FAKE_AGY_STREAM_PERMISSION_DENIAL=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run --workspace "$workspace" --run-root "$TMP_DIR/stream-denial-runs" \
      --prompt denied > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "1" ]] || fail "stream denial should exit 1, got $code"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"denial_count": 1'
  pass "Permission denials in stream tool errors fail closed"
}

test_hard_timeout() {
  local workspace="$TMP_DIR/hard-timeout-workspace"
  local output="$TMP_DIR/hard-timeout-output.txt"
  setup_workspace "$workspace"
  set +e
  ANTIGRAVITY_TERM_GRACE_SECONDS=1 FAKE_AGY_HANG=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run --workspace "$workspace" --run-root "$TMP_DIR/hard-timeout-runs" \
      --prompt hang --heartbeat 1 --stall-timeout 0 --timeout 1 > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "124" ]] || fail "hard timeout should exit 124, got $code"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "timed-out"'
  pass "Overall deadlines terminate active Antigravity runs"
}

test_review_source_drift_fails_closed() {
  local workspace="$TMP_DIR/source-drift-workspace"
  local output="$TMP_DIR/source-drift-output.txt"
  setup_workspace "$workspace"
  set +e
  FAKE_AGY_MUTATE_SOURCE_FILE="$workspace/tracked.txt" ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" review --workspace "$workspace" --run-root "$TMP_DIR/source-drift-runs" \
      --prompt review > "$output" 2>&1
  local code=$?
  set -e
  [[ "$code" == "1" ]] || fail "source drift should exit 1, got $code"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" 'source workspace changed during isolated review'
  pass "Review mode fails when the source workspace changes"
}

test_signal_preserves_conversation_for_continue() {
  local workspace="$TMP_DIR/signal-workspace"
  local output="$TMP_DIR/signal-output.txt"
  local pointer="$TMP_DIR/signal.pointer"
  setup_workspace "$workspace"
  ANTIGRAVITY_TERM_GRACE_SECONDS=1 FAKE_AGY_HANG_AFTER_INIT=1 ANTIGRAVITY_BIN="$FAKEBIN/agy" \
    "$ANTIGRAVITY_RUN" run --workspace "$workspace" --run-root "$TMP_DIR/signal-runs" \
      --run-dir-file "$pointer" --prompt interrupt --heartbeat 1 --timeout 30 > "$output" 2>&1 &
  local wrapper_pid=$!
  local attempt run_dir=""
  for ((attempt=0; attempt<50; attempt++)); do
    [[ -f "$pointer" ]] && run_dir="$(cat "$pointer")"
    if [[ -n "$run_dir" && -s "$run_dir/events.jsonl" ]]; then break; fi
    sleep 0.1
  done
  [[ -n "$run_dir" && -s "$run_dir/events.jsonl" ]] || fail "signal fixture never emitted init event"
  kill -TERM "$wrapper_pid"
  set +e
  wait "$wrapper_pid"
  local code=$?
  set -e
  [[ "$code" == "143" ]] || fail "interrupted wrapper should exit 143, got $code"
  assert_contains "$run_dir/status.json" '"state": "interrupted"'
  assert_contains "$run_dir/status.json" '"conversation_id": "agy-conversation-123"'
  assert_contains "$run_dir/run.env" 'CONVERSATION_ID=agy-conversation-123'
  ANTIGRAVITY_BIN="$FAKEBIN/agy" "$run_dir/continue.sh" --prompt continue --dry-run > "$TMP_DIR/signal-continue.txt" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$TMP_DIR/signal-continue.txt")"
  assert_contains "$continue_dir/command.txt" '--conversation agy-conversation-123'
  pass "Signals preserve emitted conversation IDs for exact continuation"
}

test_success_artifacts_and_resume
test_review_isolation
test_permission_denial_fails_closed
test_non_success_result_fails_closed
test_stall_terminates_process_group
test_unknown_model_is_rejected_before_spawn
test_direct_conversation_is_preserved
test_preflight_failures_publish_terminal_status
test_stream_denial_fails_closed
test_hard_timeout
test_review_source_drift_fails_closed
test_signal_preserves_conversation_for_continue

echo "All Antigravity runner tests passed."
