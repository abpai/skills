#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CLAUDE_RUN="$ROOT_DIR/claude/skills/claude/scripts/claude-run.sh"
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
case "${FAKE_CLAUDE_ACCESS_MODE:-none}" in
  inside)
    printf '{"type":"assistant","message":{"model":"%s","content":[{"type":"tool_use","name":"Read","input":{"file_path":"src/app.py"}}]}}\n' "${FAKE_RESOLVED_MODEL:-claude-resolved-test}" ;;
  outside)
    printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/tmp/outside.py"}}]}}\n' ;;
esac
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

setup_review_fixture() {
  local workspace="$1"
  mkdir -p "$workspace/src" "$workspace/docs" "$workspace/config"
  git -C "$workspace" init -q
  git -C "$workspace" config user.email fixture@example.test
  git -C "$workspace" config user.name "Claude Runner Fixture"
  printf 'print("approved")\n' > "$workspace/src/app.py"
  printf 'unapproved\n' > "$workspace/docs/readme.md"
  printf 'SECRET=must-not-copy\n' > "$workspace/config/.env"
  printf '*.log\nconfig/.env\n' > "$workspace/.gitignore"
  git -C "$workspace" add src/app.py docs/readme.md .gitignore
  git -C "$workspace" commit -qm fixture
  printf 'ignored\n' > "$workspace/src/debug.log"
  printf 'print("approved change")\n' > "$workspace/src/app.py"
}

write_review_approval() {
  local path="$1" approved_scope="${2:-src}"
  cat > "$path" <<EOF
{
  "destination": "Claude Code/Anthropic",
  "approved_scope": ["$approved_scope"],
  "purpose": "Review the candidate for secret@example.test token=token-super-secret",
  "exclusions": [".env", "ignored files", "private@example.test"],
  "organization": "secret-org",
  "current_user_approved": true
}
EOF
}

test_repo_grounded_review_preserves_evidence_class() {
  local workspace="$TMP_DIR/repo-review-workspace" run_dir="$TMP_DIR/run-repo-review"
  local scope="$TMP_DIR/review-scope.txt" approval="$TMP_DIR/review-approval.json"
  local output="$TMP_DIR/output-repo-review.log"
  local expected_review_workspace
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  printf 'src\n' > "$scope"
  write_review_approval "$approval"
  expected_review_workspace="$(cd "$(dirname "$run_dir")" && pwd -P)/$(basename "$run_dir")/review-workspace"
  : > "$CALLS"

  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$expected_review_workspace" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    FAKE_CLAUDE_ACCESS_MODE=inside FAKE_RESOLVED_MODEL=claude-reviewed-model \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$workspace" --run-dir "$run_dir" \
      --prompt "Review the approved candidate diff." \
      --evidence-class repo-grounded-review \
      --review-scope-file "$scope" \
      --sharing-approval-file "$approval" \
      --external-transfer-status allowed \
      --model claude-requested-review --effort high --timeout 5 \
      > "$output" 2>&1

  assert_contains "$run_dir/status.json" '"state": "finished"'
  assert_contains "$run_dir/status.json" '"class": "repo-grounded-review"'
  assert_contains "$run_dir/status.json" '"workspace_accessed": true'
  assert_contains "$run_dir/status.json" '"resolved_model": "claude-reviewed-model"'
  assert_contains "$run_dir/command.txt" '--tools Read'
  assert_contains "$run_dir/command.txt" 'Glob'
  assert_contains "$run_dir/command.txt" 'Grep'
  assert_contains "$run_dir/command.txt" 'Bash'
  assert_contains "$run_dir/command.txt" 'Edit'
  assert_contains "$run_dir/command.txt" 'Write'
  assert_contains "$run_dir/command.txt" 'NotebookEdit'
  assert_contains "$run_dir/command.txt" 'git\ diff:'
  assert_contains "$run_dir/command.txt" 'Bash\(rg:'
  assert_contains "$run_dir/command.txt" 'Bash\(rm:'
  assert_contains "$run_dir/command.txt" 'git\ push:'
  assert_not_contains "$run_dir/command.txt" "--tools ''"
  assert_not_contains "$run_dir/command.txt" "--allowed-tools ''"
  [[ -f "$run_dir/review-workspace/src/app.py" ]] || fail "approved tracked file was not copied"
  [[ -f "$run_dir/review-workspace/.review-evidence/candidate.diff" ]] || fail "candidate diff missing"
  [[ ! -e "$run_dir/review-workspace/docs/readme.md" ]] || fail "unapproved path was copied"
  [[ ! -e "$run_dir/review-workspace/src/debug.log" ]] || fail "ignored path was copied"
  [[ ! -e "$run_dir/review-workspace/config/.env" ]] || fail ".env path was copied"
  assert_contains "$run_dir/sharing-approval.json" '"current_user_approved": true'
  for secret in secret@example.test private@example.test token-super-secret secret-org; do
    assert_not_contains "$run_dir/sharing-approval.json" "$secret"
    assert_not_contains "$run_dir/prompt.txt" "$secret"
  done
  pass "repo-grounded review keeps read/search tools, sanitized scope, approval, and evidence proof"
}

