#!/usr/bin/env bash
set -euo pipefail
umask 077

MODE="${1:-}"

usage() {
  cat >&2 <<'EOF'
Usage: codex-run.sh exec|review|resume [options] [-- extra-codex-args...]

Common options:
  --prompt TEXT          Prompt text to send through stdin.
  --prompt-file PATH     Prompt file to send through stdin.
  --workspace PATH       Workspace passed to codex with --cd (default: current directory).
  --run-root PATH        Directory for run logs (default: $CODEX_HOME/codex-exec-runs).
  --run-dir PATH         Exact run directory to use.
  --continue-run PATH    Reuse session/workspace defaults from a prior wrapper run.
  --heartbeat SECONDS    Monitor heartbeat interval (default: 15).
  --timeout SECONDS      Kill the run after this many seconds if timeout/gtimeout exists.
  --reasoning LEVEL      model_reasoning_effort value (default: medium).
  --model MODEL          Pass a model only when explicitly requested.
  --json                 Ask Codex to emit JSONL events; also mirrors stdout to events.jsonl.
  --ephemeral            Run without persisting Codex session files.
  --dry-run              Write run files and command.txt, but do not launch Codex.

exec options:
  --sandbox MODE         read-only, workspace-write, or danger-full-access (default: read-only).
  --output-schema PATH   JSON schema for Codex final output.

review options:
  --uncommitted          Review staged, unstaged, and untracked changes (default).
  --no-uncommitted       Do not add the default --uncommitted flag.
  --base REF             Review changes against a base ref.
  --commit SHA           Review one commit.
  --title TITLE          Review title.
  --output-schema PATH   JSON schema for Codex final output.

resume options:
  --last                 Resume latest session (default).
  --session ID           Resume a specific session id or thread name.
  --output-schema PATH   JSON schema for Codex final output.

MonitorTool contract:
  Prints stable lines prefixed with "[codex-exec] event=...".
  Writes run.env, status.env, monitor.sh, continue.sh, stdout.log, stderr.log,
  final.md, command.txt, prompt.txt, and preflight.log.
EOF
}

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  usage
  exit 0
elif [[ "$MODE" == "exec" || "$MODE" == "review" || "$MODE" == "resume" ]]; then
  shift
else
  usage
  exit 2
fi

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/$(basename "${BASH_SOURCE[0]}")"
PROMPT_TEXT=""
PROMPT_FILE=""
WORKSPACE="$PWD"
RUN_ROOT="${CODEX_EXEC_RUNS_DIR:-${CODEX_HOME:-$HOME/.codex}/codex-exec-runs}"
RUN_DIR=""
CONTINUE_RUN_DIR=""
HEARTBEAT_SECONDS="${CODEX_EXEC_HEARTBEAT_SECONDS:-15}"
TIMEOUT_SECONDS="${CODEX_EXEC_TIMEOUT_SECONDS:-0}"
REASONING="medium"
MODEL=""
JSON_OUTPUT="false"
EPHEMERAL="false"
DRY_RUN="false"
SANDBOX="read-only"
OUTPUT_SCHEMA=""
REVIEW_SCOPE_SET="false"
REVIEW_ARGS=()
REVIEW_BASE=""
REVIEW_COMMIT=""
REVIEW_TITLE=""
REVIEW_NO_UNCOMMITTED="false"
REVIEW_UNCOMMITTED="false"
COMMON_ARGS=()
CONFIG_ARGS=()
EXTRA_ARGS=()
RESUME_LAST="true"
SESSION_ID=""
CHILD_PID=""
HEARTBEAT_PID=""
WORKSPACE_SET="false"
RUN_ROOT_SET="false"
HEARTBEAT_SET="false"
TIMEOUT_SET="false"
REASONING_SET="false"
MODEL_SET="false"
SESSION_SET="false"
SANDBOX_SET="false"

