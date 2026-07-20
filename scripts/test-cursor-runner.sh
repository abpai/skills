#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CURSOR_RUN="$ROOT_DIR/cursor/skills/cursor/bin/cursor-run.sh"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cursor-runner.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[OK] $*"; }
assert_contains() { grep -F -- "$2" "$1" >/dev/null || fail "expected $1 to contain: $2"; }
assert_not_contains() { if grep -F -- "$2" "$1" >/dev/null; then fail "expected $1 not to contain: $2"; fi; }
assert_not_contains_ci() { if grep -Eiq -- "$2" "$1"; then fail "expected $1 not to contain (case-insensitive): $2"; fi; }
assert_count() { [[ "$(grep -Fc -- "$2" "$1")" == "$3" ]] || fail "expected $1 to contain $3 occurrence(s) of: $2"; }

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
  git -C "$workspace" config user.name "Cursor Test"
  printf 'base\n' > "$workspace/tracked.txt"
  git -C "$workspace" add tracked.txt
  git -C "$workspace" commit -qm "fixture"
}

FAKEBIN="$TMP_DIR/fakebin"
mkdir -p "$FAKEBIN"
cat > "$FAKEBIN/agent" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--version" ]]; then
  echo "agent fake 1.0"
  exit 0
fi
if [[ "${1:-}" == "models" ]]; then
  if [[ "${FAKE_CURSOR_UNREADABLE_MODELS:-}" == "1" ]]; then
    echo "models unavailable" >&2
    exit 1
  fi
  printf 'auto - Auto (default)\ntest-model - Test Model\ncursor-grok-4.5-high - Cursor Grok 4.5 High\n'
  exit 0
fi
if [[ "${1:-}" == "status" ]]; then
  if [[ "${FAKE_CURSOR_CRASH_ON_STATUS:-}" == "1" ]]; then
    kill -SEGV "$$"
  fi
  if [[ "${FAKE_CURSOR_REQUIRE_KEY:-}" == "1" && -z "${CURSOR_API_KEY:-}" ]]; then
    printf '{"status":"unauthenticated","isAuthenticated":false}\n'
    exit 0
  fi
  if [[ "${FAKE_CURSOR_LOGGED_OUT:-}" == "1" && -z "${CURSOR_API_KEY:-}" ]]; then
    printf '{"status":"unauthenticated","isAuthenticated":false}\n'
  else
    printf '{"status":"authenticated","isAuthenticated":true,"email":"private@example.com"}\n'
  fi
  exit 0
fi

session_id="cursor-session-123"
previous=""
prompt=""
requested_model=""
for arg in "$@"; do
  if [[ "$previous" == "--resume" ]]; then session_id="$arg"; fi
  if [[ "$previous" == "--model" ]]; then requested_model="$arg"; fi
  previous="$arg"
  prompt="$arg"
done
resolved_model="${FAKE_CURSOR_RESOLVED_MODEL:-cursor-auto-standard}"
[[ -z "$requested_model" ]] || resolved_model="${FAKE_CURSOR_RESOLVED_MODEL:-$requested_model}"
[[ -z "${FAKE_CURSOR_ARGV_FILE:-}" ]] || printf '%s\n' "$*" > "$FAKE_CURSOR_ARGV_FILE"
[[ -z "${FAKE_CURSOR_PROMPT_FILE:-}" ]] || printf '%s' "$prompt" > "$FAKE_CURSOR_PROMPT_FILE"
if [[ "${FAKE_CURSOR_REQUIRE_KEY:-}" == "1" && -z "${CURSOR_API_KEY:-}" ]]; then
  echo "missing key" >&2
  exit 7
fi
if [[ -n "${FAKE_CURSOR_MUTATE_FILE:-}" ]]; then
  printf 'changed by Cursor\n' > "$FAKE_CURSOR_MUTATE_FILE"
fi
if [[ "${FAKE_CURSOR_HANG:-}" == "1" ]]; then
  [[ -z "${FAKE_CURSOR_PID_FILE:-}" ]] || printf '%s' "$$" > "$FAKE_CURSOR_PID_FILE"
  [[ "${FAKE_CURSOR_IGNORE_TERM:-}" != "1" ]] || trap '' TERM
  while :; do sleep 1; done
fi
if [[ "${FAKE_CURSOR_FAIL_AFTER_SPAWN:-}" == "1" ]]; then
  echo "Cannot use this model: bogus. Available models: auto, test-model" >&2
  exit 1
