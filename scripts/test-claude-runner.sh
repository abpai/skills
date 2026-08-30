#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CLAUDE_RUN="$ROOT_DIR/claude/skills/claude/scripts/claude-run.sh"

# Pre-commit exports GIT_* for the checkout it is validating. This suite builds
# independent repositories below TMP_DIR, so that inherited context redirects
# their fixture Git commands back to the checkout. No test needs a Git override;
# remove only inherited Git context before creating any fixture.
for git_env in "${!GIT_@}"; do
  unset "$git_env"
done

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claude-runner-test.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[OK] $*"; }
assert_contains() { grep -F -- "$2" "$1" >/dev/null || fail "expected $1 to contain: $2"; }
assert_not_contains() { if grep -F -- "$2" "$1" >/dev/null; then fail "expected $1 not to contain: $2"; fi; }

FAKEBIN="$TMP_DIR/fakebin"
WORKSPACE="$TMP_DIR/workspace"
CALLS="$TMP_DIR/claude-calls.log"
mkdir -p "$FAKEBIN" "$WORKSPACE"
WORKSPACE="$(cd "$WORKSPACE" && pwd -P)"

cat > "$FAKEBIN/claude" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

[[ "$PWD" == "${FAKE_EXPECT_WORKSPACE:?}" ]] || { echo "wrong workspace" >&2; exit 66; }
[[ "${FAKE_ENVELOPE:-}" == "same-runner-envelope" ]] || { echo "wrong environment" >&2; exit 67; }

if [[ "${1:-}" == "--version" ]]; then
  printf 'version\n' >> "${FAKE_CLAUDE_CALLS:?}"
  echo "Claude Code 2.1.0"
  exit 0
fi

if [[ "${1:-}" == "auth" && "${2:-}" == "status" && "${3:-}" == "--text" ]]; then
  printf 'auth\n' >> "${FAKE_CLAUDE_CALLS:?}"
  if [[ ! -t 0 || ! -t 1 ]]; then
    echo "credential store unavailable outside a PTY"
    exit 9
  fi
  case "${FAKE_AUTH_MODE:-valid}" in
    valid)
      echo "Authenticated as secret@example.test in secret-org token=token-super-secret"
      exit 0 ;;
    logged_out)
      echo "Not logged in"
      exit 1 ;;
    masked_logged_out)
      echo "Not logged in"
      exit 0 ;;
    credential_store)
      echo "Keychain user interaction not allowed for secret@example.test token=token-super-secret"
      exit 1 ;;
    hang)
      [[ -z "${FAKE_AUTH_PID_FILE:-}" ]] || printf '%s\n' "$$" > "$FAKE_AUTH_PID_FILE"
      trap '' TERM
      while :; do sleep 1; done ;;
    unknown)
      echo "opaque auth failure"
      exit 42 ;;
  esac
fi

if [[ "${1:-}" == "config" ]]; then
  printf 'unsupported-config-command\n' >> "${FAKE_CLAUDE_CALLS:?}"
  exit 99
fi

printf 'launch\n' >> "${FAKE_CLAUDE_CALLS:?}"
cat >/dev/null
printf '{"type":"system","subtype":"init","session_id":"fake-session","model":"%s"}\n' "${FAKE_RESOLVED_MODEL:-claude-resolved-test}"
printf '{"type":"result","subtype":"success","result":"%s","session_id":"fake-session"}\n' "${FAKE_FINAL:-fake final}"
EOF
chmod +x "$FAKEBIN/claude"

run_case() {
  local name="$1" auth_mode="$2" expected_exit="$3"
  shift 3
  local run_dir="$TMP_DIR/run-$name" output="$TMP_DIR/output-$name.log"
  : > "$CALLS"
  set +e
  FAKE_AUTH_MODE="$auth_mode" FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" "$@" bash "$CLAUDE_RUN" run \
      --workspace "$WORKSPACE" \
      --run-dir "$run_dir" \
      --prompt "bounded fake task" \
      --read-only \
      --heartbeat 1 \
      --timeout 5 \
      > "$output" 2>&1
  local actual_exit=$?
  set -e
  if [[ "$actual_exit" != "$expected_exit" ]]; then
    cat "$output" >&2
    fail "$name: expected exit $expected_exit, got $actual_exit"
  fi
  printf '%s\t%s\t%s\n' "$run_dir" "$output" "$CALLS"
}