require_value() {
  local option="$1"
  local value="${2:-}"
  if [[ -z "$value" ]]; then
    echo "[FAIL] missing value for $option" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt)
      PROMPT_TEXT="${2:-}"
      require_value "$1" "$PROMPT_TEXT"
      shift 2
      ;;
    --prompt-file)
      PROMPT_FILE="${2:-}"
      require_value "$1" "$PROMPT_FILE"
      shift 2
      ;;
    --workspace|--cd)
      WORKSPACE="${2:-}"
      require_value "$1" "$WORKSPACE"
      WORKSPACE_SET="true"
      shift 2
      ;;
    --run-root)
      RUN_ROOT="${2:-}"
      require_value "$1" "$RUN_ROOT"
      RUN_ROOT_SET="true"
      shift 2
      ;;
    --run-dir)
      RUN_DIR="${2:-}"
      require_value "$1" "$RUN_DIR"
      shift 2
      ;;
    --continue-run)
      CONTINUE_RUN_DIR="${2:-}"
      require_value "$1" "$CONTINUE_RUN_DIR"
      shift 2
      ;;
    --heartbeat)
      HEARTBEAT_SECONDS="${2:-}"
      require_value "$1" "$HEARTBEAT_SECONDS"
      HEARTBEAT_SET="true"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
      require_value "$1" "$TIMEOUT_SECONDS"
      TIMEOUT_SET="true"
      shift 2
      ;;
    --reasoning)
      REASONING="${2:-}"
      require_value "$1" "$REASONING"
      REASONING_SET="true"
      shift 2
      ;;
    --model)
      MODEL="${2:-}"
      require_value "$1" "$MODEL"
      MODEL_SET="true"
      shift 2
      ;;
    --json)
      JSON_OUTPUT="true"
      shift
      ;;
    --ephemeral)
      EPHEMERAL="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --sandbox)
      SANDBOX="${2:-}"
      require_value "$1" "$SANDBOX"
      SANDBOX_SET="true"
      shift 2
      ;;
    --output-schema)
      OUTPUT_SCHEMA="${2:-}"
      require_value "$1" "$OUTPUT_SCHEMA"
      shift 2
      ;;
    --uncommitted)
      REVIEW_ARGS+=(--uncommitted)
      REVIEW_SCOPE_SET="true"
      REVIEW_UNCOMMITTED="true"
      shift
      ;;
    --no-uncommitted)
      REVIEW_SCOPE_SET="true"
      REVIEW_NO_UNCOMMITTED="true"
      shift
      ;;
    --base)
      REVIEW_BASE="${2:-}"
      require_value "$1" "$REVIEW_BASE"
      REVIEW_ARGS+=(--base "$REVIEW_BASE")
      REVIEW_SCOPE_SET="true"
      shift 2
      ;;
    --commit)
      REVIEW_COMMIT="${2:-}"
      require_value "$1" "$REVIEW_COMMIT"
      REVIEW_ARGS+=(--commit "$REVIEW_COMMIT")
      REVIEW_SCOPE_SET="true"
      shift 2
      ;;
    --title)
      REVIEW_TITLE="${2:-}"
      require_value "$1" "$REVIEW_TITLE"
      REVIEW_ARGS+=(--title "$REVIEW_TITLE")
      shift 2
      ;;
    --last)
      RESUME_LAST="true"
      SESSION_ID=""
      SESSION_SET="true"
      shift
      ;;
    --session)
      SESSION_ID="${2:-}"
      require_value "$1" "$SESSION_ID"
      RESUME_LAST="false"
      SESSION_SET="true"
      shift 2
      ;;
    -c|--config)
      CONFIG_VALUE="${2:-}"
      require_value "$1" "$CONFIG_VALUE"
      CONFIG_ARGS+=(-c "$CONFIG_VALUE")
      shift 2
      ;;
    --skip-git-repo-check|--ignore-rules|--ignore-user-config|--strict-config|--dangerously-bypass-approvals-and-sandbox|--dangerously-bypass-hook-trust)
      COMMON_ARGS+=("$1")
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        EXTRA_ARGS+=("$1")
        shift
      done
      ;;
    *)
      echo "[FAIL] unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -n "$PROMPT_TEXT" && -n "$PROMPT_FILE" ]]; then
  echo "[FAIL] use either --prompt or --prompt-file, not both" >&2
  exit 2
fi

if [[ "$MODE" == "exec" && -z "$PROMPT_TEXT" && -z "$PROMPT_FILE" ]]; then
  echo "[FAIL] exec mode requires --prompt or --prompt-file" >&2
  exit 2
fi

# python3 parses env files and Codex output. Fail loudly here (after --help is
# handled) instead of letting a missing interpreter silently empty parsed values
# inside process substitution.
if ! command -v python3 >/dev/null 2>&1; then
  echo "[FAIL] python3 is required but was not found on PATH" >&2
  exit 127
fi

case "$HEARTBEAT_SECONDS" in
  ''|*[!0-9]*)
    echo "[FAIL] --heartbeat must be a positive integer" >&2
    exit 2
    ;;
esac
if (( HEARTBEAT_SECONDS < 1 )); then
  echo "[FAIL] --heartbeat must be at least 1" >&2
  exit 2
fi

case "$TIMEOUT_SECONDS" in
  ''|*[!0-9]*)
    echo "[FAIL] --timeout must be an integer number of seconds" >&2
    exit 2
    ;;
esac

absolute_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '%s\n' "$PWD/$1" ;;
  esac
}

shell_quote() {
  printf '%q' "$1"
}

