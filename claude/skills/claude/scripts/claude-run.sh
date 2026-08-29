#!/usr/bin/env bash
set -euo pipefail
umask 077

MODE="${1:-}"

usage() {
  cat >&2 <<'EOF'
Usage: claude-run.sh run|review|resume [options] [-- extra-claude-args...]

  --prompt TEXT          Prompt text sent through stdin.
  --prompt-file PATH     Prompt file sent through stdin.
  --workspace PATH       Claude working directory (default: current directory).
  --run-root PATH        Artifact root (default: ~/.claude/headless-runs).
  --run-dir PATH         Exact artifact directory.
  --run-dir-file PATH    Publish the exact artifact directory immediately.
  --continue-run PATH    Resume the session and defaults from a prior run.
  --session ID           Resume this Claude session (resume mode).
  --permission-mode MODE Claude permission mode (default: auto).
  --read-only            Deny direct file-editing tools and disable workspace progress.
  --model MODEL          Override the configured Claude model.
  --effort LEVEL         low, medium, high, xhigh, or max.
  --agent NAME           Select a configured Claude agent.
  --name NAME            Set the Claude session display name.
  --allowed-tools RULES  Pass Claude allowed-tool rules.
  --tools TOOLS          Explicit non-empty Claude tool set.
  --no-tools             Explicitly run with no Claude tools.
  --disallowed-tools RULES
                         Pass Claude denied-tool rules.
  --max-budget-usd USD   Set the print-mode budget ceiling.
  --heartbeat SECONDS    Progress report interval (default: 15).
  --preflight-timeout SECS
                         Auth preflight deadline (default: 8).
  --stall-timeout SECS   Stop after no meaningful activity (default: 300).
  --report-timeout SECS  Stop when a child report stays unconsumed (default: 90).
  --timeout SECONDS      Overall process deadline (default: 2700).
  --no-session-persistence
                         Do not save a resumable Claude session.
  --dry-run              Write artifacts without launching Claude.

review runs directly in the requested workspace.
The wrapper never uses tmux and never automatically replays a Claude prompt.
EOF
}

case "$MODE" in
  run|review|resume) shift ;;
  -h|--help) usage; exit 0 ;;
  *) usage; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
PROMPT_TEXT=""
PROMPT_FILE=""
WORKSPACE="$PWD"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
RUN_ROOT="${CLAUDE_RUNS_DIR:-$CLAUDE_HOME/headless-runs}"
RUN_DIR=""
RUN_DIR_FILE=""
CONTINUE_RUN_DIR=""
SESSION_ID=""
PERMISSION_MODE="auto"
READ_ONLY="false"
MODEL=""
EFFORT=""
AGENT=""
SESSION_NAME=""
ALLOWED_TOOLS=""
TOOLS=""
NO_TOOLS="false"
DISALLOWED_TOOLS=""
MAX_BUDGET_USD=""
HEARTBEAT_SECONDS="${CLAUDE_HEARTBEAT_SECONDS:-15}"
STALL_TIMEOUT_SECONDS="${CLAUDE_STALL_TIMEOUT_SECONDS:-300}"
REPORT_TIMEOUT_SECONDS="${CLAUDE_REPORT_TIMEOUT_SECONDS:-90}"
TIMEOUT_SECONDS="${CLAUDE_TIMEOUT_SECONDS:-2700}"
PREFLIGHT_TIMEOUT_SECONDS="${CLAUDE_PREFLIGHT_TIMEOUT_SECONDS:-8}"
TERM_GRACE_SECONDS="${CLAUDE_TERM_GRACE_SECONDS:-5}"
NO_SESSION_PERSISTENCE="false"
DRY_RUN="false"
EXTRA_ARGS=()

WORKSPACE_SET="false"
RUN_ROOT_SET="false"
SESSION_SET="false"
PERMISSION_SET="false"
READ_ONLY_SET="false"
MODEL_SET="false"
EFFORT_SET="false"
HEARTBEAT_SET="false"
STALL_TIMEOUT_SET="false"
REPORT_TIMEOUT_SET="false"
TIMEOUT_SET="false"
PREFLIGHT_TIMEOUT_SET="false"
TOOLS_SET="false"
NO_TOOLS_SET="false"

require_value() {
  if [[ -z "${2:-}" ]]; then
    echo "[FAIL] missing value for $1" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT_TEXT="${2:-}"; require_value "$1" "$PROMPT_TEXT"; shift 2 ;;
    --prompt-file) PROMPT_FILE="${2:-}"; require_value "$1" "$PROMPT_FILE"; shift 2 ;;
    --workspace|--cd) WORKSPACE="${2:-}"; require_value "$1" "$WORKSPACE"; WORKSPACE_SET="true"; shift 2 ;;
    --run-root) RUN_ROOT="${2:-}"; require_value "$1" "$RUN_ROOT"; RUN_ROOT_SET="true"; shift 2 ;;
    --run-dir) RUN_DIR="${2:-}"; require_value "$1" "$RUN_DIR"; shift 2 ;;
    --run-dir-file) RUN_DIR_FILE="${2:-}"; require_value "$1" "$RUN_DIR_FILE"; shift 2 ;;
    --continue-run) CONTINUE_RUN_DIR="${2:-}"; require_value "$1" "$CONTINUE_RUN_DIR"; shift 2 ;;
    --session) SESSION_ID="${2:-}"; require_value "$1" "$SESSION_ID"; SESSION_SET="true"; shift 2 ;;
    --permission-mode) PERMISSION_MODE="${2:-}"; require_value "$1" "$PERMISSION_MODE"; PERMISSION_SET="true"; shift 2 ;;
    --read-only) READ_ONLY="true"; READ_ONLY_SET="true"; shift ;;
    --model) MODEL="${2:-}"; require_value "$1" "$MODEL"; MODEL_SET="true"; shift 2 ;;
    --effort) EFFORT="${2:-}"; require_value "$1" "$EFFORT"; EFFORT_SET="true"; shift 2 ;;
    --agent) AGENT="${2:-}"; require_value "$1" "$AGENT"; shift 2 ;;
    --name) SESSION_NAME="${2:-}"; require_value "$1" "$SESSION_NAME"; shift 2 ;;
    --allowed-tools) ALLOWED_TOOLS="${2:-}"; require_value "$1" "$ALLOWED_TOOLS"; shift 2 ;;
    --tools) TOOLS="${2:-}"; require_value "$1" "$TOOLS"; TOOLS_SET="true"; shift 2 ;;
    --no-tools) NO_TOOLS="true"; NO_TOOLS_SET="true"; shift ;;
    --disallowed-tools) DISALLOWED_TOOLS="${2:-}"; require_value "$1" "$DISALLOWED_TOOLS"; shift 2 ;;
    --max-budget-usd) MAX_BUDGET_USD="${2:-}"; require_value "$1" "$MAX_BUDGET_USD"; shift 2 ;;
    --heartbeat) HEARTBEAT_SECONDS="${2:-}"; require_value "$1" "$HEARTBEAT_SECONDS"; HEARTBEAT_SET="true"; shift 2 ;;
    --preflight-timeout) PREFLIGHT_TIMEOUT_SECONDS="${2:-}"; require_value "$1" "$PREFLIGHT_TIMEOUT_SECONDS"; PREFLIGHT_TIMEOUT_SET="true"; shift 2 ;;
    --stall-timeout) STALL_TIMEOUT_SECONDS="${2:-}"; require_value "$1" "$STALL_TIMEOUT_SECONDS"; STALL_TIMEOUT_SET="true"; shift 2 ;;
    --report-timeout) REPORT_TIMEOUT_SECONDS="${2:-}"; require_value "$1" "$REPORT_TIMEOUT_SECONDS"; REPORT_TIMEOUT_SET="true"; shift 2 ;;
    --timeout) TIMEOUT_SECONDS="${2:-}"; require_value "$1" "$TIMEOUT_SECONDS"; TIMEOUT_SET="true"; shift 2 ;;
    --no-session-persistence) NO_SESSION_PERSISTENCE="true"; shift ;;
    --dry-run) DRY_RUN="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; while [[ $# -gt 0 ]]; do EXTRA_ARGS+=("$1"); shift; done ;;
    *) echo "[FAIL] unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -n "$PROMPT_TEXT" && -n "$PROMPT_FILE" ]]; then
  echo "[FAIL] use either --prompt or --prompt-file, not both" >&2
  exit 2