fi
printf '{"type":"system","subtype":"init","session_id":"%s","model":"%s"}\n' "$session_id" "$resolved_model"
if [[ "${FAKE_CURSOR_WITH_PROGRESS:-}" == "1" ]]; then
  printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"fake cursor progress"}]},"session_id":"%s"}\n' "$session_id"
fi
printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"fake cursor final"}]},"session_id":"%s"}\n' "$session_id"
# Cursor's result can aggregate progress plus the final answer; final.md should
# retain only the terminal assistant answer when that complete message exists.
printf '{"type":"result","subtype":"success","result":"fake cursor progressfake cursor final","session_id":"%s"}\n' "$session_id"
EOF
chmod +x "$FAKEBIN/agent"

test_stream_artifacts_and_resume() {
  local workspace="$TMP_DIR/workspace"
  local prompt="$TMP_DIR/prompt.txt"
  local prompt_capture="$TMP_DIR/prompt-capture.txt"
  local argv_capture="$TMP_DIR/argv.txt"
  local pointer="$TMP_DIR/run-dir.txt"
  local output="$TMP_DIR/run-output.txt"
  local monitor_output="$TMP_DIR/monitor-output.txt"
  local continue_output="$TMP_DIR/continue-output.txt"
  local retry_output="$TMP_DIR/retry-output.txt"

  setup_workspace "$workspace"
  printf 'secret prompt content\n' > "$prompt"
  FAKE_CURSOR_PROMPT_FILE="$prompt_capture" FAKE_CURSOR_ARGV_FILE="$argv_capture" \
    FAKE_CURSOR_RESOLVED_MODEL="cursor-auto-standard" \
    FAKE_CURSOR_WITH_PROGRESS=1 \
    FAKE_CURSOR_MUTATE_FILE="$workspace/tracked.txt" PATH="$FAKEBIN:$PATH" \
    "$CURSOR_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/runs" \
      --run-dir-file "$pointer" \
      --prompt-file "$prompt" \
      --heartbeat 1 \
      --timeout 10 \
      > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  [[ "$(cat "$pointer")" == "$run_dir" ]] || fail "run-dir pointer mismatch"
  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/status.json" '"session_id": "cursor-session-123"'
  assert_contains "$run_dir/status.json" '"model": "cursor-auto-standard"'
  assert_contains "$run_dir/status.json" '"requested_model": ""'
  assert_contains "$run_dir/status.env" 'model=cursor-auto-standard'
  assert_contains "$run_dir/status.env" 'requested_model='
  assert_contains "$run_dir/final.md" "fake cursor final"
  assert_not_contains "$run_dir/final.md" "fake cursor progress"
  assert_contains "$run_dir/status.json" '"runner_log":'
  assert_contains "$run_dir/runner.log" 'state=finished health=finished exit_code=0'
  assert_contains "$run_dir/preflight.log" 'status_probe=authenticated'
  assert_not_contains "$run_dir/preflight.log" 'private@example.com'
  assert_contains "$run_dir/workspace.diff" "changed by Cursor"
  assert_contains "$run_dir/command.txt" "--force"
  assert_contains "$run_dir/command.txt" "--approve-mcps"
  assert_not_contains "$run_dir/command.txt" "--model"
  assert_not_contains "$run_dir/command.txt" "secret prompt content"
  cmp "$prompt" "$prompt_capture" >/dev/null || fail "prompt transport changed content"
  assert_not_contains "$output" '{"type":"system"'
  assert_count "$output" '[cursor-run] event=model model=cursor-auto-standard' 1

  bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  assert_contains "$monitor_output" "monitor=done state=finished"
  assert_contains "$monitor_output" "model=cursor-auto-standard"

  PATH="$FAKEBIN:$PATH" "$run_dir/continue.sh" \
    --prompt "continue exact session" \
    --dry-run \
    > "$continue_output" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/command.txt" "--resume cursor-session-123"
  assert_not_contains "$continue_dir/command.txt" "--model"

  PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" review \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/runs" \
    --run-dir-file "$pointer" \
    --prompt "retry with the same pointer" \
    --dry-run \
    > "$retry_output" 2>&1
  local retry_dir
  retry_dir="$(extract_run_dir "$retry_output")"
  [[ "$(cat "$pointer")" == "$retry_dir" ]] || fail "latest run-dir pointer mismatch"
  assert_count "$pointer.history" "$run_dir" 1
  assert_count "$pointer.history" "$retry_dir" 1

  pass "Cursor runner omits the model for default runs and exact resumes"
}