# Parse several keys from an env file in a single python pass and emit
# tab-separated "key<TAB>value" lines for the keys that are present. Values are
# parsed with shlex (matching the printf %q quoting used to write the files) so
# a crafted run.env cannot execute shell, unlike `source`. The metadata fields
# we read (paths, ids, booleans, integers) never contain tabs or newlines.
read_env_values() {
  local env_file="$1"
  shift
  if [[ ! -f "$env_file" ]] || (( $# == 0 )); then
    return 0
  fi
  python3 - "$env_file" "$@" <<'PY'
import shlex
import sys
from pathlib import Path

path = Path(sys.argv[1])
targets = sys.argv[2:]
try:
    lines = path.read_text(encoding="utf-8").splitlines()
except FileNotFoundError:
    sys.exit(0)

found = {}
for line in reversed(lines):
    if "=" not in line or line.lstrip().startswith("#"):
        continue
    key, value = line.split("=", 1)
    if key not in targets or key in found:
        continue
    try:
        parts = shlex.split(value)
    except ValueError:
        found[key] = value
    else:
        found[key] = parts[0] if parts else ""

for key in targets:
    if key in found:
        sys.stdout.write("%s\t%s\n" % (key, found[key]))
PY
}

extract_session_id_from_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    awk -F': ' '/^session id: / { value=$2 } END { print value }' "$path"
  fi
}

load_continue_defaults() {
  if [[ -z "$CONTINUE_RUN_DIR" ]]; then
    return 0
  fi

  CONTINUE_RUN_DIR="$(absolute_path "$CONTINUE_RUN_DIR")"
  local prior_env="$CONTINUE_RUN_DIR/run.env"
  local prior_status="$CONTINUE_RUN_DIR/status.env"
  if [[ ! -f "$prior_env" && ! -f "$prior_status" ]]; then
    echo "[FAIL] --continue-run requires a prior run.env or status.env: $CONTINUE_RUN_DIR" >&2
    exit 2
  fi

  local prior_workspace="" prior_run_root="" prior_heartbeat="" prior_timeout=""
  local prior_reasoning="" prior_model="" prior_sandbox="" prior_ephemeral=""
  local prior_session="" prior_status_workspace="" prior_status_session="" prior_stderr=""
  local key value

  # One python pass over run.env for all preserved settings.
  while IFS=$'\t' read -r key value; do
    case "$key" in
      WORKSPACE) prior_workspace="$value" ;;
      RUN_ROOT) prior_run_root="$value" ;;
      HEARTBEAT_SECONDS) prior_heartbeat="$value" ;;
      TIMEOUT_SECONDS) prior_timeout="$value" ;;
      REASONING) prior_reasoning="$value" ;;
      MODEL) prior_model="$value" ;;
      SANDBOX) prior_sandbox="$value" ;;
      EPHEMERAL) prior_ephemeral="$value" ;;
      SESSION_ID) prior_session="$value" ;;
    esac
  done < <(read_env_values "$prior_env" \
    WORKSPACE RUN_ROOT HEARTBEAT_SECONDS TIMEOUT_SECONDS REASONING MODEL SANDBOX EPHEMERAL SESSION_ID)

  # One python pass over status.env for back-compat fallbacks (older runs predate run.env).
  while IFS=$'\t' read -r key value; do
    case "$key" in
      workspace) prior_status_workspace="$value" ;;
      session_id) prior_status_session="$value" ;;
      stderr_log) prior_stderr="$value" ;;
    esac
  done < <(read_env_values "$prior_status" workspace session_id stderr_log)

  if [[ -z "$prior_workspace" ]]; then
    prior_workspace="$prior_status_workspace"
  fi
  if [[ -z "$prior_session" ]]; then
    prior_session="$prior_status_session"
  fi
  if [[ -z "$prior_session" ]]; then
    prior_session="$(extract_session_id_from_file "$prior_stderr")"
  fi

  if [[ "$WORKSPACE_SET" == "false" && -n "$prior_workspace" ]]; then
    WORKSPACE="$prior_workspace"
  fi
  if [[ "$RUN_ROOT_SET" == "false" && -n "$prior_run_root" ]]; then
    RUN_ROOT="$prior_run_root"
  fi
  if [[ "$HEARTBEAT_SET" == "false" && -n "$prior_heartbeat" ]]; then
    HEARTBEAT_SECONDS="$prior_heartbeat"
  fi
  if [[ "$TIMEOUT_SET" == "false" && -n "$prior_timeout" ]]; then
    TIMEOUT_SECONDS="$prior_timeout"
  fi
  if [[ "$REASONING_SET" == "false" && -n "$prior_reasoning" ]]; then
    REASONING="$prior_reasoning"
  fi
  if [[ "$MODEL_SET" == "false" && -n "$prior_model" ]]; then
    MODEL="$prior_model"
  fi
  if [[ "$SANDBOX_SET" == "false" && -n "$prior_sandbox" ]]; then
    SANDBOX="$prior_sandbox"
  fi
  if [[ "$SESSION_SET" == "false" && "$prior_ephemeral" == "true" ]]; then
    echo "[FAIL] prior run used --ephemeral and cannot be resumed: $CONTINUE_RUN_DIR" >&2
    exit 2
  fi
  if [[ "$SESSION_SET" == "false" && -z "$prior_session" ]]; then
    echo "[FAIL] prior run has no captured Codex session id; pass --last explicitly to resume the latest session" >&2
    exit 2
  fi
  if [[ "$SESSION_SET" == "false" && -n "$prior_session" ]]; then
    SESSION_ID="$prior_session"
    RESUME_LAST="false"
  fi
}

load_continue_defaults

WORKSPACE="$(absolute_path "$WORKSPACE")"
if [[ ! -d "$WORKSPACE" ]]; then
  echo "[FAIL] workspace does not exist: $WORKSPACE" >&2
  exit 2
fi
WORKSPACE="$(cd "$WORKSPACE" && pwd -P)"

if [[ -n "$PROMPT_FILE" ]]; then
  PROMPT_FILE="$(absolute_path "$PROMPT_FILE")"
  if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "[FAIL] prompt file does not exist: $PROMPT_FILE" >&2
    exit 2
  fi
fi

if [[ -n "$OUTPUT_SCHEMA" ]]; then
  OUTPUT_SCHEMA="$(absolute_path "$OUTPUT_SCHEMA")"
  if [[ ! -f "$OUTPUT_SCHEMA" ]]; then
    echo "[FAIL] output schema does not exist: $OUTPUT_SCHEMA" >&2
    exit 2
  fi
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
workspace_slug="$(basename "$WORKSPACE" | tr -cd 'A-Za-z0-9._-' | cut -c1-40)"
if [[ -z "$workspace_slug" ]]; then
  workspace_slug="workspace"
fi

if [[ -z "$RUN_DIR" ]]; then
  RUN_ROOT="$(absolute_path "$RUN_ROOT")"
  RUN_DIR="$RUN_ROOT/$RUN_ID-$workspace_slug-$MODE"
else
  RUN_DIR="$(absolute_path "$RUN_DIR")"
