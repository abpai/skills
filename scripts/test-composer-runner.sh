#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPOSER_RUN="$ROOT_DIR/composer/skills/composer/bin/composer-run.sh"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/composer-runner.XXXXXX")"
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
  git -C "$workspace" config user.name "Composer Test"
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
if [[ "${1:-}" == "status" ]]; then
  if [[ "${FAKE_CURSOR_REQUIRE_KEY:-}" == "1" && -z "${CURSOR_API_KEY:-}" ]]; then
    printf '{"status":"unauthenticated","isAuthenticated":false}\n'
    exit 0
  fi
  if [[ "${FAKE_CURSOR_LOGGED_OUT:-}" == "1" && -z "${CURSOR_API_KEY:-}" ]]; then
    printf '{"status":"unauthenticated","isAuthenticated":false}\n'
  else
    printf '{"status":"authenticated","isAuthenticated":true}\n'
  fi
  exit 0
fi

session_id="cursor-session-123"
previous=""
prompt=""
for arg in "$@"; do
  if [[ "$previous" == "--resume" ]]; then session_id="$arg"; fi
  previous="$arg"
  prompt="$arg"
done
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
printf '{"type":"system","subtype":"init","session_id":"%s"}\n' "$session_id"
printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"fake cursor final"}]},"session_id":"%s"}\n' "$session_id"
printf '{"type":"result","subtype":"success","result":"fake cursor final","session_id":"%s"}\n' "$session_id"
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

  setup_workspace "$workspace"
  printf 'secret prompt content\n' > "$prompt"
  FAKE_CURSOR_PROMPT_FILE="$prompt_capture" FAKE_CURSOR_ARGV_FILE="$argv_capture" \
    FAKE_CURSOR_MUTATE_FILE="$workspace/tracked.txt" PATH="$FAKEBIN:$PATH" \
    "$COMPOSER_RUN" run \
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
  assert_contains "$run_dir/final.md" "fake cursor final"
  assert_contains "$run_dir/workspace.diff" "changed by Cursor"
  assert_contains "$run_dir/command.txt" "--force"
  assert_contains "$run_dir/command.txt" "--approve-mcps"
  assert_not_contains "$run_dir/command.txt" "--model"
  assert_not_contains "$run_dir/command.txt" "secret prompt content"
  cmp "$prompt" "$prompt_capture" >/dev/null || fail "prompt transport changed content"
  assert_not_contains "$output" '{"type":"system"'

  bash "$run_dir/monitor.sh" > "$monitor_output" 2>&1
  assert_contains "$monitor_output" "monitor=done state=finished"

  PATH="$FAKEBIN:$PATH" "$run_dir/continue.sh" \
    --prompt "continue exact session" \
    --dry-run \
    > "$continue_output" 2>&1
  local continue_dir
  continue_dir="$(extract_run_dir "$continue_output")"
  assert_contains "$continue_dir/command.txt" "--resume cursor-session-123"
  assert_not_contains "$continue_dir/command.txt" "--model"

  pass "Composer runner preserves artifacts, default-model selection, and exact resume"
}

test_review_is_read_only() {
  local workspace="$TMP_DIR/review-workspace"
  local output="$TMP_DIR/review-output.txt"
  setup_workspace "$workspace"

  PATH="$FAKEBIN:$PATH" "$COMPOSER_RUN" review \
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

  pass "Composer review uses ask mode without write preapproval"
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
    "$COMPOSER_RUN" run \
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

  printf 'CURSOR_API_KEY=explicit-secret\n' > "$env_file"
  env -u CURSOR_API_KEY FAKE_CURSOR_LOGGED_OUT=1 FAKE_CURSOR_REQUIRE_KEY=1 PATH="$FAKEBIN:$PATH" \
    "$COMPOSER_RUN" run \
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

  pass "Composer auth ignores ancestor env files and accepts explicit key files"
}

test_silent_run_stops_without_replay() {
  local workspace="$TMP_DIR/stall-workspace"
  local output="$TMP_DIR/stall-output.txt"
  local pid_file="$TMP_DIR/stall-agent.pid"
  setup_workspace "$workspace"

  set +e
  FAKE_CURSOR_HANG=1 FAKE_CURSOR_IGNORE_TERM=1 FAKE_CURSOR_PID_FILE="$pid_file" \
    COMPOSER_TERM_GRACE_SECONDS=1 PATH="$FAKEBIN:$PATH" "$COMPOSER_RUN" review \
    --workspace "$workspace" \
    --run-root "$TMP_DIR/stall-runs" \
    --prompt "hang once" \
    --heartbeat 1 \
    --stall-timeout 1 \
    --timeout 10 \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "124" ]] || fail "expected stall exit 124, got $status"
  local run_dir
  run_dir="$(extract_run_dir "$output")"
  assert_contains "$run_dir/status.json" '"state": "stalled"'
  assert_contains "$output" "event=stall kind=silent"
  local agent_pid
  agent_pid="$(cat "$pid_file")"
  if kill -0 "$agent_pid" 2>/dev/null; then
    fail "TERM-ignoring Cursor process survived stall cleanup: $agent_pid"
  fi

  pass "Composer runner kills silent process groups without replaying the prompt"
}

test_stream_artifacts_and_resume
test_review_is_read_only
test_auth_uses_only_explicit_sources
test_silent_run_stops_without_replay