fi
if [[ -z "$PROMPT_TEXT" && -z "$PROMPT_FILE" ]]; then
  echo "[FAIL] $MODE mode requires --prompt or --prompt-file" >&2
  exit 2
fi
if [[ "$NO_TOOLS" == "true" && -n "$TOOLS" ]]; then
  echo "[FAIL] use either --tools or --no-tools, not both" >&2
  exit 2
fi
if [[ -n "$ALLOWED_TOOLS" && "$ALLOWED_TOOLS" != *[A-Za-z0-9]* ]]; then
  echo "[FAIL] --allowed-tools must name at least one tool" >&2
  exit 2
fi
if [[ -n "$TOOLS" && "$TOOLS" != *[A-Za-z0-9]* ]]; then
  echo "[FAIL] --tools must name at least one tool; use --no-tools explicitly for none" >&2
  exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "[FAIL] python3 is required" >&2
  exit 127
fi

for number in "$HEARTBEAT_SECONDS" "$PREFLIGHT_TIMEOUT_SECONDS" "$STALL_TIMEOUT_SECONDS" "$REPORT_TIMEOUT_SECONDS" "$TIMEOUT_SECONDS" "$TERM_GRACE_SECONDS"; do
  case "$number" in ''|*[!0-9]*) echo "[FAIL] timeout and heartbeat values must be integer seconds" >&2; exit 2 ;; esac
done
if (( HEARTBEAT_SECONDS < 1 )); then
  echo "[FAIL] --heartbeat must be at least 1" >&2
  exit 2
fi
if (( PREFLIGHT_TIMEOUT_SECONDS < 1 )); then
  echo "[FAIL] --preflight-timeout must be at least 1" >&2
  exit 2
fi
absolute_path() {
  case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac
}

shell_quote() { printf '%q' "$1"; }

read_env_values() {
  local path="$1"
  shift
  [[ -f "$path" ]] || return 0
  python3 - "$path" "$@" <<'PY'
import shlex, sys
from pathlib import Path

targets = sys.argv[2:]
found = {}
for line in reversed(Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()):
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
        print(f"{key}\t{found[key]}")
PY
}

load_continue_defaults() {
  [[ -n "$CONTINUE_RUN_DIR" ]] || return 0
  CONTINUE_RUN_DIR="$(absolute_path "$CONTINUE_RUN_DIR")"
  local prior="$CONTINUE_RUN_DIR/run.env"
  [[ -f "$prior" ]] || { echo "[FAIL] prior run.env not found: $prior" >&2; exit 2; }
  local key value
  while IFS=$'\t' read -r key value; do
    case "$key" in
      WORKSPACE) [[ "$WORKSPACE_SET" == "true" ]] || WORKSPACE="$value" ;;
      RUN_ROOT) [[ "$RUN_ROOT_SET" == "true" ]] || RUN_ROOT="$value" ;;
      SESSION_ID) [[ "$SESSION_SET" == "true" ]] || SESSION_ID="$value" ;;
      PERMISSION_MODE) [[ "$PERMISSION_SET" == "true" ]] || PERMISSION_MODE="$value" ;;
      READ_ONLY) [[ "$READ_ONLY_SET" == "true" ]] || READ_ONLY="$value" ;;
      MODEL) [[ "$MODEL_SET" == "true" ]] || MODEL="$value" ;;
      EFFORT) [[ "$EFFORT_SET" == "true" ]] || EFFORT="$value" ;;
      TOOLS) [[ "$TOOLS_SET" == "true" ]] || TOOLS="$value" ;;
      NO_TOOLS) [[ "$NO_TOOLS_SET" == "true" ]] || NO_TOOLS="$value" ;;
      PREFLIGHT_TIMEOUT_SECONDS) [[ "$PREFLIGHT_TIMEOUT_SET" == "true" ]] || PREFLIGHT_TIMEOUT_SECONDS="$value" ;;
      HEARTBEAT_SECONDS) [[ "$HEARTBEAT_SET" == "true" ]] || HEARTBEAT_SECONDS="$value" ;;
      STALL_TIMEOUT_SECONDS) [[ "$STALL_TIMEOUT_SET" == "true" ]] || STALL_TIMEOUT_SECONDS="$value" ;;
      REPORT_TIMEOUT_SECONDS) [[ "$REPORT_TIMEOUT_SET" == "true" ]] || REPORT_TIMEOUT_SECONDS="$value" ;;
      TIMEOUT_SECONDS) [[ "$TIMEOUT_SET" == "true" ]] || TIMEOUT_SECONDS="$value" ;;
      NO_SESSION_PERSISTENCE) NO_SESSION_PERSISTENCE="$value" ;;
    esac
  done < <(read_env_values "$prior" WORKSPACE RUN_ROOT SESSION_ID PERMISSION_MODE READ_ONLY MODEL EFFORT TOOLS NO_TOOLS PREFLIGHT_TIMEOUT_SECONDS HEARTBEAT_SECONDS STALL_TIMEOUT_SECONDS REPORT_TIMEOUT_SECONDS TIMEOUT_SECONDS NO_SESSION_PERSISTENCE)
  [[ "$NO_SESSION_PERSISTENCE" != "true" ]] || { echo "[FAIL] prior run disabled session persistence" >&2; exit 2; }
  [[ -n "$SESSION_ID" ]] || { echo "[FAIL] prior run has no Claude session id" >&2; exit 2; }
}

load_continue_defaults