test_external_transfer_block_is_terminal() {
  local workspace="$TMP_DIR/blocked-review-workspace" run_dir="$TMP_DIR/run-transfer-blocked"
  local scope="$TMP_DIR/blocked-scope.txt" approval="$TMP_DIR/blocked-approval.json"
  local output="$TMP_DIR/output-transfer-blocked.log"
  local expected_review_workspace
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  printf 'src\n' > "$scope"
  write_review_approval "$approval"
  expected_review_workspace="$(cd "$(dirname "$run_dir")" && pwd -P)/$(basename "$run_dir")/review-workspace"
  : > "$CALLS"
  set +e
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$expected_review_workspace" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$workspace" --run-dir "$run_dir" --prompt "Review repository files." \
      --evidence-class repo-grounded-review --review-scope-file "$scope" \
      --sharing-approval-file "$approval" --external-transfer-status blocked \
      --transfer-attempt 1 > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "77" ]] || fail "external transfer blocker expected exit 77, got $status"
  assert_contains "$run_dir/status.json" '"state": "blocked"'
  assert_contains "$run_dir/status.json" '"blocker": "external_transfer_blocked"'
  assert_contains "$run_dir/status.json" '"approval_present": true'
  assert_contains "$run_dir/status.json" '"status": "blocked"'
  assert_contains "$run_dir/preflight.json" '"status": "not_run"'
  assert_contains "$run_dir/preflight.log" 'reason=external_transfer_blocked'
  [[ ! -s "$CALLS" ]] || fail "Claude CLI was probed or launched after transfer denial"
  [[ ! -s "$run_dir/final.md" ]] || fail "blocked transfer produced a review report"
  pass "external-transfer rejection is an explicit terminal blocker with no fallback or launch"
}

test_unchecked_external_transfer_is_terminal() {
  local workspace="$TMP_DIR/unchecked-review-workspace" run_dir="$TMP_DIR/run-transfer-unchecked"
  local scope="$TMP_DIR/unchecked-scope.txt" approval="$TMP_DIR/unchecked-approval.json"
  local output="$TMP_DIR/output-transfer-unchecked.log"
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  printf 'src\n' > "$scope"
  write_review_approval "$approval"
  : > "$CALLS"
  set +e
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$workspace" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$workspace" --run-dir "$run_dir" --prompt "Review repository files." \
      --evidence-class repo-grounded-review --review-scope-file "$scope" \
      --sharing-approval-file "$approval" > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "77" ]] || fail "unchecked transfer expected exit 77, got $status"
  assert_contains "$run_dir/status.json" '"status": "not-checked"'
  assert_contains "$run_dir/status.json" '"blocker": "external_transfer_not_confirmed"'
  assert_contains "$run_dir/status.json" '"approval_present": true'
  assert_contains "$run_dir/preflight.json" '"status": "not_run"'
  assert_contains "$run_dir/preflight.log" 'reason=external_transfer_not_confirmed'
  [[ ! -s "$CALLS" ]] || fail "Claude CLI was probed or launched without explicit transfer permission"
  pass "repo-grounded review requires explicit platform-transfer permission"
}