test_authenticated_model_routing_and_redaction() {
  local run_dir="$TMP_DIR/run-success" output="$TMP_DIR/output-success.log" calls="$CALLS"
  : > "$CALLS"
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    FAKE_RESOLVED_MODEL=claude-actual-test PATH="$FAKEBIN:$PATH" \
    bash "$CLAUDE_RUN" run \
      --workspace "$WORKSPACE" \
      --run-dir "$run_dir" \
      --prompt "bounded fake task" \
      --read-only \
      --model claude-requested-test \
      --effort high \
      --heartbeat 1 \
      --timeout 5 \
      > "$output" 2>&1

  assert_contains "$run_dir/status.json" '"status": "authenticated"'
  assert_contains "$run_dir/status.json" '"requested_model": "claude-requested-test"'
  assert_contains "$run_dir/status.json" '"requested_effort": "high"'
  assert_contains "$run_dir/status.json" '"resolved_model": "claude-actual-test"'
  assert_contains "$run_dir/run.env" 'MODEL_SELECTION=explicit'
  assert_contains "$run_dir/run.env" 'EFFORT_SELECTION=explicit'
  assert_contains "$calls" 'version'
  assert_contains "$calls" 'auth'
  assert_contains "$calls" 'launch'
  assert_not_contains "$calls" 'unsupported-config-command'
  for secret in secret@example.test secret-org token-super-secret; do
    if grep -R -F -- "$secret" "$run_dir" >/dev/null 2>&1; then
      fail "sensitive auth output leaked into run artifacts: $secret"
    fi
    assert_not_contains "$output" "$secret"
  done

  local default_dir="$TMP_DIR/run-configured-default" default_output="$TMP_DIR/output-configured-default.log"
  : > "$CALLS"
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" run \
      --workspace "$WORKSPACE" --run-dir "$default_dir" \
      --prompt "configured defaults" --read-only --timeout 5 \
      > "$default_output" 2>&1
  assert_contains "$default_dir/status.json" '"requested_model": "configured-default"'
  assert_contains "$default_dir/status.json" '"requested_effort": "configured-default"'
  assert_not_contains "$default_dir/command.txt" '--model'
  assert_not_contains "$default_dir/command.txt" '--effort'
  pass "authenticated PTY preflight launches only after auth, records routing, and redacts auth output"
}

test_logged_out_fails_before_launch() {
  local row run_dir output calls
  row="$(run_case logged-out logged_out 78 env)"
  IFS=$'\t' read -r run_dir output calls <<< "$row"
  assert_contains "$run_dir/status.json" '"state": "failed"'
  assert_contains "$run_dir/status.json" '"status": "not_logged_in"'
  assert_not_contains "$calls" 'launch'
  assert_not_contains "$run_dir/status.json" '"state": "finished"'
  pass "real logged-out status fails closed before Claude launch"
}

test_masked_logged_out_output_cannot_succeed() {
  local row run_dir output calls
  row="$(run_case masked-logged-out masked_logged_out 78 env)"
  IFS=$'\t' read -r run_dir output calls <<< "$row"
  assert_contains "$run_dir/status.json" '"status": "not_logged_in"'
  assert_not_contains "$calls" 'launch'
  assert_not_contains "$run_dir/status.json" '"state": "finished"'
  pass "logged-out output cannot be masked by a successful auth command exit"
}

test_credential_store_denial_is_distinct() {
  local row run_dir output calls
  row="$(run_case credential-store credential_store 69 env)"
  IFS=$'\t' read -r run_dir output calls <<< "$row"
  assert_contains "$run_dir/status.json" '"status": "credential_store_unavailable"'
  assert_not_contains "$run_dir/status.json" '"status": "not_logged_in"'
  assert_not_contains "$calls" 'launch'
  for secret in secret@example.test token-super-secret; do
    if grep -R -F -- "$secret" "$run_dir" >/dev/null 2>&1; then
      fail "credential-store failure leaked sensitive output: $secret"
    fi
    assert_not_contains "$output" "$secret"
  done
  pass "credential-store denial is not misreported as logged out"
}

test_hanging_auth_is_terminated() {
  local pid_file="$TMP_DIR/hanging-auth.pid" row run_dir output calls started elapsed pid
  started="$(date +%s)"
  row="$(run_case hanging-auth hang 124 env FAKE_AUTH_PID_FILE="$pid_file" CLAUDE_PREFLIGHT_TIMEOUT_SECONDS=1)"
  elapsed=$(($(date +%s)-started))
  IFS=$'\t' read -r run_dir output calls <<< "$row"
  (( elapsed < 5 )) || fail "hanging auth exceeded bounded preflight: ${elapsed}s"
  assert_contains "$run_dir/status.json" '"status": "timed_out"'
  assert_not_contains "$calls" 'launch'
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    fail "hanging auth process survived preflight timeout: $pid"
  fi
  pass "hanging auth is terminated by the preflight deadline"
}