case "$PREFLIGHT_TIMEOUT_SECONDS" in
  ''|*[!0-9]*) echo "[FAIL] preflight timeout must be integer seconds" >&2; exit 2 ;;
esac
if (( PREFLIGHT_TIMEOUT_SECONDS < 1 )); then
  echo "[FAIL] --preflight-timeout must be at least 1" >&2
  exit 2
fi
if [[ "$NO_TOOLS" != "true" && "$NO_TOOLS" != "false" ]]; then
  echo "[FAIL] continued NO_TOOLS must be true or false" >&2
  exit 2
fi
if [[ -n "$TOOLS" && "$TOOLS" != *[A-Za-z0-9]* ]]; then
  echo "[FAIL] continued tool set must name at least one tool" >&2
  exit 2
fi

RESUMING="false"
if [[ "$MODE" == "resume" || -n "$CONTINUE_RUN_DIR" ]]; then
  RESUMING="true"
fi

if [[ "$MODE" == "resume" && -z "$SESSION_ID" ]]; then
  echo "[FAIL] resume requires --session or --continue-run" >&2
  exit 2
fi
if [[ "$MODE" != "resume" && -z "$SESSION_ID" ]]; then
  if command -v uuidgen >/dev/null 2>&1; then
    SESSION_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  else
    SESSION_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  fi
fi

WORKSPACE="$(absolute_path "$WORKSPACE")"
RUN_ROOT="$(absolute_path "$RUN_ROOT")"
[[ -d "$WORKSPACE" ]] || { echo "[FAIL] workspace does not exist: $WORKSPACE" >&2; exit 2; }
mkdir -p "$RUN_ROOT"
if [[ -z "$RUN_DIR" ]]; then
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  RUN_DIR="$RUN_ROOT/$RUN_ID-$(basename "$WORKSPACE")-$MODE"
else
  RUN_DIR="$(absolute_path "$RUN_DIR")"
  RUN_ID="$(basename "$RUN_DIR")"
fi
mkdir -p "$RUN_DIR"
if [[ -n "$RUN_DIR_FILE" ]]; then
  RUN_DIR_FILE="$(absolute_path "$RUN_DIR_FILE")"
  mkdir -p "$(dirname "$RUN_DIR_FILE")"
  printf '%s\n' "$RUN_DIR" > "$RUN_DIR_FILE"
fi

PROMPT_RUN_FILE="$RUN_DIR/prompt.txt"
STDOUT_LOG="$RUN_DIR/stdout.log"
STDERR_LOG="$RUN_DIR/stderr.log"
EVENTS_LOG="$RUN_DIR/events.jsonl"
FINAL_MESSAGE="$RUN_DIR/final.md"
RUN_ENV_FILE="$RUN_DIR/run.env"
STATUS_FILE="$RUN_DIR/status.env"
STATUS_JSON="$RUN_DIR/status.json"
COMMAND_FILE="$RUN_DIR/command.txt"
PREFLIGHT_LOG="$RUN_DIR/preflight.log"
PREFLIGHT_JSON="$RUN_DIR/preflight.json"
PREFLIGHT_SCRIPT="$SCRIPT_DIR/claude-preflight.py"
RESOLVED_MODEL_FILE="$RUN_DIR/resolved-model.txt"
MONITOR_SCRIPT="$RUN_DIR/monitor.sh"
CONTINUE_SCRIPT="$RUN_DIR/continue.sh"
BASELINE_FILE="$RUN_DIR/workspace-baseline.txt"
CHILD_REPORT_DIR="$RUN_DIR/child-reports"
STALL_MARKER="$RUN_DIR/.stalled"
HARD_TIMEOUT_MARKER="$RUN_DIR/.hard-timeout"
STDOUT_PIPE="$RUN_DIR/.stdout.pipe"
STDERR_PIPE="$RUN_DIR/.stderr.pipe"
rm -f "$STALL_MARKER" "$HARD_TIMEOUT_MARKER" "$STDOUT_PIPE" "$STDERR_PIPE"
rm -rf "$CHILD_REPORT_DIR"
mkdir -p "$CHILD_REPORT_DIR"
: > "$STDOUT_LOG"
: > "$STDERR_LOG"
: > "$EVENTS_LOG"
: > "$FINAL_MESSAGE"
: > "$RESOLVED_MODEL_FILE"

PREFLIGHT_STATUS="pending"
PREFLIGHT_REASON="not_run"
PREFLIGHT_TERMINAL="pty"
PREFLIGHT_AUTH_EXIT=""
PREFLIGHT_DURATION_MS=0
PREFLIGHT_CLI_VERSION="unknown"
PREFLIGHT_CLI_PATH=""
REQUESTED_MODEL="${MODEL:-configured-default}"
REQUESTED_EFFORT="${EFFORT:-configured-default}"
MODEL_SELECTION="configured-default"
EFFORT_SELECTION="configured-default"
RESOLVED_MODEL=""
[[ -z "$MODEL" ]] || MODEL_SELECTION="explicit"
[[ -z "$EFFORT" ]] || EFFORT_SELECTION="explicit"

if [[ -n "$PROMPT_TEXT" ]]; then
  printf '%s\n' "$PROMPT_TEXT" > "$PROMPT_RUN_FILE"
else
  cp "$PROMPT_FILE" "$PROMPT_RUN_FILE"
fi

CLAUDE_EXECUTABLE="${CLAUDE_BIN:-claude}"
claude_cmd=("$CLAUDE_EXECUTABLE" -p --output-format stream-json --verbose --include-partial-messages --include-hook-events --permission-mode "$PERMISSION_MODE")
if [[ "$RESUMING" == "true" ]]; then
  claude_cmd+=(--resume "$SESSION_ID")
else
  claude_cmd+=(--session-id "$SESSION_ID")
fi
[[ -z "$MODEL" ]] || claude_cmd+=(--model "$MODEL")
[[ -z "$EFFORT" ]] || claude_cmd+=(--effort "$EFFORT")
[[ -z "$AGENT" ]] || claude_cmd+=(--agent "$AGENT")
[[ -z "$SESSION_NAME" ]] || claude_cmd+=(--name "$SESSION_NAME")
if [[ "$NO_TOOLS" == "true" ]]; then
  claude_cmd+=(--tools "")
elif [[ -n "$TOOLS" ]]; then
  claude_cmd+=(--tools "$TOOLS")
fi
[[ -z "$ALLOWED_TOOLS" ]] || claude_cmd+=(--allowed-tools "$ALLOWED_TOOLS")
if [[ "$READ_ONLY" == "true" ]]; then
  if [[ -n "$DISALLOWED_TOOLS" ]]; then
    DISALLOWED_TOOLS="$DISALLOWED_TOOLS,Edit,Write,NotebookEdit"
  else
    DISALLOWED_TOOLS="Edit,Write,NotebookEdit"
  fi