test_sanitized_scope_rejects_tracked_env_files() {
  local workspace="$TMP_DIR/env-review-workspace" run_dir="$TMP_DIR/run-env-review"
  local scope="$TMP_DIR/env-scope.txt" approval="$TMP_DIR/env-approval.json"
  local output="$TMP_DIR/output-env-review.log"
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  git -C "$workspace" add -f config/.env
  git -C "$workspace" commit -qm "track forbidden fixture"
  printf 'config\n' > "$scope"
  write_review_approval "$approval" config
  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
    --workspace "$workspace" --run-dir "$run_dir" --prompt "Review forbidden scope." \
    --evidence-class repo-grounded-review --review-scope-file "$scope" \
    --sharing-approval-file "$approval" --external-transfer-status blocked \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "65" ]] || fail "tracked .env scope expected exit 65, got $status"
  assert_contains "$output" 'approved_scope_contains_excluded_files'
  assert_contains "$run_dir/status.json" '"blocker": "scope_preparation_failed"'
  [[ ! -e "$run_dir/review-workspace/config/.env" ]] || fail "tracked .env was copied"
  pass "sanitized scope rejects tracked .env files before transfer or launch"
}

test_sanitized_scope_rejects_tracked_known_token_content() {
  local workspace="$TMP_DIR/credential-review-workspace" run_dir="$TMP_DIR/run-credential-review"
  local scope="$TMP_DIR/credential-scope.txt" approval="$TMP_DIR/credential-approval.json"
  local output="$TMP_DIR/output-credential-review.log"
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  printf 'API_KEY=sk_abcdefghijklmnopqrstuvwxyz\n' > "$workspace/src/credentials.py"
  git -C "$workspace" add src/credentials.py
  git -C "$workspace" commit -qm "track credential fixture"
  printf 'src/credentials.py\n' > "$scope"
  write_review_approval "$approval" src/credentials.py
  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
    --workspace "$workspace" --run-dir "$run_dir" --prompt "Review forbidden credential file." \
    --evidence-class repo-grounded-review --review-scope-file "$scope" \
    --sharing-approval-file "$approval" --external-transfer-status allowed \
    > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "65" ]] || fail "credential-bearing scope expected exit 65, got $status"
  assert_contains "$output" 'approved_scope_contains_known_secret'
  [[ ! -e "$run_dir/review-workspace/src/credentials.py" ]] || fail "credential-bearing file was copied"
  pass "sanitized scope rejects tracked files containing known token values"
}

test_repo_review_without_tool_evidence_cannot_succeed() {
  local workspace="$TMP_DIR/no-evidence-workspace" run_dir="$TMP_DIR/run-no-evidence"
  local scope="$TMP_DIR/no-evidence-scope.txt" approval="$TMP_DIR/no-evidence-approval.json"
  local output="$TMP_DIR/output-no-evidence.log"
  local expected_review_workspace
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  printf 'src\n' > "$scope"
  write_review_approval "$approval"
  expected_review_workspace="$(cd "$(dirname "$run_dir")" && pwd -P)/$(basename "$run_dir")/review-workspace"
  : > "$CALLS"
  set +e
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$expected_review_workspace" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    FAKE_CLAUDE_ACCESS_MODE=none FAKE_FINAL="I reviewed the workspace files." \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$workspace" --run-dir "$run_dir" --prompt "Review repository files." \
      --evidence-class repo-grounded-review --review-scope-file "$scope" \
      --sharing-approval-file "$approval" --external-transfer-status allowed \
      --timeout 5 > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "65" ]] || fail "tool-less repo review expected exit 65, got $status"
  assert_contains "$run_dir/status.json" '"state": "failed"'
  assert_contains "$run_dir/status.json" '"blocker": "workspace_evidence_not_accessed"'
  assert_contains "$run_dir/final.md" 'No workspace review is claimed.'
  assert_not_contains "$run_dir/final.md" 'I reviewed the workspace files.'
  assert_contains "$run_dir/unverified-final.md" 'I reviewed the workspace files.'
  pass "repo review cannot succeed or claim file review without observed workspace tool access"
}