test_missing_and_indeterminate_preflights_fail() {
  local row run_dir output calls
  row="$(run_case indeterminate unknown 70 env)"
  IFS=$'\t' read -r run_dir output calls <<< "$row"
  assert_contains "$run_dir/status.json" '"status": "indeterminate"'
  assert_contains "$run_dir/status.json" '"state": "failed"'
  assert_not_contains "$calls" 'launch'

  local missing_dir="$TMP_DIR/run-missing" missing_output="$TMP_DIR/output-missing.log"
  set +e
  FAKE_EXPECT_WORKSPACE="$WORKSPACE" FAKE_ENVELOPE="same-runner-envelope" \
    CLAUDE_BIN=definitely-not-a-claude-binary PATH="$FAKEBIN:$PATH" \
    bash "$CLAUDE_RUN" run --workspace "$WORKSPACE" --run-dir "$missing_dir" \
      --prompt "missing cli" --read-only > "$missing_output" 2>&1
  local missing_exit=$?
  set -e
  [[ "$missing_exit" == "127" ]] || fail "missing CLI: expected 127, got $missing_exit"
  assert_contains "$missing_dir/status.json" '"status": "cli_missing"'
  assert_contains "$missing_dir/status.json" '"state": "failed"'
  pass "missing and indeterminate preflights cannot produce successful status"
}

test_review_runs_in_requested_workspace() {
  local run_dir="$TMP_DIR/run-review" output="$TMP_DIR/output-review.log"
  : > "$CALLS"
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$WORKSPACE" --run-dir "$run_dir" \
      --prompt "Review the current workspace. Findings first." --timeout 5 \
      > "$output" 2>&1

  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/command.txt" '--permission-mode auto'
  assert_not_contains "$run_dir/command.txt" '--disallowed-tools'
  assert_not_contains "$run_dir/command.txt" '--tools '
  assert_contains "$run_dir/run.env" 'READ_ONLY=false'
  [[ ! -e "$run_dir/review-workspace" ]] || fail "review created an isolated workspace"
  [[ ! -e "$run_dir/sharing-approval.json" ]] || fail "review created runner-owned approval metadata"
  [[ ! -e "$run_dir/evidence-access.json" ]] || fail "review created access-policing evidence"
  pass "review runs directly in the requested workspace"
}

test_strict_review_preserves_locked_down_controls() {
  local run_dir="$TMP_DIR/run-strict-review" output="$TMP_DIR/output-strict-review.log"
  : > "$CALLS"
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$WORKSPACE" --run-dir "$run_dir" \
      --permission-mode dontAsk --read-only \
      --tools Read,Glob,Grep,Bash \
      --allowed-tools 'Read,Glob,Grep,Bash(git diff:*),Bash(git status:*),Bash(git log:*),Bash(git show:*),Bash(rg:*)' \
      --prompt "Inspect the requested diff or report blocked." --timeout 5 \
      -- --restricted --strict-mcp-config --no-chrome \
      > "$output" 2>&1

  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/command.txt" '--permission-mode dontAsk'
  assert_contains "$run_dir/command.txt" '--tools Read\,Glob\,Grep\,Bash'
  assert_contains "$run_dir/command.txt" '--allowed-tools Read\,Glob\,Grep\,Bash\(git\ diff:\*\)\,Bash\(git\ status:\*\)\,Bash\(git\ log:\*\)\,Bash\(git\ show:\*\)\,Bash\(rg:\*\)'
  assert_contains "$run_dir/command.txt" '--disallowed-tools Edit\,Write\,NotebookEdit'
  assert_contains "$run_dir/command.txt" '--restricted'
  assert_contains "$run_dir/command.txt" '--strict-mcp-config'
  assert_contains "$run_dir/command.txt" '--no-chrome'
  assert_contains "$run_dir/run.env" 'READ_ONLY=true'
  pass "strict review preserves locked-down direct-workspace controls"
}