fi
mkdir -p "$RUN_DIR"

PROMPT_RUN_FILE="$RUN_DIR/prompt.txt"
STDOUT_LOG="$RUN_DIR/stdout.log"
STDERR_LOG="$RUN_DIR/stderr.log"
EVENTS_LOG="$RUN_DIR/events.jsonl"
FINAL_MESSAGE="$RUN_DIR/final.md"
FINAL_SOURCE="output-last-message"
RUN_ENV_FILE="$RUN_DIR/run.env"
STATUS_FILE="$RUN_DIR/status.env"
COMMAND_FILE="$RUN_DIR/command.txt"
PREFLIGHT_LOG="$RUN_DIR/preflight.log"
MONITOR_SCRIPT="$RUN_DIR/monitor.sh"
CONTINUE_SCRIPT="$RUN_DIR/continue.sh"

: > "$STDOUT_LOG"
: > "$STDERR_LOG"
: > "$EVENTS_LOG"
: > "$FINAL_MESSAGE"

cat > "$MONITOR_SCRIPT" <<'MONITOR_EOF'
#!/usr/bin/env bash
set -euo pipefail

RUN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATUS_FILE="$RUN_DIR/status.env"
POLL_SECONDS="${CODEX_EXEC_MONITOR_POLL_SECONDS:-3}"
REPORT_SECONDS="${CODEX_EXEC_MONITOR_REPORT_SECONDS:-30}"

case "$POLL_SECONDS" in
  ''|*[!0-9]*) POLL_SECONDS=3 ;;
esac
case "$REPORT_SECONDS" in
  ''|*[!0-9]*) REPORT_SECONDS=30 ;;
esac
if (( POLL_SECONDS < 1 )); then
  POLL_SECONDS=3
fi
if (( REPORT_SECONDS < 1 )); then
  REPORT_SECONDS=30
fi

# This monitor parses status.env with python3 (see below). Fail loudly instead
# of polling forever if the interpreter is missing at monitor runtime.
if ! command -v python3 >/dev/null 2>&1; then
  echo "[codex-exec] monitor=error detail=\"python3 is required to parse status.env\"" >&2
  exit 127
fi

started_at="$(date +%s)"
last_report=0

line_count() {
  local path="$1"
  if [[ -n "$path" && -f "$path" ]]; then
    wc -l < "$path" | tr -d '[:space:]'
  else
    printf '0'
  fi
}

while true; do
  state="pending"
  exit_code=""
  elapsed_seconds=""
  stdout_log=""
  stderr_log=""
  final_message=""

  if [[ -f "$STATUS_FILE" ]]; then
    # Parse known keys with python/shlex instead of sourcing, so a crafted
    # status.env cannot execute shell (matches the wrapper's read_env_values).
    while IFS=$'\t' read -r key value; do
      case "$key" in
        state) state="$value" ;;
        exit_code) exit_code="$value" ;;
        elapsed_seconds) elapsed_seconds="$value" ;;
        stdout_log) stdout_log="$value" ;;
        stderr_log) stderr_log="$value" ;;
        final_message) final_message="$value" ;;
      esac
    done < <(python3 - "$STATUS_FILE" state exit_code elapsed_seconds stdout_log stderr_log final_message <<'PY'
import shlex
import sys
from pathlib import Path

path = Path(sys.argv[1])
targets = sys.argv[2:]
try:
    lines = path.read_text(encoding="utf-8").splitlines()
except FileNotFoundError:
    sys.exit(0)

found = {}
for line in reversed(lines):
    if "=" not in line or line.lstrip().startswith("#"):
        continue
    key, value = line.split("=", 1)
    if key not in targets or key in found:
        continue
    try:
        parts = shlex.split(value)
    except ValueError:
        found[key] = value
    else:
        found[key] = parts[0] if parts else ""

for key in targets:
    if key in found:
        sys.stdout.write("%s\t%s\n" % (key, found[key]))
PY
)
  fi

  now="$(date +%s)"
  if [[ -z "$elapsed_seconds" ]]; then
    elapsed_seconds=$((now - started_at))
  fi

  case "$state" in
    finished|failed|interrupted|dry-run)
      stdout_lines="$(line_count "$stdout_log")"
      stderr_lines="$(line_count "$stderr_log")"
      printf '[codex-exec] monitor=done state=%s exit_code=%s elapsed=%ss stdout_lines=%s stderr_lines=%s final=%q\n' \
        "$state" "$exit_code" "$elapsed_seconds" "$stdout_lines" "$stderr_lines" "$final_message"
      if [[ "$exit_code" =~ ^[0-9]+$ ]]; then
        exit "$exit_code"
      fi
      exit 1
      ;;
  esac

  if (( now - last_report >= REPORT_SECONDS )); then
    stdout_lines="$(line_count "$stdout_log")"
    stderr_lines="$(line_count "$stderr_log")"
    printf '[codex-exec] monitor=waiting state=%s elapsed=%ss stdout_lines=%s stderr_lines=%s\n' \
      "$state" "$elapsed_seconds" "$stdout_lines" "$stderr_lines"
    last_report="$now"
  fi

  sleep "$POLL_SECONDS"
done
MONITOR_EOF
chmod u=rwx,go= "$MONITOR_SCRIPT"

cat > "$CONTINUE_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec $(shell_quote "$SCRIPT_PATH") resume --continue-run $(shell_quote "$RUN_DIR") "\$@"
EOF
chmod u=rwx,go= "$CONTINUE_SCRIPT"