test_repo_review_out_of_scope_access_cannot_succeed() {
  local workspace="$TMP_DIR/outside-evidence-workspace" run_dir="$TMP_DIR/run-outside-evidence"
  local scope="$TMP_DIR/outside-evidence-scope.txt" approval="$TMP_DIR/outside-evidence-approval.json"
  local output="$TMP_DIR/output-outside-evidence.log"
  local expected_review_workspace
  setup_review_fixture "$workspace"
  workspace="$(cd "$workspace" && pwd -P)"
  printf 'src\n' > "$scope"
  write_review_approval "$approval"
  expected_review_workspace="$(cd "$(dirname "$run_dir")" && pwd -P)/$(basename "$run_dir")/review-workspace"
  : > "$CALLS"
  set +e
  FAKE_AUTH_MODE=valid FAKE_EXPECT_WORKSPACE="$expected_review_workspace" \
    FAKE_ENVELOPE="same-runner-envelope" FAKE_CLAUDE_CALLS="$CALLS" \
    FAKE_CLAUDE_ACCESS_MODE=outside FAKE_FINAL="I reviewed outside files." \
    PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review \
      --workspace "$workspace" --run-dir "$run_dir" --prompt "Review repository files." \
      --evidence-class repo-grounded-review --review-scope-file "$scope" \
      --sharing-approval-file "$approval" --external-transfer-status allowed \
      --timeout 5 > "$output" 2>&1
  local status=$?
  set -e
  [[ "$status" == "65" ]] || fail "out-of-scope access expected exit 65, got $status"
  assert_contains "$run_dir/status.json" '"blocker": "out_of_scope_tool_access"'
  assert_contains "$run_dir/status.json" '"out_of_scope_attempted": true'
  assert_not_contains "$run_dir/final.md" 'I reviewed outside files.'
  assert_contains "$run_dir/unverified-final.md" 'I reviewed outside files.'
  pass "out-of-scope workspace access cannot yield a repository-review success"
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

  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review --workspace "$WORKSPACE" \
    --run-dir "$TMP_DIR/run-repo-no-tools" --prompt "bad repo tools" \
    --evidence-class repo-grounded-review --review-scope-file "$TMP_DIR/missing" \
    --sharing-approval-file "$TMP_DIR/missing" --no-tools > "$output" 2>&1
  status=$?
  set -e
  [[ "$status" == "2" ]] || fail "tool-less repo review expected argument exit 2, got $status"
  assert_contains "$output" 'repo-grounded-review cannot use --no-tools'

  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review --workspace "$WORKSPACE" \
    --run-dir "$TMP_DIR/run-third-transfer-attempt" --prompt "third retry" \
    --transfer-attempt 3 > "$output" 2>&1
  status=$?
  set -e
  [[ "$status" == "2" ]] || fail "third transfer attempt expected exit 2, got $status"
  assert_contains "$output" '--transfer-attempt must be 1 or 2'

  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review --workspace "$WORKSPACE" \
    --run-dir "$TMP_DIR/run-widened-tools" --prompt "widen tools" \
    --evidence-class repo-grounded-review --review-scope-file "$TMP_DIR/missing" \
    --sharing-approval-file "$TMP_DIR/missing" --tools Read,Glob,Grep,Bash,Edit \
    > "$output" 2>&1
  status=$?
  set -e
  [[ "$status" == "2" ]] || fail "widened repo tool set expected exit 2, got $status"
  assert_contains "$output" 'requires the exact runner-owned tool set'

  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review --workspace "$WORKSPACE" \
    --run-dir "$TMP_DIR/run-widened-permission" --prompt "widen permission" \
    --evidence-class repo-grounded-review --review-scope-file "$TMP_DIR/missing" \
    --sharing-approval-file "$TMP_DIR/missing" --permission-mode auto \
    > "$output" 2>&1
  status=$?
  set -e
  [[ "$status" == "2" ]] || fail "widened repo permission expected exit 2, got $status"
  assert_contains "$output" 'requires --permission-mode plan'

  set +e
  PATH="$FAKEBIN:$PATH" bash "$CLAUDE_RUN" review --workspace "$WORKSPACE" \
    --run-dir "$TMP_DIR/run-passthrough" --prompt "add outside directory" \
    --evidence-class repo-grounded-review --review-scope-file "$TMP_DIR/missing" \
    --sharing-approval-file "$TMP_DIR/missing" -- --add-dir /tmp \
    > "$output" 2>&1
  status=$?
  set -e
  [[ "$status" == "2" ]] || fail "repo passthrough arguments expected exit 2, got $status"
  assert_contains "$output" 'does not accept passthrough Claude arguments'

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
test_repo_grounded_review_preserves_evidence_class
test_external_transfer_block_is_terminal
test_unchecked_external_transfer_is_terminal
test_sanitized_scope_rejects_tracked_env_files
test_sanitized_scope_rejects_tracked_known_token_content
test_repo_review_without_tool_evidence_cannot_succeed
test_repo_review_out_of_scope_access_cannot_succeed
test_empty_tool_arguments_are_explicit_or_rejected