test_explicit_model_override_continues() {
  local workspace="$TMP_DIR/model-workspace"
  local output="$TMP_DIR/model-output.txt"
  local continue_output="$TMP_DIR/model-continue-output.txt"

  setup_workspace "$workspace"
  FAKE_CURSOR_RESOLVED_MODEL="cursor-override-resolved" PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" run \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/model-runs" \
    --prompt "use an explicitly selected model" \
    --model "test-model" \
    --heartbeat 1 \
    --timeout 10 \
    > "$output" 2>&1

  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/command.txt" "--model test-model"
  assert_contains "$run_dir/run.env" 'MODEL=test-model'
  assert_contains "$run_dir/status.json" '"model": "cursor-override-resolved"'
  assert_contains "$run_dir/status.json" '"requested_model": "test-model"'
  assert_contains "$run_dir/status.env" 'model=cursor-override-resolved'
  assert_contains "$run_dir/status.env" 'requested_model=test-model'
  assert_count "$output" '[cursor-run] event=model model=cursor-override-resolved' 1

  PATH="$FAKEBIN:$PATH" "$run_dir/continue.sh" \
    --prompt "continue with the explicit model" \
    --dry-run \
    > "$continue_output" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/command.txt" "--resume cursor-session-123"
  assert_contains "$continue_dir/command.txt" "--model test-model"
  assert_contains "$continue_dir/run.env" 'MODEL=test-model'
  assert_contains "$continue_dir/status.json" '"model": ""'
  assert_contains "$continue_dir/status.json" '"requested_model": "test-model"'

  pass "Cursor runner preserves explicit model overrides on exact resumes"
}

test_unknown_model_is_rejected_before_spawn() {
  local workspace="$TMP_DIR/unknown-model-workspace"
  local output="$TMP_DIR/unknown-model-output.txt"
  local fallthrough_output="$TMP_DIR/unreadable-models-output.txt"
  setup_workspace "$workspace"

  set +e
  PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" run \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/unknown-model-runs" \
    --prompt "guessing a model alias should not cost a run" \
    --model "grok" \
    --dry-run \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "2" ]] || fail "expected unknown-model exit 2, got $status"
  assert_contains "$output" "[FAIL] unknown --model grok"
  assert_contains "$output" "cursor-grok-4.5-high"
  assert_contains "$output" "Omit --model to use the model already selected in Cursor."
  assert_not_contains "$output" "event=spawn"

  # An unreadable model list must never block a run Cursor would have accepted.
  FAKE_CURSOR_UNREADABLE_MODELS=1 PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" run \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/unreadable-models-runs" \
    --prompt "unverifiable model list falls through to Cursor" \
    --model "some-future-model" \
    --dry-run \
    > "$fallthrough_output" 2>&1
  local fallthrough_dir
  fallthrough_dir="$(extract_run_dir "$fallthrough_output")"
  assert_contains "$fallthrough_dir/command.txt" "--model some-future-model"

  pass "Cursor runner rejects unknown models pre-spawn and fails open when unverifiable"
}

test_failed_run_surfaces_stderr_reason() {
  local workspace="$TMP_DIR/stderr-reason-workspace"
  local output="$TMP_DIR/stderr-reason-output.txt"
  setup_workspace "$workspace"

  set +e
  FAKE_CURSOR_FAIL_AFTER_SPAWN=1 PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" run \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/stderr-reason-runs" \
    --prompt "a run that dies before answering must say why" \
    --heartbeat 1 \
    --timeout 10 \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "1" ]] || fail "expected spawn failure exit 1, got $status"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "failed"'
  [[ ! -s "$run_dir/final.md" ]] || fail "expected an empty final.md for a run that never answered"
  assert_contains "$output" "event=failure-reason"
  assert_contains "$output" "[cursor-run] stderr| Cannot use this model: bogus."

  pass "Cursor runner echoes the stderr reason when a run dies before answering"
}

test_review_is_read_only() {
  local workspace="$TMP_DIR/review-workspace"
  local output="$TMP_DIR/review-output.txt"
  setup_workspace "$workspace"

  PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" review \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/review-runs" \
    --prompt "review only" \
    --dry-run \
    > "$output" 2>&1
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/command.txt" "--mode ask"
  assert_not_contains "$run_dir/command.txt" "--force"
  assert_not_contains "$run_dir/command.txt" "--approve-mcps"
  assert_contains "$run_dir/status.json" '"read_only": true'

  pass "Cursor review uses ask mode without write preapproval"
}