fi
[[ -z "$DISALLOWED_TOOLS" ]] || claude_cmd+=(--disallowed-tools "$DISALLOWED_TOOLS")
[[ -z "$MAX_BUDGET_USD" ]] || claude_cmd+=(--max-budget-usd "$MAX_BUDGET_USD")
[[ "$NO_SESSION_PERSISTENCE" != "true" ]] || claude_cmd+=(--no-session-persistence)
(( ${#EXTRA_ARGS[@]} == 0 )) || claude_cmd+=("${EXTRA_ARGS[@]}")

write_command() {
  {
    printf 'cwd='; shell_quote "$WORKSPACE"; printf '\ncommand='
    for arg in "${claude_cmd[@]}"; do shell_quote "$arg"; printf ' '; done
    printf '\nstdin='; shell_quote "$PROMPT_RUN_FILE"; printf '\n'
  } > "$COMMAND_FILE"
}

line_count() { [[ -f "$1" ]] && wc -l < "$1" | tr -d '[:space:]' || printf 0; }

TRANSCRIPT_FILE=""
TRANSCRIPT_FINGERPRINT="none"
TRANSCRIPT_LINES=0
TRANSCRIPT_BYTES=0
CHILD_COUNT=0
COMPLETED_CHILDREN=0
REPORT_PENDING="false"

snapshot_transcripts() {
  local output key value
  output="$(python3 - "$CLAUDE_HOME" "$SESSION_ID" "$CHILD_REPORT_DIR" <<'PY'
import hashlib, json, os, signal, sys
from pathlib import Path

signal.signal(signal.SIGPIPE, signal.SIG_DFL)

home, session_id, report_dir = map(Path, sys.argv[1:])
parents = list((home / "projects").glob(f"*/{session_id}.jsonl"))
parent = parents[0] if parents else None
children = list((parent.parent / session_id / "subagents").glob("*.jsonl")) if parent else []
files = ([parent] if parent else []) + children
fingerprint = hashlib.sha256()
lines = 0
total_bytes = 0
try:
    parent_mtime = parent.stat().st_mtime_ns if parent else 0
except OSError:
    parent_mtime = 0
completed = 0
latest_completed_mtime = 0
report_root = Path(report_dir)
report_root.mkdir(parents=True, exist_ok=True)

for path in files:
    try:
        stat = path.stat()
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            content = handle.readlines()
    except OSError:
        continue
    fingerprint.update(f"{path}:{stat.st_size}:{stat.st_mtime_ns}".encode())
    total_bytes += stat.st_size
    lines += len(content)
    if path == parent:
        continue
    final_text = ""
    is_complete = False
    for raw in content:
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue
        message = event.get("message") or {}
        if event.get("type") != "assistant" or message.get("stop_reason") != "end_turn":
            continue
        parts = [part.get("text", "") for part in message.get("content", []) if part.get("type") == "text"]
        text = "\n".join(part for part in parts if part).strip()
        if text:
            final_text = text
            is_complete = True
    if is_complete:
        completed += 1
        latest_completed_mtime = max(latest_completed_mtime, stat.st_mtime_ns)
        report = report_root / f"{path.stem}.md"
        rendered = f"# Claude child report: {path.stem}\n\n{final_text}\n"
        if not report.exists() or report.read_text(encoding="utf-8") != rendered:
            tmp = report.with_suffix(f".tmp.{os.getpid()}")
            tmp.write_text(rendered, encoding="utf-8")
            tmp.replace(report)

pending = completed > 0 and latest_completed_mtime > parent_mtime
try:
    print(f"TRANSCRIPT_FILE\t{parent or ''}")
    print(f"TRANSCRIPT_FINGERPRINT\t{fingerprint.hexdigest() if files else 'none'}")
    print(f"TRANSCRIPT_LINES\t{lines}")
    print(f"TRANSCRIPT_BYTES\t{total_bytes}")
    print(f"CHILD_COUNT\t{len(children)}")
    print(f"COMPLETED_CHILDREN\t{completed}")
    print(f"REPORT_PENDING\t{'true' if pending else 'false'}")
except BrokenPipeError:
    pass
PY
)"
  while IFS=$'\t' read -r key value; do
    case "$key" in
      TRANSCRIPT_FILE) TRANSCRIPT_FILE="$value" ;;
      TRANSCRIPT_FINGERPRINT) TRANSCRIPT_FINGERPRINT="$value" ;;
      TRANSCRIPT_LINES) TRANSCRIPT_LINES="$value" ;;
      TRANSCRIPT_BYTES) TRANSCRIPT_BYTES="$value" ;;
      CHILD_COUNT) CHILD_COUNT="$value" ;;
      COMPLETED_CHILDREN) COMPLETED_CHILDREN="$value" ;;
      REPORT_PENDING) REPORT_PENDING="$value" ;;
    esac
  done <<< "$output"
}

workspace_progress_fingerprint() {
  if [[ "$READ_ONLY" == "true" ]] || ! git -C "$WORKSPACE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'read-only'
    return 0
  fi
  {
    git -C "$WORKSPACE" rev-parse --verify HEAD 2>/dev/null || true
    git -C "$WORKSPACE" diff --binary HEAD -- 2>/dev/null || true
    git -C "$WORKSPACE" ls-files --others --exclude-standard -z 2>/dev/null |
      while IFS= read -r -d '' path; do
        printf 'untracked\0%s\0' "$path"
        git -C "$WORKSPACE" hash-object --no-filters -- "$path" 2>/dev/null || true
      done
  } | cksum | awk '{print $1 ":" $2}'
}

write_run_env() {
  {
    printf 'MODE=%q\n' "$MODE"
    printf 'WORKSPACE=%q\n' "$WORKSPACE"
    printf 'RUN_ROOT=%q\n' "$RUN_ROOT"
    printf 'RUN_DIR=%q\n' "$RUN_DIR"
    printf 'RUN_DIR_FILE=%q\n' "$RUN_DIR_FILE"
    printf 'SESSION_ID=%q\n' "$SESSION_ID"
    printf 'PERMISSION_MODE=%q\n' "$PERMISSION_MODE"
    printf 'READ_ONLY=%q\n' "$READ_ONLY"
    printf 'MODEL=%q\n' "$MODEL"
    printf 'EFFORT=%q\n' "$EFFORT"
    printf 'REQUESTED_MODEL=%q\n' "$REQUESTED_MODEL"
    printf 'REQUESTED_EFFORT=%q\n' "$REQUESTED_EFFORT"
    printf 'MODEL_SELECTION=%q\n' "$MODEL_SELECTION"
    printf 'EFFORT_SELECTION=%q\n' "$EFFORT_SELECTION"
    printf 'RESOLVED_MODEL=%q\n' "$RESOLVED_MODEL"
    printf 'PREFLIGHT_STATUS=%q\n' "$PREFLIGHT_STATUS"
    printf 'PREFLIGHT_TIMEOUT_SECONDS=%q\n' "$PREFLIGHT_TIMEOUT_SECONDS"
    printf 'TOOLS=%q\n' "$TOOLS"
    printf 'NO_TOOLS=%q\n' "$NO_TOOLS"
    printf 'HEARTBEAT_SECONDS=%q\n' "$HEARTBEAT_SECONDS"
    printf 'STALL_TIMEOUT_SECONDS=%q\n' "$STALL_TIMEOUT_SECONDS"
    printf 'REPORT_TIMEOUT_SECONDS=%q\n' "$REPORT_TIMEOUT_SECONDS"
    printf 'TIMEOUT_SECONDS=%q\n' "$TIMEOUT_SECONDS"
    printf 'NO_SESSION_PERSISTENCE=%q\n' "$NO_SESSION_PERSISTENCE"
  } > "$RUN_ENV_FILE"
}