test_continued_strict_review_keeps_its_locked_down_surface() {
  local run_dir="$TMP_DIR/run-strict-first" output="$TMP_DIR/output-strict-first.log"
  local continued_dir="$TMP_DIR/run-strict-continued" continued_output="$TMP_DIR/output-strict-continued.log"
  : > "$CALLS"
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$WORKSPACE" --run-dir "$run_dir" \
      --permission-mode dontAsk --read-only \
      --tools Read,Glob,Grep,Bash \
      --allowed-tools 'Read,Glob,Grep,Bash(git diff:*),Bash(git status:*),Bash(rg:*)' \
      --prompt "First review turn." --timeout 5 \
      -- --restricted --strict-mcp-config --no-chrome \
      > "$output" 2>&1

  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" "$run_dir/continue.sh" \
      --run-dir "$continued_dir" --prompt "Second review turn." --dry-run \
      > "$continued_output" 2>&1

  assert_contains "$continued_dir/command.txt" '--permission-mode dontAsk'
  assert_contains "$continued_dir/command.txt" '--tools Read\,Glob\,Grep\,Bash'
  assert_contains "$continued_dir/command.txt" '--allowed-tools Read\,Glob\,Grep\,Bash\(git\ diff:\*\)\,Bash\(git\ status:\*\)\,Bash\(rg:\*\)'
  assert_contains "$continued_dir/command.txt" '--disallowed-tools Edit\,Write\,NotebookEdit'
  assert_contains "$continued_dir/command.txt" '--restricted'
  assert_contains "$continued_dir/command.txt" '--strict-mcp-config'
  assert_contains "$continued_dir/command.txt" '--no-chrome'
  assert_contains "$continued_dir/run.env" 'READ_ONLY=true'
  pass "continued strict review keeps its locked-down surface"
}

test_continue_resumes_exact_session_and_defaults() {
  local run_dir="$TMP_DIR/run-continuable" output="$TMP_DIR/output-continuable.log"
  local continued_dir="$TMP_DIR/run-continued" continued_output="$TMP_DIR/output-continued.log"
  : > "$CALLS"
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" run \
      --workspace "$WORKSPACE" --run-dir "$run_dir" --prompt "First turn." \
      --read-only --model claude-requested-test --effort high --timeout 5 \
      > "$output" 2>&1

  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" "$run_dir/continue.sh" \
      --run-dir "$continued_dir" --prompt "Second turn." --dry-run \
      > "$continued_output" 2>&1

  assert_contains "$continued_dir/command.txt" '--resume '
  assert_contains "$continued_dir/command.txt" '--model claude-requested-test'
  assert_contains "$continued_dir/command.txt" '--effort high'
  assert_contains "$continued_dir/run.env" 'READ_ONLY=true'
  assert_contains "$continued_dir/status.json" '"state": "dry-run"'
  pass "continue.sh resumes the exact session and preserves runner defaults"
}

test_empty_tool_arguments_are_explicit_or_rejected() {
  local output="$TMP_DIR/output-empty-tools.log"
  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review --workspace "$WORKSPACE" \
    --run-dir "$TMP_DIR/run-empty-tools" --prompt "bad tools" --allowed-tools "," \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "2" ]] || fail "ambiguous empty allowed-tools expected exit 2, got $status"
  assert_contains "$output" '--allowed-tools must name at least one tool'

  local no_tools_dir="$TMP_DIR/run-explicit-no-tools"
  : > "$CALLS"
  set +e
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$WORKSPACE" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" run --workspace "$WORKSPACE" \
      --run-dir "$no_tools_dir" --prompt "generic opinion" --no-tools --timeout 5 \
      > "$output" 2>&1
  status=$?
  set -e
  if [[ "$status" != "0" ]]; then
    cat "$output" >&2
    fail "explicit generic no-tools run expected success, got $status"
  fi
  assert_contains "$no_tools_dir/command.txt" "--tools ''"
  assert_contains "$no_tools_dir/status.json" '"explicitly_none": true'
  pass "empty tool arguments are rejected except for the explicit generic no-tools contract"
}

test_authenticated_model_routing_and_redaction
test_logged_out_fails_before_launch
test_masked_logged_out_output_cannot_succeed
test_credential_store_denial_is_distinct
test_hanging_auth_is_terminated
test_missing_and_indeterminate_preflights_fail
test_review_runs_in_requested_workspace
test_strict_review_preserves_locked_down_controls
test_continued_strict_review_keeps_its_locked_down_surface
test_continue_resumes_exact_session_and_defaults
test_empty_tool_arguments_are_explicit_or_rejected