HAS_PROMPT="false"
if [[ -n "$PROMPT_TEXT" ]]; then
  printf '%s\n' "$PROMPT_TEXT" > "$PROMPT_RUN_FILE"
  HAS_PROMPT="true"
elif [[ -n "$PROMPT_FILE" ]]; then
  cp "$PROMPT_FILE" "$PROMPT_RUN_FILE"
  HAS_PROMPT="true"
else
  : > "$PROMPT_RUN_FILE"
fi

review_scope_text() {
  if [[ -n "$REVIEW_BASE" ]]; then
    printf 'changes against base ref %s' "$REVIEW_BASE"
  elif [[ -n "$REVIEW_COMMIT" ]]; then
    printf 'changes introduced by commit %s' "$REVIEW_COMMIT"
  elif [[ "$REVIEW_NO_UNCOMMITTED" == "true" ]]; then
    printf 'the repository state requested by the caller; clarify the effective scope in the review'
  elif [[ "$REVIEW_UNCOMMITTED" == "true" || "$REVIEW_SCOPE_SET" == "false" ]]; then
    printf 'staged, unstaged, and untracked changes in the working tree'
  else
    printf 'current repository changes'
  fi
}

review_scope_instructions() {
  if [[ -n "$REVIEW_BASE" ]]; then
    printf 'Inspect the requested base comparison with git diff --stat %s...HEAD and git diff %s...HEAD; if the repo uses a two-dot workflow, state that and use the appropriate diff.' "$REVIEW_BASE" "$REVIEW_BASE"
  elif [[ -n "$REVIEW_COMMIT" ]]; then
    printf 'Inspect the requested commit with git show --stat --find-renames %s and git show --find-renames --format=fuller %s.' "$REVIEW_COMMIT" "$REVIEW_COMMIT"
  elif [[ "$REVIEW_NO_UNCOMMITTED" == "true" ]]; then
    printf 'First determine the effective review scope from the repository state and user instructions, then state that scope before findings.'
  else
    printf 'Inspect git status --short, git diff --cached, git diff, and relevant untracked files from git ls-files --others --exclude-standard.'
  fi
}

if [[ "$MODE" == "review" && "$HAS_PROMPT" == "true" ]]; then
  USER_PROMPT_FILE="$RUN_DIR/user-prompt.txt"
  cp "$PROMPT_RUN_FILE" "$USER_PROMPT_FILE"
  {
    printf 'Perform a code review for this workspace: %s\n\n' "$WORKSPACE"
    if [[ -n "$REVIEW_TITLE" ]]; then
      printf 'Review title: %s\n' "$REVIEW_TITLE"
    fi
    printf 'Review scope: %s.\n' "$(review_scope_text)"
    printf 'Scope inspection: %s\n' "$(review_scope_instructions)"
    printf 'Use read-only git and file inspection commands to gather evidence. '
    printf 'Do not modify files.\n\n'
    printf 'User review instructions:\n'
    cat "$USER_PROMPT_FILE"
  } > "$PROMPT_RUN_FILE"
fi