write_status() {
  local state="$1" exit_code="${2:-}" elapsed="${3:-0}" health="${4:-$1}" stalled_for="${5:-0}" source="${6:-none}"
  local stdout_lines stderr_lines event_lines status_tmp
  stdout_lines="$(line_count "$STDOUT_LOG")"
  stderr_lines="$(line_count "$STDERR_LOG")"
  event_lines="$(line_count "$EVENTS_LOG")"
  status_tmp="$(mktemp "$STATUS_FILE.tmp.XXXXXX")"
  {
    printf 'state=%q\nhealth=%q\nexit_code=%q\nelapsed_seconds=%q\nstalled_for_seconds=%q\nprogress_source=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source"
    printf 'pid=%q\nwrapper_pid=%q\nsession_id=%q\nworkspace=%q\nrun_dir=%q\nrun_dir_file=%q\n' "${CHILD_PID:-}" "$$" "$SESSION_ID" "$WORKSPACE" "$RUN_DIR" "$RUN_DIR_FILE"
    printf 'preflight_status=%q\npreflight_reason=%q\npreflight_terminal=%q\npreflight_auth_exit_code=%q\npreflight_duration_ms=%q\npreflight_cli_version=%q\n' "$PREFLIGHT_STATUS" "$PREFLIGHT_REASON" "$PREFLIGHT_TERMINAL" "$PREFLIGHT_AUTH_EXIT" "$PREFLIGHT_DURATION_MS" "$PREFLIGHT_CLI_VERSION"
    printf 'requested_model=%q\nrequested_effort=%q\nmodel_selection=%q\neffort_selection=%q\nresolved_model=%q\n' "$REQUESTED_MODEL" "$REQUESTED_EFFORT" "$MODEL_SELECTION" "$EFFORT_SELECTION" "$RESOLVED_MODEL"
    printf 'tools=%q\nno_tools=%q\n' "$TOOLS" "$NO_TOOLS"
    printf 'stdout_lines=%q\nstderr_lines=%q\nevent_lines=%q\n' "$stdout_lines" "$stderr_lines" "$event_lines"
    printf 'transcript_file=%q\ntranscript_lines=%q\ntranscript_bytes=%q\n' "$TRANSCRIPT_FILE" "$TRANSCRIPT_LINES" "$TRANSCRIPT_BYTES"
    printf 'child_count=%q\ncompleted_children=%q\nreport_pending=%q\nchild_report_dir=%q\n' "$CHILD_COUNT" "$COMPLETED_CHILDREN" "$REPORT_PENDING" "$CHILD_REPORT_DIR"
    printf 'stdout_log=%q\nstderr_log=%q\nevents_log=%q\nfinal_message=%q\nmonitor_script=%q\ncontinue_script=%q\n' "$STDOUT_LOG" "$STDERR_LOG" "$EVENTS_LOG" "$FINAL_MESSAGE" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT"
  } > "$status_tmp"
  mv "$status_tmp" "$STATUS_FILE"
  python3 - "$STATUS_JSON" "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source" "${CHILD_PID:-}" "$$" "$SESSION_ID" "$WORKSPACE" "$RUN_DIR" "$RUN_DIR_FILE" "$stdout_lines" "$stderr_lines" "$event_lines" "$TRANSCRIPT_FILE" "$TRANSCRIPT_LINES" "$TRANSCRIPT_BYTES" "$CHILD_COUNT" "$COMPLETED_CHILDREN" "$REPORT_PENDING" "$CHILD_REPORT_DIR" "$STDOUT_LOG" "$STDERR_LOG" "$EVENTS_LOG" "$FINAL_MESSAGE" "$PREFLIGHT_STATUS" "$PREFLIGHT_REASON" "$PREFLIGHT_TERMINAL" "$PREFLIGHT_AUTH_EXIT" "$PREFLIGHT_DURATION_MS" "$PREFLIGHT_CLI_VERSION" "$REQUESTED_MODEL" "$REQUESTED_EFFORT" "$MODEL_SELECTION" "$EFFORT_SELECTION" "$RESOLVED_MODEL" "$TOOLS" "$NO_TOOLS" <<'PY'
import json, os, sys
from pathlib import Path

(path, state, health, exit_code, elapsed, stalled, source, pid, wrapper_pid,
 session, workspace, run_dir, run_dir_file, stdout_lines, stderr_lines, event_lines, transcript, transcript_lines,
 transcript_bytes, child_count, completed, pending, reports, stdout, stderr,
 events, final, preflight_status, preflight_reason, preflight_terminal,
 preflight_auth_exit, preflight_duration, preflight_version, requested_model,
 requested_effort, model_selection, effort_selection, resolved_model,
 tools, no_tools) = sys.argv[1:]
def number(value): return int(value) if value.isdigit() else None
data = {
  "state": state, "health": health, "exit_code": number(exit_code),
  "elapsed_seconds": number(elapsed) or 0, "stalled_for_seconds": number(stalled) or 0,
  "progress_source": source, "pid": number(pid), "wrapper_pid": number(wrapper_pid),
  "session_id": session, "workspace": workspace, "run_dir": run_dir,
  "run_dir_file": run_dir_file,
  "stdout_lines": number(stdout_lines) or 0, "stderr_lines": number(stderr_lines) or 0,
  "event_lines": number(event_lines) or 0, "transcript_file": transcript,
  "transcript_lines": number(transcript_lines) or 0, "transcript_bytes": number(transcript_bytes) or 0,
  "child_count": number(child_count) or 0, "completed_children": number(completed) or 0,
  "report_pending": pending == "true", "child_report_dir": reports,
  "stdout_log": stdout, "stderr_log": stderr, "events_log": events, "final_message": final,
  "preflight": {
    "status": preflight_status, "reason": preflight_reason,
    "terminal_envelope": preflight_terminal,
    "auth_exit_code": number(preflight_auth_exit),
    "duration_ms": number(preflight_duration) or 0,
    "cli_version": preflight_version,
  },
  "routing": {
    "requested_model": requested_model, "requested_effort": requested_effort,
    "model_selection": model_selection, "effort_selection": effort_selection,
    "resolved_model": resolved_model,
  },
  "tools": {"available": tools, "explicitly_none": no_tools == "true"},
}
tmp = Path(path + f".tmp.{os.getpid()}")
tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
tmp.replace(path)
PY
}