test_auth_uses_only_explicit_sources() {
  local parent="$TMP_DIR/auth-parent"
  local workspace="$parent/workspace"
  local output="$TMP_DIR/auth-fail-output.txt"
  local env_file="$TMP_DIR/cursor.env"
  local explicit_output="$TMP_DIR/auth-explicit-output.txt"
  setup_workspace "$workspace"
  printf 'CURSOR_API_KEY=ancestor-secret\n' > "$parent/.env"

  set +e
  env -u CURSOR_API_KEY -u CURSOR_ENV_FILE FAKE_CURSOR_LOGGED_OUT=1 PATH="$FAKEBIN:$PATH" \
    "$CURSOR_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/auth-fail-runs" \
      --prompt "must not crawl env" \
      --dry-run \
      > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "1" ]] || fail "expected auth failure, got $status"
  local failed_run_dir
  failed_run_dir="$(extract_run_dir "$output")"
  assert_contains "$failed_run_dir/status.json" '"state": "failed"'
  assert_contains "$output" "Workspace and ancestor .env files are not"
  assert_contains "$failed_run_dir/runner.log" "Cursor Agent CLI is not authenticated."

  printf 'CURSOR_API_KEY=explicit-secret\n' > "$env_file"
  env -u CURSOR_API_KEY FAKE_CURSOR_LOGGED_OUT=1 FAKE_CURSOR_REQUIRE_KEY=1 PATH="$FAKEBIN:$PATH" \
    "$CURSOR_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/auth-explicit-runs" \
      --auth api-key \
      --env-file "$env_file" \
      --prompt "explicit key only" \
      --dry-run \
      > "$explicit_output" 2>&1
  local explicit_run_dir
  explicit_run_dir="$(extract_run_dir "$explicit_output")"
  assert_contains "$explicit_run_dir/status.json" '"auth": "api-key"'
  assert_not_contains "$explicit_run_dir/preflight.log" "explicit-secret"

  pass "Cursor auth ignores ancestor env files and accepts explicit key files"
}

test_browser_auth_probe_hides_crash_diagnostics() {
  local workspace="$TMP_DIR/auth-probe-crash-workspace"
  local output="$TMP_DIR/auth-probe-crash-output.txt"
  setup_workspace "$workspace"

  set +e
  env -u CURSOR_API_KEY -u CURSOR_ENV_FILE FAKE_CURSOR_CRASH_ON_STATUS=1 PATH="$FAKEBIN:$PATH" \
    "$CURSOR_RUN" run \
      --workspace "$workspace" \
      --run-root "$TMP_DIR/auth-probe-crash-runs" \
      --prompt "fall back cleanly after a status probe crash" \
      --dry-run \
      > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "1" ]] || fail "expected auth failure after status probe crash, got $status"
  assert_not_contains_ci "$output" "segmentation fault"
  assert_not_contains_ci "$output" "core dumped"
  assert_contains "$output" "Cursor Agent CLI is not authenticated."
  assert_contains "$output" "Run \`agent login\`, export CURSOR_API_KEY"

  pass "Cursor auth probe hides crash diagnostics and keeps setup guidance"
}

test_silent_run_stops_without_replay() {
  local workspace="$TMP_DIR/stall-workspace"
  local output="$TMP_DIR/stall-output.txt"
  local pid_file="$TMP_DIR/stall-agent.pid"
  setup_workspace "$workspace"

  set +e
  FAKE_CURSOR_HANG=1 FAKE_CURSOR_IGNORE_TERM=1 FAKE_CURSOR_PID_FILE="$pid_file" \
    CURSOR_TERM_GRACE_SECONDS=1 PATH="$FAKEBIN:$PATH" "$CURSOR_RUN" review \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/stall-runs" \
    --prompt "hang once" \
    --heartbeat 1 \
    --stall-timeout 5 \
    --timeout 10 \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "124" ]] || fail "expected stall exit 124, got $status"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "stalled"'
  assert_contains "$output" "event=stall kind=silent"
  assert_contains "$output" "event=heartbeat progress_source=none"
  local agent_pid
  agent_pid="$(cat "$pid_file")"
  if kill -0 "$agent_pid" 2>/dev/null; then
    fail "TERM-ignoring Cursor process survived stall cleanup: $agent_pid"
  fi

  pass "Cursor runner kills silent process groups without replaying the prompt"
}

test_stream_artifacts_and_resume
test_explicit_model_override_continues
test_unknown_model_is_rejected_before_spawn
test_failed_run_surfaces_stderr_reason
test_review_is_read_only
test_auth_uses_only_explicit_sources
test_browser_auth_probe_hides_crash_diagnostics
test_silent_run_stops_without_replay