codex_cmd=(codex exec --cd "$WORKSPACE" -c "model_reasoning_effort=\"$REASONING\"")
if (( ${#CONFIG_ARGS[@]} > 0 )); then
  codex_cmd+=("${CONFIG_ARGS[@]}")
fi
if (( ${#COMMON_ARGS[@]} > 0 )); then
  codex_cmd+=("${COMMON_ARGS[@]}")
fi

if [[ "$EPHEMERAL" == "true" ]]; then
  codex_cmd+=(--ephemeral)
fi

if [[ -n "$MODEL" ]]; then
  codex_cmd+=(--model "$MODEL")
fi

if [[ "$MODE" == "exec" ]]; then
  codex_cmd+=(--sandbox "$SANDBOX")
  if [[ "$JSON_OUTPUT" == "true" ]]; then
    codex_cmd+=(--json)
  fi
  if [[ -n "$OUTPUT_SCHEMA" ]]; then
    codex_cmd+=(--output-schema "$OUTPUT_SCHEMA")
  fi
  codex_cmd+=(-o "$FINAL_MESSAGE")
  if (( ${#EXTRA_ARGS[@]} > 0 )); then
    codex_cmd+=("${EXTRA_ARGS[@]}")
  fi
  codex_cmd+=(-)
elif [[ "$MODE" == "review" ]]; then
  if [[ "$HAS_PROMPT" == "true" ]]; then
    codex_cmd+=(--sandbox "$SANDBOX")
    if [[ "$JSON_OUTPUT" == "true" ]]; then
      codex_cmd+=(--json)
    fi
    if [[ -n "$OUTPUT_SCHEMA" ]]; then
      codex_cmd+=(--output-schema "$OUTPUT_SCHEMA")
    fi
    codex_cmd+=(-o "$FINAL_MESSAGE")
    if (( ${#EXTRA_ARGS[@]} > 0 )); then
      codex_cmd+=("${EXTRA_ARGS[@]}")
    fi
    codex_cmd+=(-)
  else
    codex_cmd+=(review)
    if [[ "$REVIEW_SCOPE_SET" == "false" ]]; then
      codex_cmd+=(--uncommitted)
    fi
    if (( ${#REVIEW_ARGS[@]} > 0 )); then
      codex_cmd+=("${REVIEW_ARGS[@]}")
    fi
    if [[ "$JSON_OUTPUT" == "true" ]]; then
      codex_cmd+=(--json)
    fi
    if [[ -n "$OUTPUT_SCHEMA" ]]; then
      codex_cmd+=(--output-schema "$OUTPUT_SCHEMA")
    fi
    codex_cmd+=(-o "$FINAL_MESSAGE")
    if (( ${#EXTRA_ARGS[@]} > 0 )); then
      codex_cmd+=("${EXTRA_ARGS[@]}")
    fi
  fi
else
  codex_cmd+=(--sandbox "$SANDBOX")
  codex_cmd+=(resume)
  if [[ "$RESUME_LAST" == "true" ]]; then
    codex_cmd+=(--last)
  else
    codex_cmd+=("$SESSION_ID")
  fi
  if [[ "$JSON_OUTPUT" == "true" ]]; then
    codex_cmd+=(--json)
  fi
  if [[ -n "$OUTPUT_SCHEMA" ]]; then
    codex_cmd+=(--output-schema "$OUTPUT_SCHEMA")
  fi
  codex_cmd+=(-o "$FINAL_MESSAGE")
  if (( ${#EXTRA_ARGS[@]} > 0 )); then
    codex_cmd+=("${EXTRA_ARGS[@]}")
  fi
  if [[ "$HAS_PROMPT" == "true" ]]; then
    codex_cmd+=(-)
  fi
fi

timeout_cmd=()
if (( TIMEOUT_SECONDS > 0 )); then
  if command -v timeout >/dev/null 2>&1; then
    timeout_cmd=(timeout "$TIMEOUT_SECONDS")
  elif command -v gtimeout >/dev/null 2>&1; then
    timeout_cmd=(gtimeout "$TIMEOUT_SECONDS")
  else
    echo "[codex-exec] event=warn message=timeout_command_not_found timeout_seconds=$TIMEOUT_SECONDS"
  fi
fi

run_cmd=()
if (( ${#timeout_cmd[@]} > 0 )); then
  run_cmd+=("${timeout_cmd[@]}")
fi
run_cmd+=("${codex_cmd[@]}")

{
  printf 'cwd='
  shell_quote "$WORKSPACE"
  printf '\n'
  printf 'mode=%s\n' "$MODE"
  printf 'command='
  for arg in "${run_cmd[@]}"; do
    shell_quote "$arg"
    printf ' '
  done
  printf '\n'
  if [[ "$HAS_PROMPT" == "true" ]]; then
    printf 'stdin='
    shell_quote "$PROMPT_RUN_FILE"
    printf '\n'
  else
    printf 'stdin=/dev/null\n'
  fi
} > "$COMMAND_FILE"

write_run_env() {
  {
    printf 'RUN_ID=%q\n' "$RUN_ID"
    printf 'MODE=%q\n' "$MODE"
    printf 'WORKSPACE=%q\n' "$WORKSPACE"
    printf 'RUN_ROOT=%q\n' "$RUN_ROOT"
    printf 'RUN_DIR=%q\n' "$RUN_DIR"
    printf 'RUN_ENV_FILE=%q\n' "$RUN_ENV_FILE"
    printf 'STATUS_FILE=%q\n' "$STATUS_FILE"
    printf 'MONITOR_SCRIPT=%q\n' "$MONITOR_SCRIPT"
    printf 'CONTINUE_SCRIPT=%q\n' "$CONTINUE_SCRIPT"
    printf 'PROMPT_RUN_FILE=%q\n' "$PROMPT_RUN_FILE"
    printf 'STDOUT_LOG=%q\n' "$STDOUT_LOG"
    printf 'STDERR_LOG=%q\n' "$STDERR_LOG"
    printf 'EVENTS_LOG=%q\n' "$EVENTS_LOG"
    printf 'FINAL_MESSAGE=%q\n' "$FINAL_MESSAGE"
    printf 'FINAL_SOURCE=%q\n' "$FINAL_SOURCE"
    printf 'COMMAND_FILE=%q\n' "$COMMAND_FILE"
    printf 'PREFLIGHT_LOG=%q\n' "$PREFLIGHT_LOG"
    printf 'SESSION_ID=%q\n' "$SESSION_ID"
    printf 'RESUME_LAST=%q\n' "$RESUME_LAST"
    printf 'REASONING=%q\n' "$REASONING"
    printf 'MODEL=%q\n' "$MODEL"
    printf 'JSON_OUTPUT=%q\n' "$JSON_OUTPUT"
    printf 'EPHEMERAL=%q\n' "$EPHEMERAL"
    printf 'SANDBOX=%q\n' "$SANDBOX"
    printf 'TIMEOUT_SECONDS=%q\n' "$TIMEOUT_SECONDS"
    printf 'HEARTBEAT_SECONDS=%q\n' "$HEARTBEAT_SECONDS"
  } > "$RUN_ENV_FILE"
}

write_status() {
  local state="$1"
  local exit_code="${2:-}"
  local elapsed="${3:-0}"
  {
    printf 'run_id=%q\n' "$RUN_ID"
    printf 'mode=%q\n' "$MODE"
    printf 'state=%q\n' "$state"
    printf 'pid=%q\n' "${CHILD_PID:-}"
    printf 'exit_code=%q\n' "$exit_code"
    printf 'elapsed_seconds=%q\n' "$elapsed"
    printf 'session_id=%q\n' "$SESSION_ID"
    printf 'workspace=%q\n' "$WORKSPACE"
    printf 'run_dir=%q\n' "$RUN_DIR"
    printf 'run_env=%q\n' "$RUN_ENV_FILE"
    printf 'stdout_log=%q\n' "$STDOUT_LOG"
    printf 'stderr_log=%q\n' "$STDERR_LOG"
    printf 'events_log=%q\n' "$EVENTS_LOG"
    printf 'final_message=%q\n' "$FINAL_MESSAGE"
    printf 'final_source=%q\n' "$FINAL_SOURCE"
    printf 'command_file=%q\n' "$COMMAND_FILE"
    printf 'preflight_log=%q\n' "$PREFLIGHT_LOG"
    printf 'monitor_script=%q\n' "$MONITOR_SCRIPT"
    printf 'continue_script=%q\n' "$CONTINUE_SCRIPT"
  } > "$STATUS_FILE"
}

# shellcheck disable=SC2317,SC2329 # Invoked through signal traps.
cleanup_children() {
  if [[ -n "${HEARTBEAT_PID:-}" ]]; then
    kill "$HEARTBEAT_PID" 2>/dev/null || true
  fi
  if [[ -n "${CHILD_PID:-}" ]]; then
    kill "$CHILD_PID" 2>/dev/null || true
  fi
  # Kill the tee readers before unlinking the FIFOs so a signal that arrives
  # before Codex opens both pipes cannot leave a tee blocked on a removed path.
  if [[ -n "${STDOUT_TEE_PID:-}" ]]; then
    kill "$STDOUT_TEE_PID" 2>/dev/null || true
  fi
  if [[ -n "${STDERR_TEE_PID:-}" ]]; then
    kill "$STDERR_TEE_PID" 2>/dev/null || true
  fi
  if [[ -n "${STDOUT_PIPE:-}" ]]; then
    rm -f "$STDOUT_PIPE"
  fi
  if [[ -n "${STDERR_PIPE:-}" ]]; then
    rm -f "$STDERR_PIPE"
  fi
}

# shellcheck disable=SC2317,SC2329 # Invoked through signal traps.
handle_signal() {
  local signal="$1"
  local exit_code="$2"
  local elapsed="0"
  if [[ -n "${STARTED_AT:-}" ]]; then
    elapsed=$(($(date +%s) - STARTED_AT))
  fi
  echo "[codex-exec] event=interrupt signal=$signal"
  cleanup_children
  write_status "interrupted" "$exit_code" "$elapsed"
  exit "$exit_code"
}

trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM

line_count() {
  wc -l < "$1" | tr -d '[:space:]'
}

last_output_line() {
  local line=""
  if [[ -s "$STDERR_LOG" ]]; then
    line="$(tail -n 1 "$STDERR_LOG" || true)"
  elif [[ -s "$STDOUT_LOG" ]]; then
    line="$(tail -n 1 "$STDOUT_LOG" || true)"
  fi
  line="$(printf '%s' "$line" | tr '\r\n' '  ' | cut -c1-180)"
  printf '%s' "$line"
}

populate_final_message_fallback() {
  if (( EXIT_CODE != 0 )) || [[ -s "$FINAL_MESSAGE" ]]; then
    FINAL_SOURCE="output-last-message"
    return 0
  fi

  if [[ -s "$STDOUT_LOG" && "$JSON_OUTPUT" == "true" ]]; then
    FINAL_SOURCE="empty-json-stdout"
    printf '[codex-exec] event=final-fallback source=%q reason=empty_final_json_stdout\n' "$FINAL_SOURCE"
  elif [[ -s "$STDOUT_LOG" ]]; then
    cp "$STDOUT_LOG" "$FINAL_MESSAGE"
    FINAL_SOURCE="stdout.log"
    printf '[codex-exec] event=final-fallback source=%q reason=empty_final\n' "$FINAL_SOURCE"
    return 0
  fi

  if [[ "$MODE" == "review" && -s "$STDERR_LOG" ]]; then
    # Some review builds stream the verdict to stderr. Drop the trailing
    # `session id:` marker the CLI always emits there so it does not pollute
    # the captured verdict.
    local filtered_stderr
    filtered_stderr="$RUN_DIR/.final.stderr.filtered"
    if grep -v '^session id: ' "$STDERR_LOG" > "$filtered_stderr" && [[ -s "$filtered_stderr" ]]; then
      mv "$filtered_stderr" "$FINAL_MESSAGE"
      FINAL_SOURCE="stderr.log"
      printf '[codex-exec] event=final-fallback source=%q reason=empty_final_review_stderr\n' "$FINAL_SOURCE"
      return 0
    fi
    rm -f "$filtered_stderr"
  fi

  if [[ "$FINAL_SOURCE" != "empty-json-stdout" ]]; then
    FINAL_SOURCE="empty"
  fi
}

heartbeat_loop() {
  local pid="$1"
  local started_at="$2"
  while kill -0 "$pid" 2>/dev/null; do
    sleep "$HEARTBEAT_SECONDS"
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    local now elapsed stdout_lines stderr_lines last_line
    now="$(date +%s)"
    elapsed=$((now - started_at))
    stdout_lines="$(line_count "$STDOUT_LOG")"
    stderr_lines="$(line_count "$STDERR_LOG")"
    last_line="$(last_output_line)"
    write_status "running" "" "$elapsed"
    printf '[codex-exec] event=progress elapsed=%ss pid=%s stdout_lines=%s stderr_lines=%s last=%q\n' \
      "$elapsed" "$pid" "$stdout_lines" "$stderr_lines" "$last_line"
  done
}

{
  printf 'timestamp=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'workspace=%s\n' "$WORKSPACE"
  if command -v codex >/dev/null 2>&1; then
    codex --version 2>&1 || true
    codex exec --version 2>&1 || true
  else
    printf 'codex: not installed\n'
  fi
  git -C "$WORKSPACE" rev-parse --show-toplevel 2>/dev/null || printf 'not a git repo\n'
  git -C "$WORKSPACE" status --short 2>/dev/null | head -40 || true
} > "$PREFLIGHT_LOG"

write_run_env
write_status "planned" "" 0
printf '[codex-exec] event=start run_id=%s mode=%s workspace=%q\n' "$RUN_ID" "$MODE" "$WORKSPACE"
printf '[codex-exec] event=paths run_dir=%q status=%q run_env=%q monitor=%q continue=%q stdout=%q stderr=%q final=%q command=%q preflight=%q\n' \
  "$RUN_DIR" "$STATUS_FILE" "$RUN_ENV_FILE" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT" "$STDOUT_LOG" "$STDERR_LOG" "$FINAL_MESSAGE" "$COMMAND_FILE" "$PREFLIGHT_LOG"

if [[ "$JSON_OUTPUT" == "true" ]]; then
  printf '[codex-exec] event=json events=%q\n' "$EVENTS_LOG"
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "[FAIL] codex CLI not found on PATH" >&2
  write_status "failed" "127" 0
  printf '[codex-exec] event=finish exit_code=127 elapsed=0s stdout_lines=0 stderr_lines=0 final=%q\n' "$FINAL_MESSAGE"
  exit 127
fi

if [[ "$DRY_RUN" == "true" ]]; then
  write_status "dry-run" "0" 0
  echo "[codex-exec] event=dry-run exit_code=0"
  exit 0
fi

STARTED_AT="$(date +%s)"

# Mirror Codex output to logs and the terminal through named pipes with tracked
# tee PIDs. Process substitution (`> >(tee ...)`) leaves the tee unwaited, so
# `wait "$CHILD_PID"` can return before the final stderr line (the session id)
# is flushed to STDERR_LOG. Waiting on the tee PIDs makes capture deterministic.
STDOUT_PIPE="$RUN_DIR/.stdout.pipe"
STDERR_PIPE="$RUN_DIR/.stderr.pipe"
rm -f "$STDOUT_PIPE" "$STDERR_PIPE"
mkfifo "$STDOUT_PIPE" "$STDERR_PIPE"

if [[ "$JSON_OUTPUT" == "true" ]]; then
  # One tee fans out to both logs and the terminal, so $! is the FIFO reader
  # (a pipeline would set $! to the downstream tee, leaving the reader untracked
  # and unkillable in cleanup_children).
  tee -a "$STDOUT_LOG" "$EVENTS_LOG" < "$STDOUT_PIPE" &
else
  tee -a "$STDOUT_LOG" < "$STDOUT_PIPE" &
fi
STDOUT_TEE_PID=$!
tee -a "$STDERR_LOG" < "$STDERR_PIPE" >&2 &
STDERR_TEE_PID=$!

if [[ "$HAS_PROMPT" == "true" ]]; then
  "${run_cmd[@]}" < "$PROMPT_RUN_FILE" > "$STDOUT_PIPE" 2> "$STDERR_PIPE" &
else
  "${run_cmd[@]}" < /dev/null > "$STDOUT_PIPE" 2> "$STDERR_PIPE" &
fi

CHILD_PID=$!
write_status "running" "" 0
printf '[codex-exec] event=spawn pid=%s\n' "$CHILD_PID"

heartbeat_loop "$CHILD_PID" "$STARTED_AT" &
HEARTBEAT_PID=$!

set +e
wait "$CHILD_PID"
EXIT_CODE=$?
set -e

kill "$HEARTBEAT_PID" 2>/dev/null || true
wait "$HEARTBEAT_PID" 2>/dev/null || true

# Codex has exited and closed the pipes; drain the tees so the logs are fully
# written before we read the session id below, then remove the pipes.
wait "$STDOUT_TEE_PID" 2>/dev/null || true
wait "$STDERR_TEE_PID" 2>/dev/null || true
rm -f "$STDOUT_PIPE" "$STDERR_PIPE"

ENDED_AT="$(date +%s)"
ELAPSED=$((ENDED_AT - STARTED_AT))
FINAL_STATE="finished"
if (( EXIT_CODE != 0 )); then
  FINAL_STATE="failed"
fi
if [[ "$EPHEMERAL" != "true" ]]; then
  detected_session_id="$(extract_session_id_from_file "$STDERR_LOG")"
  if [[ -n "$detected_session_id" ]]; then
    SESSION_ID="$detected_session_id"
    RESUME_LAST="false"
  fi
fi
populate_final_message_fallback
write_run_env
write_status "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED"

stdout_lines="$(line_count "$STDOUT_LOG")"
stderr_lines="$(line_count "$STDERR_LOG")"
printf '[codex-exec] event=finish exit_code=%s elapsed=%ss stdout_lines=%s stderr_lines=%s session_id=%q final=%q final_source=%q continue=%q\n' \
  "$EXIT_CODE" "$ELAPSED" "$stdout_lines" "$stderr_lines" "$SESSION_ID" "$FINAL_MESSAGE" "$FINAL_SOURCE" "$CONTINUE_SCRIPT"

if (( TIMEOUT_SECONDS > 0 && EXIT_CODE == 124 )); then
  echo "[codex-exec] event=timeout timeout_seconds=$TIMEOUT_SECONDS"
fi

exit "$EXIT_CODE"