write_preflight_artifacts() {
  {
    printf 'status=%s\n' "$PREFLIGHT_STATUS"
    printf 'reason=%s\n' "$PREFLIGHT_REASON"
    printf 'terminal_envelope=%s\n' "$PREFLIGHT_TERMINAL"
    printf 'auth_exit_code=%s\n' "$PREFLIGHT_AUTH_EXIT"
    printf 'duration_ms=%s\n' "$PREFLIGHT_DURATION_MS"
    printf 'cli_version=%s\n' "$PREFLIGHT_CLI_VERSION"
  } > "$PREFLIGHT_LOG"
  if [[ ! -f "$PREFLIGHT_JSON" ]]; then
    python3 - "$PREFLIGHT_JSON" "$PREFLIGHT_STATUS" "$PREFLIGHT_REASON" "$PREFLIGHT_TERMINAL" "$PREFLIGHT_AUTH_EXIT" "$PREFLIGHT_DURATION_MS" "$PREFLIGHT_CLI_VERSION" <<'PY'
import json, os, sys
from pathlib import Path

path, status, reason, terminal, auth_exit, duration, version = sys.argv[1:]
data = {
    "status": status,
    "authenticated": status == "authenticated",
    "reason": reason,
    "terminal_envelope": terminal,
    "auth_exit_code": int(auth_exit) if auth_exit.isdigit() else None,
    "cli_version": version,
    "cli_path": "",
    "duration_ms": int(duration) if duration.isdigit() else 0,
}
temporary = Path(path + f".tmp.{os.getpid()}")
temporary.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
os.chmod(temporary, 0o600)
temporary.replace(path)
PY
  fi
}

cat > "$MONITOR_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
RUN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATUS="$RUN_DIR/status.json"
STARTED_AT="$(date +%s)"
MONITOR_TIMEOUT="${CLAUDE_MONITOR_TIMEOUT_SECONDS:-3600}"
case "$MONITOR_TIMEOUT" in
  ''|*[!0-9]*) echo "[claude-run] monitor=failed detail=CLAUDE_MONITOR_TIMEOUT_SECONDS-must-be-an-integer" >&2; exit 2 ;;
esac
while true; do
  if [[ -f "$STATUS" ]]; then
    row="$(python3 - "$STATUS" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
print("\t".join(str(d.get(k, "")) for k in ("state","health","exit_code","elapsed_seconds","stalled_for_seconds","child_count","completed_children","report_pending","final_message","wrapper_pid")))
PY
)"
    IFS=$'\t' read -r state health exit_code elapsed stalled children completed pending final wrapper_pid <<< "$row"
    case "$state" in
      finished|failed|blocked|stalled|timed-out|interrupted|dry-run)
        printf '[claude-run] monitor=done state=%s health=%s exit_code=%s elapsed=%ss children=%s completed=%s report_pending=%s final=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$children" "$completed" "$pending" "$final"
        [[ "$exit_code" =~ ^[0-9]+$ ]] && exit "$exit_code"
        exit 1 ;;
    esac
    if [[ "$wrapper_pid" =~ ^[0-9]+$ ]] && ! kill -0 "$wrapper_pid" 2>/dev/null; then
      printf '[claude-run] monitor=abandoned state=%s wrapper_pid=%s detail=wrapper-exited-without-terminal-status\n' "$state" "$wrapper_pid" >&2
      exit 1
    fi
  fi
  if (( MONITOR_TIMEOUT > 0 && $(date +%s)-STARTED_AT >= MONITOR_TIMEOUT )); then
    printf '[claude-run] monitor=timed-out timeout=%ss status=%q\n' "$MONITOR_TIMEOUT" "$STATUS" >&2
    exit 124
  fi
  sleep "${CLAUDE_MONITOR_POLL_SECONDS:-3}"
done
EOF
chmod u=rwx,go= "$MONITOR_SCRIPT"

cat > "$CONTINUE_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec $(shell_quote "$SCRIPT_PATH") resume --continue-run $(shell_quote "$RUN_DIR") "\$@"
EOF
chmod u=rwx,go= "$CONTINUE_SCRIPT"

BASE_HEAD=""
capture_workspace_baseline() {
  [[ "$READ_ONLY" != "true" ]] || return 0
  BASE_HEAD="$(git -C "$WORKSPACE" rev-parse --verify HEAD 2>/dev/null || true)"
  { printf 'workspace=%s\nhead=%s\nstatus_before:\n' "$WORKSPACE" "$BASE_HEAD"; git -C "$WORKSPACE" status --short 2>/dev/null || true; } > "$BASELINE_FILE"
}

capture_workspace_artifacts() {
  [[ "$READ_ONLY" != "true" ]] || return 0
  git -C "$WORKSPACE" status --short > "$RUN_DIR/workspace-status.txt" 2>/dev/null || true
  {
    [[ -z "$BASE_HEAD" ]] || git -C "$WORKSPACE" diff "$BASE_HEAD" 2>/dev/null || true
    while IFS= read -r -d '' path; do
      git -C "$WORKSPACE" diff --no-index -- /dev/null "$path" 2>/dev/null || true
    done < <(git -C "$WORKSPACE" ls-files --others --exclude-standard -z 2>/dev/null || true)
  } > "$RUN_DIR/workspace.diff"
  { [[ -z "$BASE_HEAD" ]] || git -C "$WORKSPACE" diff --name-only "$BASE_HEAD" 2>/dev/null || true; git -C "$WORKSPACE" ls-files --others --exclude-standard 2>/dev/null || true; } | awk 'NF && !seen[$0]++' > "$RUN_DIR/changed-files.txt"
}

descendant_pids() {
  local parent="$1" child
  command -v pgrep >/dev/null 2>&1 || return 0
  while IFS= read -r child; do [[ "$child" =~ ^[0-9]+$ ]] || continue; descendant_pids "$child"; printf '%s\n' "$child"; done < <(pgrep -P "$parent" 2>/dev/null || true)
}

terminate_process_tree() {
  local root="$1" grace="$TERM_GRACE_SECONDS" pid attempt alive
  local targets=()
  while IFS= read -r pid; do targets+=("$pid"); done < <(descendant_pids "$root")
  targets+=("$root")
  kill -TERM -- "-$root" 2>/dev/null || true
  kill -TERM "${targets[@]}" 2>/dev/null || true
  for ((attempt=0; attempt<grace*10; attempt++)); do
    alive="false"
    kill -0 -- "-$root" 2>/dev/null && alive="true"
    [[ "$alive" == "false" ]] && return 0
    sleep 0.1
  done
  kill -KILL -- "-$root" 2>/dev/null || true
  kill -KILL "${targets[@]}" 2>/dev/null || true
}

# shellcheck disable=SC2329 # Called through signal traps.
cleanup_children() {
  [[ -z "${HEARTBEAT_PID:-}" ]] || kill "$HEARTBEAT_PID" 2>/dev/null || true
  [[ -z "${HARD_TIMEOUT_PID:-}" ]] || kill "$HARD_TIMEOUT_PID" 2>/dev/null || true
  [[ -z "${CHILD_PID:-}" ]] || terminate_process_tree "$CHILD_PID"
  [[ -z "${STDOUT_TEE_PID:-}" ]] || kill "$STDOUT_TEE_PID" 2>/dev/null || true
  [[ -z "${STDERR_TEE_PID:-}" ]] || kill "$STDERR_TEE_PID" 2>/dev/null || true
}

RUN_FINALIZED="false"

# shellcheck disable=SC2329 # Called through the EXIT trap.
cleanup_on_exit() {
  local code=$? elapsed=0
  trap - EXIT INT TERM
  if [[ "$RUN_FINALIZED" != "true" ]]; then
    cleanup_children
    rm -f "${STDOUT_PIPE:-}" "${STDERR_PIPE:-}"
    [[ -z "${STARTED_AT:-}" ]] || elapsed=$(($(date +%s)-STARTED_AT))
    if [[ -n "${STATUS_FILE:-}" && -f "${STATUS_FILE:-}" ]]; then
      write_status failed "$code" "$elapsed" failed 0 wrapper-exit || true
    fi
  fi
  exit "$code"
}

# shellcheck disable=SC2329 # Called through signal traps.
handle_signal() {
  local signal="$1" code="$2" elapsed=0
  [[ -z "${STARTED_AT:-}" ]] || elapsed=$(($(date +%s)-STARTED_AT))
  cleanup_children
  rm -f "$STDOUT_PIPE" "$STDERR_PIPE"
  write_status interrupted "$code" "$elapsed" interrupted
  RUN_FINALIZED="true"
  echo "[claude-run] event=interrupt signal=$signal"
  exit "$code"
}
trap cleanup_on_exit EXIT
trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM

heartbeat_loop() {
  local pid="$1" last_progress="$2" pending_since=0 previous="" now elapsed fingerprint workspace_hash stdout_lines stderr_lines stalled health source
  snapshot_transcripts
  workspace_hash="$(workspace_progress_fingerprint)"
  previous="$(line_count "$STDOUT_LOG"):$(line_count "$STDERR_LOG"):$TRANSCRIPT_FINGERPRINT:$workspace_hash"
  while kill -0 "$pid" 2>/dev/null; do
    sleep "$HEARTBEAT_SECONDS"
    kill -0 "$pid" 2>/dev/null || break
    now="$(date +%s)"; elapsed=$((now-STARTED_AT))
    snapshot_transcripts
    stdout_lines="$(line_count "$STDOUT_LOG")"; stderr_lines="$(line_count "$STDERR_LOG")"
    workspace_hash="$(workspace_progress_fingerprint)"
    fingerprint="$stdout_lines:$stderr_lines:$TRANSCRIPT_FINGERPRINT:$workspace_hash"
    source="none"
    if [[ "$fingerprint" != "$previous" ]]; then previous="$fingerprint"; last_progress="$now"; source="stream-transcript-or-workspace"; fi
    stalled=$((now-last_progress))
    health="active"
    if [[ "$REPORT_PENDING" == "true" ]]; then
      health="report-pending"
      (( pending_since > 0 )) || pending_since="$now"
      [[ "$source" == "none" ]] || pending_since="$now"
    else
      pending_since=0
    fi
    if (( pending_since > 0 && REPORT_TIMEOUT_SECONDS > 0 && now-pending_since >= REPORT_TIMEOUT_SECONDS )); then
      kill -0 "$pid" 2>/dev/null || break
      printf 'report-pending\n' > "$STALL_MARKER"
      write_status running "" "$elapsed" report-pending "$stalled" child-report
      printf '[claude-run] event=stall kind=report-pending elapsed=%ss pending_for=%ss pid=%s\n' "$elapsed" "$((now-pending_since))" "$pid"
      terminate_process_tree "$pid"
      return 0
    fi
    if (( STALL_TIMEOUT_SECONDS > 0 && stalled >= STALL_TIMEOUT_SECONDS )); then
      kill -0 "$pid" 2>/dev/null || break
      printf 'silent\n' > "$STALL_MARKER"
      write_status running "" "$elapsed" stall-detected "$stalled" "$source"
      printf '[claude-run] event=stall kind=silent elapsed=%ss stalled_for=%ss pid=%s\n' "$elapsed" "$stalled" "$pid"
      terminate_process_tree "$pid"
      return 0
    fi
    write_status running "" "$elapsed" "$health" "$stalled" "$source"
    printf '[claude-run] event=progress elapsed=%ss stalled_for=%ss health=%s stream_lines=%s transcript_lines=%s children=%s completed=%s report_pending=%s\n' "$elapsed" "$stalled" "$health" "$stdout_lines" "$TRANSCRIPT_LINES" "$CHILD_COUNT" "$COMPLETED_CHILDREN" "$REPORT_PENDING"
  done
}

hard_timeout_loop() {
  local pid="$1" remaining="$TIMEOUT_SECONDS"
  (( remaining > 0 )) && sleep "$remaining"
  kill -0 "$pid" 2>/dev/null || return 0
  : > "$HARD_TIMEOUT_MARKER"
  write_status running "" "$TIMEOUT_SECONDS" hard-timeout-detected 0 deadline
  printf '[claude-run] event=timeout-detected kind=hard pid=%s\n' "$pid"
  terminate_process_tree "$pid"
}

extract_final() {
  python3 - "$EVENTS_LOG" "$FINAL_MESSAGE" "$RESOLVED_MODEL_FILE" <<'PY'
import json, os, re, sys
from pathlib import Path
events, final, resolved_model_file = map(Path, sys.argv[1:])
result = ""
resolved_model = ""

for raw in events.read_text(encoding="utf-8", errors="replace").splitlines():
    try: event = json.loads(raw)
    except json.JSONDecodeError: continue
    if event.get("type") == "result" and isinstance(event.get("result"), str):
        result = event["result"]
    candidates = [event.get("model")]
    message = event.get("message")
    if isinstance(message, dict):
        candidates.append(message.get("model"))
    for candidate in candidates:
        if isinstance(candidate, str) and re.fullmatch(r"[A-Za-z0-9._:/+-]{1,200}", candidate):
            resolved_model = candidate
if result:
    tmp = Path(str(final) + f".tmp.{os.getpid()}")
    tmp.write_text(result.rstrip() + "\n", encoding="utf-8")
    tmp.replace(final)
if resolved_model:
    tmp = Path(str(resolved_model_file) + f".tmp.{os.getpid()}")
    tmp.write_text(resolved_model + "\n", encoding="utf-8")
    tmp.replace(resolved_model_file)
PY
  RESOLVED_MODEL="$(head -n 1 "$RESOLVED_MODEL_FILE" 2>/dev/null || true)"
}

capture_workspace_baseline
snapshot_transcripts
write_run_env
write_status planned "" 0 planned
printf '[claude-run] event=start run_id=%s mode=%s session_id=%s workspace=%q model=%q effort=%q\n' "$RUN_ID" "$MODE" "$SESSION_ID" "$WORKSPACE" "$REQUESTED_MODEL" "$REQUESTED_EFFORT"
printf '[claude-run] event=paths run_dir=%q run_dir_file=%q status=%q status_json=%q monitor=%q continue=%q events=%q final=%q child_reports=%q\n' "$RUN_DIR" "$RUN_DIR_FILE" "$STATUS_FILE" "$STATUS_JSON" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT" "$EVENTS_LOG" "$FINAL_MESSAGE" "$CHILD_REPORT_DIR"

set +e
python3 "$PREFLIGHT_SCRIPT" \
  --claude-bin "$CLAUDE_EXECUTABLE" \
  --workspace "$WORKSPACE" \
  --timeout "$PREFLIGHT_TIMEOUT_SECONDS" \
  --output "$PREFLIGHT_JSON"
PREFLIGHT_EXIT=$?
set -e

if [[ -f "$PREFLIGHT_JSON" ]]; then
  while IFS=$'\t' read -r key value; do
    case "$key" in
      status) PREFLIGHT_STATUS="$value" ;;
      reason) PREFLIGHT_REASON="$value" ;;
      terminal_envelope) PREFLIGHT_TERMINAL="$value" ;;
      auth_exit_code) PREFLIGHT_AUTH_EXIT="$value" ;;
      duration_ms) PREFLIGHT_DURATION_MS="$value" ;;
      cli_version) PREFLIGHT_CLI_VERSION="$value" ;;
      cli_path) PREFLIGHT_CLI_PATH="$value" ;;
    esac
  done < <(python3 - "$PREFLIGHT_JSON" <<'PY'
import json, sys
from pathlib import Path

try:
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    data = {}
for key in ("status", "reason", "terminal_envelope", "auth_exit_code", "duration_ms", "cli_version", "cli_path"):
    value = data.get(key, "")
    if value is None:
        value = ""
    print(f"{key}\t{value}")
PY
)
else
  PREFLIGHT_STATUS="indeterminate"
  PREFLIGHT_REASON="preflight_artifact_missing"
  PREFLIGHT_EXIT=70
fi

[[ -z "$PREFLIGHT_CLI_PATH" ]] || claude_cmd[0]="$PREFLIGHT_CLI_PATH"
write_command
write_preflight_artifacts
write_run_env

if [[ "$PREFLIGHT_STATUS" != "authenticated" || "$PREFLIGHT_EXIT" -ne 0 ]]; then
  write_status failed "$PREFLIGHT_EXIT" 0 preflight-failed 0 preflight
  RUN_FINALIZED="true"
  rm -f "$CONTINUE_SCRIPT"
  printf '[claude-run] event=finish state=failed exit_code=%s preflight_status=%s reason=%s\n' "$PREFLIGHT_EXIT" "$PREFLIGHT_STATUS" "$PREFLIGHT_REASON"
  exit "$PREFLIGHT_EXIT"
fi
printf '[claude-run] event=preflight status=authenticated terminal=%s duration_ms=%s\n' "$PREFLIGHT_TERMINAL" "$PREFLIGHT_DURATION_MS"
if [[ "$DRY_RUN" == "true" ]]; then
  write_status dry-run 0 0 dry-run
  RUN_FINALIZED="true"
  echo "[claude-run] event=dry-run exit_code=0"
  exit 0
fi

STARTED_AT="$(date +%s)"
mkfifo "$STDOUT_PIPE" "$STDERR_PIPE"
tee -a "$STDOUT_LOG" "$EVENTS_LOG" < "$STDOUT_PIPE" >/dev/null & STDOUT_TEE_PID=$!
tee -a "$STDERR_LOG" < "$STDERR_PIPE" >&2 & STDERR_TEE_PID=$!
process_group_cmd=(python3 -c 'import os, sys; os.setsid(); os.chdir(sys.argv[1]); os.execvp(sys.argv[2], sys.argv[2:])' "$WORKSPACE" "${claude_cmd[@]}")
"${process_group_cmd[@]}" < "$PROMPT_RUN_FILE" > "$STDOUT_PIPE" 2> "$STDERR_PIPE" &
CHILD_PID=$!
write_status running "" 0 active 0 spawn
printf '[claude-run] event=spawn pid=%s\n' "$CHILD_PID"
heartbeat_loop "$CHILD_PID" "$STARTED_AT" & HEARTBEAT_PID=$!
HARD_TIMEOUT_PID=""
if (( TIMEOUT_SECONDS > 0 )); then hard_timeout_loop "$CHILD_PID" & HARD_TIMEOUT_PID=$!; fi
set +e
wait "$CHILD_PID"; EXIT_CODE=$?
set -e
terminate_process_tree "$CHILD_PID"
[[ ! -f "$STALL_MARKER" && ! -f "$HARD_TIMEOUT_MARKER" ]] || EXIT_CODE=124
if [[ -f "$STALL_MARKER" ]]; then wait "$HEARTBEAT_PID" 2>/dev/null || true; else kill "$HEARTBEAT_PID" 2>/dev/null || true; wait "$HEARTBEAT_PID" 2>/dev/null || true; fi
if [[ -n "$HARD_TIMEOUT_PID" ]]; then
  if [[ -f "$HARD_TIMEOUT_MARKER" ]]; then wait "$HARD_TIMEOUT_PID" 2>/dev/null || true; else kill "$HARD_TIMEOUT_PID" 2>/dev/null || true; wait "$HARD_TIMEOUT_PID" 2>/dev/null || true; fi
fi
for tee_pid in "$STDOUT_TEE_PID" "$STDERR_TEE_PID"; do
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    kill -0 "$tee_pid" 2>/dev/null || break
    sleep 0.1
  done
  kill "$tee_pid" 2>/dev/null || true
  wait "$tee_pid" 2>/dev/null || true
done
rm -f "$STDOUT_PIPE" "$STDERR_PIPE"
extract_final
snapshot_transcripts
capture_workspace_artifacts
ENDED_AT="$(date +%s)"; ELAPSED=$((ENDED_AT-STARTED_AT))
FINAL_STATE="finished"
if [[ -f "$HARD_TIMEOUT_MARKER" ]]; then FINAL_STATE="timed-out"; elif [[ -f "$STALL_MARKER" ]]; then FINAL_STATE="stalled"; elif (( EXIT_CODE != 0 )); then FINAL_STATE="failed"; fi
write_run_env
write_status "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED" "$FINAL_STATE" 0 finish
RUN_FINALIZED="true"
printf '[claude-run] event=finish state=%s exit_code=%s elapsed=%ss session_id=%s final=%q children=%s completed=%s report_pending=%s\n' "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED" "$SESSION_ID" "$FINAL_MESSAGE" "$CHILD_COUNT" "$COMPLETED_CHILDREN" "$REPORT_PENDING"
exit "$EXIT_CODE"
