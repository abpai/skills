#!/usr/bin/env bash
set -euo pipefail
umask 077

MODE="${1:-}"

usage() {
  cat >&2 <<'EOF'
Usage: claude-tmux-run.sh run|start|monitor|attach|list|stop [options] [-- extra-claude-args...]

Primary modes:
  run                  Start/reuse a tmux Claude Code session, send a prompt, and monitor the turn.
  start                Start a tmux Claude Code session without sending a prompt.
  monitor              Monitor an existing run directory.
  attach               Attach to the tmux session for a run or session name.
  list                 List recent wrapper runs and live tmux sessions.
  stop                 Stop the tmux session for a run or session name.

Common options:
  --prompt TEXT        Prompt text to paste into Claude Code.
  --prompt-file PATH   Prompt file to paste into Claude Code.
  --workspace PATH     Directory for the Claude Code tmux pane (default: current directory).
  --run-root PATH      Directory for run logs (default: $CLAUDE_TMUX_RUNS_DIR or ~/.claude/tmux-runs).
  --run-dir PATH       Exact run directory to use.
  --continue-run PATH  Reuse tmux/session/workspace defaults from a prior run directory.
  --tmux-session NAME  tmux session name (default: claude-<session-short-id>).
  --session-id UUID    Claude Code session id for new sessions.
  --resume-session ID  Resume an existing Claude Code session when starting the tmux pane.
  --name NAME          Claude Code display name.
  --heartbeat SECONDS  Monitor heartbeat interval (default: 10).
  --timeout SECONDS    Give up monitoring after this many seconds (default: 900, 0 = never).
  --startup-wait SECS  Seconds to wait after starting tmux before paste (default: 5).
  --paste-settle SECS  Seconds to wait after paste before pressing Enter (default: 1).
  --submit-key KEY     tmux key sent after paste to submit prompt (default: C-m).
  --no-wait            For run mode, send the prompt and exit after writing monitor.sh.
  --dry-run            Write artifacts and command.txt, but do not start tmux or paste.

Claude options:
  --model MODEL
  --effort LEVEL
  --permission-mode MODE
  --agent NAME
  --allowed-tools LIST
  --disallowed-tools LIST
  --tools LIST
  --add-dir PATH       Repeatable.

MonitorTool contract:
  Prints stable lines prefixed with "[claude-tmux] event=...".
  Writes run.env, status.env, monitor.sh, prompt.txt, prompt-to-send.txt,
  final.md, command.txt, preflight.log, pane.txt, continue.sh, submit.sh, and
  resend.sh.
EOF
}

case "$MODE" in
  run|start|monitor|attach|list|stop)
    shift
    ;;
  -h|--help|"")
    usage
    exit 0
    ;;
  *)
    usage
    exit 2
    ;;
esac

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
PROMPT_TEXT=""
PROMPT_FILE=""
WORKSPACE="$PWD"
RUN_ROOT="${CLAUDE_TMUX_RUNS_DIR:-${CLAUDE_HOME:-$HOME/.claude}/tmux-runs}"
RUN_DIR=""
CONTINUE_RUN_DIR=""
TMUX_SESSION=""
SESSION_ID=""
RESUME_SESSION_ID=""
DISPLAY_NAME=""
HEARTBEAT_SECONDS="${CLAUDE_TMUX_HEARTBEAT_SECONDS:-10}"
TIMEOUT_SECONDS="${CLAUDE_TMUX_TIMEOUT_SECONDS:-900}"
STARTUP_WAIT_SECONDS="${CLAUDE_TMUX_STARTUP_WAIT_SECONDS:-5}"
PASTE_SETTLE_SECONDS="${CLAUDE_TMUX_PASTE_SETTLE_SECONDS:-1}"
SUBMIT_KEY="${CLAUDE_TMUX_SUBMIT_KEY:-C-m}"
NO_WAIT="false"
DRY_RUN="false"
MODEL=""
EFFORT=""
PERMISSION_MODE="${CLAUDE_TMUX_PERMISSION_MODE:-auto}"
AGENT_NAME=""
ALLOWED_TOOLS=""
DISALLOWED_TOOLS=""
TOOLS=""
ADD_DIRS=()
EXTRA_ARGS=()
WORKSPACE_SET="false"
RUN_ROOT_SET="false"
TMUX_SESSION_SET="false"
SESSION_ID_SET="false"
RESUME_SESSION_SET="false"
STARTUP_WAIT_SET="false"
PASTE_SETTLE_SET="false"
SUBMIT_KEY_SET="false"
[[ -n "${CLAUDE_TMUX_STARTUP_WAIT_SECONDS+x}" ]] && STARTUP_WAIT_SET="true"
[[ -n "${CLAUDE_TMUX_PASTE_SETTLE_SECONDS+x}" ]] && PASTE_SETTLE_SET="true"
[[ -n "${CLAUDE_TMUX_SUBMIT_KEY+x}" ]] && SUBMIT_KEY_SET="true"

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
    --tmux-session)
      TMUX_SESSION="${2:-}"
      require_value "$1" "$TMUX_SESSION"
      TMUX_SESSION_SET="true"
      shift 2
      ;;
    --session-id)
      SESSION_ID="${2:-}"
      require_value "$1" "$SESSION_ID"
      SESSION_ID_SET="true"
      shift 2
      ;;
    --resume-session|--resume)
      RESUME_SESSION_ID="${2:-}"
      require_value "$1" "$RESUME_SESSION_ID"
      RESUME_SESSION_SET="true"
      shift 2
      ;;
    --name)
      DISPLAY_NAME="${2:-}"
      require_value "$1" "$DISPLAY_NAME"
      shift 2
      ;;
    --heartbeat)
      HEARTBEAT_SECONDS="${2:-}"
      require_value "$1" "$HEARTBEAT_SECONDS"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
      require_value "$1" "$TIMEOUT_SECONDS"
      shift 2
      ;;
    --startup-wait)
      STARTUP_WAIT_SECONDS="${2:-}"
      require_value "$1" "$STARTUP_WAIT_SECONDS"
      STARTUP_WAIT_SET="true"
      shift 2
      ;;
    --paste-settle)
      PASTE_SETTLE_SECONDS="${2:-}"
      require_value "$1" "$PASTE_SETTLE_SECONDS"
      PASTE_SETTLE_SET="true"
      shift 2
      ;;
    --submit-key)
      SUBMIT_KEY="${2:-}"
      require_value "$1" "$SUBMIT_KEY"
      SUBMIT_KEY_SET="true"
      shift 2
      ;;
    --no-wait)
      NO_WAIT="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --model)
      MODEL="${2:-}"
      require_value "$1" "$MODEL"
      shift 2
      ;;
    --effort)
      EFFORT="${2:-}"
      require_value "$1" "$EFFORT"
      shift 2
      ;;
    --permission-mode)
      PERMISSION_MODE="${2:-}"
      require_value "$1" "$PERMISSION_MODE"
      shift 2
      ;;
    --agent)
      AGENT_NAME="${2:-}"
      require_value "$1" "$AGENT_NAME"
      shift 2
      ;;
    --allowed-tools|--allowedTools)
      ALLOWED_TOOLS="${2:-}"
      require_value "$1" "$ALLOWED_TOOLS"
      shift 2
      ;;
    --disallowed-tools|--disallowedTools)
      DISALLOWED_TOOLS="${2:-}"
      require_value "$1" "$DISALLOWED_TOOLS"
      shift 2
      ;;
    --tools)
      TOOLS="${2:-}"
      require_value "$1" "$TOOLS"
      shift 2
      ;;
    --add-dir)
      ADD_DIR_VALUE="${2:-}"
      require_value "$1" "$ADD_DIR_VALUE"
      ADD_DIRS+=("$ADD_DIR_VALUE")
      shift 2
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

if [[ -n "$SESSION_ID" && -n "$RESUME_SESSION_ID" ]]; then
  echo "[FAIL] use either --session-id or --resume-session, not both" >&2
  exit 2
fi

# python3 parses env files and transcripts. Fail loudly here (after --help is
# handled) instead of letting a missing interpreter silently empty parsed values
# inside process substitution.
if ! command -v python3 >/dev/null 2>&1; then
  echo "[FAIL] python3 is required but was not found on PATH" >&2
  exit 127
fi

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

if [[ -n "$CONTINUE_RUN_DIR" ]]; then
  if [[ ! -f "$CONTINUE_RUN_DIR/run.env" ]]; then
    echo "[FAIL] missing prior run env: $CONTINUE_RUN_DIR/run.env" >&2
    exit 2
  fi
  prior_workspace=""
  prior_run_root=""
  prior_tmux_session=""
  prior_session_id=""
  prior_startup_wait_seconds=""
  prior_paste_settle_seconds=""
  prior_submit_key=""
  while IFS=$'\t' read -r key value; do
    case "$key" in
      WORKSPACE) prior_workspace="$value" ;;
      RUN_ROOT) prior_run_root="$value" ;;
      TMUX_SESSION) prior_tmux_session="$value" ;;
      SESSION_ID) prior_session_id="$value" ;;
      STARTUP_WAIT_SECONDS) prior_startup_wait_seconds="$value" ;;
      PASTE_SETTLE_SECONDS) prior_paste_settle_seconds="$value" ;;
      SUBMIT_KEY) prior_submit_key="$value" ;;
    esac
  done < <(read_env_values "$CONTINUE_RUN_DIR/run.env" \
    WORKSPACE RUN_ROOT TMUX_SESSION SESSION_ID STARTUP_WAIT_SECONDS PASTE_SETTLE_SECONDS SUBMIT_KEY)
  # CLI/env-provided globals are left untouched above (the parser only writes
  # prior_* locals), so prior values apply only where the caller did not set one.
  if [[ "$WORKSPACE_SET" == "false" && -n "$prior_workspace" ]]; then
    WORKSPACE="$prior_workspace"
  fi
  if [[ "$RUN_ROOT_SET" == "false" && -n "$prior_run_root" ]]; then
    RUN_ROOT="$prior_run_root"
  fi
  if [[ "$TMUX_SESSION_SET" == "false" && -n "$prior_tmux_session" ]]; then
    TMUX_SESSION="$prior_tmux_session"
  fi
  if [[ "$SESSION_ID_SET" == "false" && "$RESUME_SESSION_SET" == "false" && -n "$prior_session_id" ]]; then
    SESSION_ID="$prior_session_id"
  fi
  if [[ "$STARTUP_WAIT_SET" == "false" && -n "$prior_startup_wait_seconds" ]]; then
    STARTUP_WAIT_SECONDS="$prior_startup_wait_seconds"
  fi
  if [[ "$PASTE_SETTLE_SET" == "false" && -n "$prior_paste_settle_seconds" ]]; then
    PASTE_SETTLE_SECONDS="$prior_paste_settle_seconds"
  fi
  if [[ "$SUBMIT_KEY_SET" == "false" && -n "$prior_submit_key" ]]; then
    SUBMIT_KEY="$prior_submit_key"
  fi
fi

if [[ "$MODE" == "run" && -z "$PROMPT_TEXT" && -z "$PROMPT_FILE" ]]; then
  echo "[FAIL] run mode requires --prompt or --prompt-file" >&2
  exit 2
fi

for numeric in HEARTBEAT_SECONDS TIMEOUT_SECONDS STARTUP_WAIT_SECONDS PASTE_SETTLE_SECONDS; do
  value="${!numeric}"
  case "$value" in
    ''|*[!0-9]*)
      echo "[FAIL] $numeric must be an integer number of seconds" >&2
      exit 2
      ;;
  esac
done

if (( HEARTBEAT_SECONDS < 1 )); then
  echo "[FAIL] --heartbeat must be at least 1" >&2
  exit 2
fi

new_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
  fi
}

shell_quote() {
  printf '%q' "$1"
}

sanitize_tmux_name() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9_.-' '-'
}

env_line() {
  local key="$1"
  local value="$2"
  printf '%s=%q\n' "$key" "$value"
}

load_run_env() {
  if [[ -z "$RUN_DIR" ]]; then
    echo "[FAIL] --run-dir is required for $MODE" >&2
    exit 2
  fi
  if [[ ! -f "$RUN_DIR/run.env" ]]; then
    echo "[FAIL] missing run env: $RUN_DIR/run.env" >&2
    exit 2
  fi
  local key value
  while IFS=$'\t' read -r key value; do
    case "$key" in
      RUN_ID) RUN_ID="$value" ;;
      SESSION_ID) SESSION_ID="$value" ;;
      RESUME_SESSION_ID) RESUME_SESSION_ID="$value" ;;
      TMUX_SESSION) TMUX_SESSION="$value" ;;
      WORKSPACE) WORKSPACE="$value" ;;
      RUN_ROOT) RUN_ROOT="$value" ;;
      RUN_DIR) RUN_DIR="$value" ;;
      RUN_ENV_FILE) RUN_ENV_FILE="$value" ;;
      PROMPT_PATH) PROMPT_PATH="$value" ;;
      PROMPT_TO_SEND) PROMPT_TO_SEND="$value" ;;
      FINAL_FILE) FINAL_FILE="$value" ;;
      COMMAND_FILE) COMMAND_FILE="$value" ;;
      PREFLIGHT_FILE) PREFLIGHT_FILE="$value" ;;
      PANE_FILE) PANE_FILE="$value" ;;
      STATUS_FILE) STATUS_FILE="$value" ;;
      CONTINUE_SCRIPT) CONTINUE_SCRIPT="$value" ;;
      SUBMIT_SCRIPT) SUBMIT_SCRIPT="$value" ;;
      RESEND_SCRIPT) RESEND_SCRIPT="$value" ;;
      TRANSCRIPT_FILE) TRANSCRIPT_FILE="$value" ;;
      BASE_TRANSCRIPT_LINES) BASE_TRANSCRIPT_LINES="$value" ;;
      STARTUP_WAIT_SECONDS) STARTUP_WAIT_SECONDS="$value" ;;
      HEARTBEAT_SECONDS) HEARTBEAT_SECONDS="$value" ;;
      TIMEOUT_SECONDS) TIMEOUT_SECONDS="$value" ;;
      PASTE_SETTLE_SECONDS) PASTE_SETTLE_SECONDS="$value" ;;
      SUBMIT_KEY) SUBMIT_KEY="$value" ;;
    esac
  done < <(read_env_values "$RUN_DIR/run.env" \
    RUN_ID SESSION_ID RESUME_SESSION_ID TMUX_SESSION WORKSPACE RUN_ROOT RUN_DIR \
    RUN_ENV_FILE PROMPT_PATH PROMPT_TO_SEND FINAL_FILE COMMAND_FILE PREFLIGHT_FILE \
    PANE_FILE STATUS_FILE CONTINUE_SCRIPT SUBMIT_SCRIPT RESEND_SCRIPT TRANSCRIPT_FILE \
    BASE_TRANSCRIPT_LINES STARTUP_WAIT_SECONDS HEARTBEAT_SECONDS TIMEOUT_SECONDS \
    PASTE_SETTLE_SECONDS SUBMIT_KEY)
}

write_status() {
  local state="$1"
  local exit_code="$2"
  local detail="${3:-}"
  {
    env_line state "$state"
    env_line exit_code "$exit_code"
    env_line detail "$detail"
    env_line run_id "${RUN_ID:-}"
    env_line session_id "${SESSION_ID:-}"
    env_line tmux_session "${TMUX_SESSION:-}"
    env_line workspace "${WORKSPACE:-}"
    env_line run_dir "${RUN_DIR:-}"
    env_line transcript_file "${TRANSCRIPT_FILE:-}"
    env_line base_transcript_lines "${BASE_TRANSCRIPT_LINES:-0}"
    env_line phase "${LAST_PHASE:-unknown}"
    env_line stalled_for_seconds "${STALLED_FOR_SECONDS:-0}"
    env_line transcript_lines "${LAST_TRANSCRIPT_LINES:-0}"
    env_line last_event "${LAST_EVENT:-unknown}"
    env_line last_tool "${LAST_TOOL:-}"
    env_line assistant_text_seen "${ASSISTANT_TEXT_SEEN:-false}"
    env_line final_file "${FINAL_FILE:-}"
    env_line continue_command "${RUN_DIR:-}/continue.sh --prompt '<follow-up>'"
    env_line submit_command "${RUN_DIR:-}/submit.sh"
    env_line resend_command "${RUN_DIR:-}/resend.sh"
    env_line attach_command "tmux attach -t ${TMUX_SESSION:-}"
    env_line updated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$STATUS_FILE"
}

find_transcript() {
  if [[ -n "${TRANSCRIPT_FILE:-}" && -f "$TRANSCRIPT_FILE" ]]; then
    printf '%s\n' "$TRANSCRIPT_FILE"
    return 0
  fi
  if [[ -n "${SESSION_ID:-}" ]]; then
    find "$HOME/.claude/projects" -name "$SESSION_ID.jsonl" -print -quit 2>/dev/null || true
  fi
}

write_run_env() {
  local run_env="${RUN_ENV_FILE:-}"
  if [[ -z "$run_env" && -n "${RUN_DIR:-}" ]]; then
    run_env="$RUN_DIR/run.env"
  fi
  if [[ -z "$run_env" ]]; then
    return 0
  fi
  local tmp_env="$run_env.tmp.$$"
  {
    env_line RUN_ID "${RUN_ID:-}"
    env_line SESSION_ID "${SESSION_ID:-}"
    env_line RESUME_SESSION_ID "${RESUME_SESSION_ID:-}"
    env_line TMUX_SESSION "${TMUX_SESSION:-}"
    env_line WORKSPACE "${WORKSPACE:-}"
    env_line RUN_ROOT "${RUN_ROOT:-}"
    env_line RUN_DIR "${RUN_DIR:-}"
    env_line RUN_ENV_FILE "$run_env"
    env_line PROMPT_PATH "${PROMPT_PATH:-}"
    env_line PROMPT_TO_SEND "${PROMPT_TO_SEND:-}"
    env_line FINAL_FILE "${FINAL_FILE:-}"
    env_line COMMAND_FILE "${COMMAND_FILE:-}"
    env_line PREFLIGHT_FILE "${PREFLIGHT_FILE:-}"
    env_line PANE_FILE "${PANE_FILE:-}"
    env_line STATUS_FILE "${STATUS_FILE:-}"
    env_line CONTINUE_SCRIPT "${CONTINUE_SCRIPT:-}"
    env_line SUBMIT_SCRIPT "${SUBMIT_SCRIPT:-}"
    env_line RESEND_SCRIPT "${RESEND_SCRIPT:-}"
    env_line TRANSCRIPT_FILE "${TRANSCRIPT_FILE:-}"
    env_line BASE_TRANSCRIPT_LINES "${BASE_TRANSCRIPT_LINES:-0}"
    env_line STARTUP_WAIT_SECONDS "${STARTUP_WAIT_SECONDS:-}"
    env_line HEARTBEAT_SECONDS "${HEARTBEAT_SECONDS:-}"
    env_line TIMEOUT_SECONDS "${TIMEOUT_SECONDS:-}"
    env_line PASTE_SETTLE_SECONDS "${PASTE_SETTLE_SECONDS:-}"
    env_line SUBMIT_KEY "${SUBMIT_KEY:-}"
  } > "$tmp_env"
  mv "$tmp_env" "$run_env"
}

capture_pane() {
  if [[ -n "${TMUX_SESSION:-}" ]] && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux capture-pane -p -S -200 -t "$TMUX_SESSION" > "$PANE_FILE" 2>/dev/null || true
  fi
}

file_mtime() {
  stat -c '%Y' "$1" 2>/dev/null || stat -f '%m' "$1" 2>/dev/null || echo 0
}

analyze_turn() {
  local transcript="$1"
  python3 - "$transcript" "$FINAL_FILE" "${BASE_TRANSCRIPT_LINES:-0}" <<'PY'
import json
import sys
from pathlib import Path

transcript_path, final_path, base_lines_raw = sys.argv[1:4]
try:
    base_lines = max(0, int(base_lines_raw))
except ValueError:
    base_lines = 0

saw_new_user = False
saw_tool_use = False
saw_tool_result = False
assistant_text_seen = False
pending_tool_ids = set()
turn_done = False
last_text = ""
last_event = "none"
last_tool = ""
transcript_lines = 0

def emit(result, detail, phase):
    values = [
        ("result", result),
        ("detail", detail),
        ("phase", phase),
        ("transcript_lines", str(transcript_lines)),
        ("last_event", last_event),
        ("last_tool", last_tool),
        ("assistant_text_seen", "true" if assistant_text_seen else "false"),
        ("saw_tool_use", "true" if saw_tool_use else "false"),
        ("saw_tool_result", "true" if saw_tool_result else "false"),
    ]
    for key, value in values:
        print(f"{key}\t{value}")

def iter_content(content):
    if isinstance(content, list):
        yield from content
    elif isinstance(content, dict):
        yield content

def tool_result_ids(content):
    ids = []
    for item in iter_content(content):
        if not isinstance(item, dict):
            continue
        if item.get("type") == "tool_result":
            ids.append(str(item.get("tool_use_id") or item.get("id") or ""))
        nested = item.get("content")
        if nested is not content:
            ids.extend(tool_result_ids(nested))
    return ids

def tool_uses(content):
    uses = []
    for item in iter_content(content):
        if not isinstance(item, dict):
            continue
        if item.get("type") == "tool_use":
            uses.append((str(item.get("id") or ""), str(item.get("name") or "tool")))
        nested = item.get("content")
        if nested is not content:
            uses.extend(tool_uses(nested))
    return uses

def phase_for_waiting():
    if pending_tool_ids:
        return "tool-running"
    if saw_tool_result and not assistant_text_seen:
        return "thinking"
    if assistant_text_seen:
        return "responding"
    if saw_new_user:
        return "thinking"
    return "waiting-user"

def content_to_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    out.append(item.get("text", ""))
                elif "content" in item:
                    out.append(content_to_text(item.get("content")))
            else:
                out.append(str(item))
        return "\n".join(part for part in out if part)
    return ""

try:
    lines = Path(transcript_path).read_text(encoding="utf-8").splitlines()
    transcript_lines = len(lines)
except FileNotFoundError:
    last_event = "missing-transcript"
    emit("waiting", "missing-transcript", "waiting-transcript")
    sys.exit(1)

for line in lines[base_lines:]:
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        continue
    event_type = event.get("type")
    if event_type == "user":
        saw_new_user = True
        content = event.get("message", {}).get("content", event.get("content", ""))
        result_ids = tool_result_ids(content)
        if result_ids:
            saw_tool_result = True
            # Only clear a pending tool we can match by id. A tool_result with no
            # id used to pop an ARBITRARY pending id, which could mark a tool that
            # is still running as complete and flip the phase off tool-running;
            # leaving unmatched ids pending is the safe, deterministic choice.
            for result_id in result_ids:
                if result_id:
                    pending_tool_ids.discard(result_id)
            last_event = "tool_result"
        else:
            last_event = "user"
        assistant_text_seen = False
        last_text = ""
        turn_done = False
        continue
    if event_type == "assistant":
        content = event.get("message", {}).get("content", [])
        uses = tool_uses(content)
        if uses:
            saw_tool_use = True
            for tool_id, _tool_name in uses:
                if tool_id:
                    pending_tool_ids.add(tool_id)
            last_tool = uses[-1][1]
            last_event = "tool_use"
        text = content_to_text(content).strip()
        if text:
            assistant_text_seen = True
            last_text = text
            if not uses:
                last_event = "assistant_text"
    elif event_type == "system" and event.get("subtype") == "turn_duration":
        last_event = "turn_duration"
        turn_done = bool(last_text)

if turn_done:
    Path(final_path).write_text(last_text + "\n", encoding="utf-8")
    emit("done", "turn-complete", "done")
    sys.exit(0)
if saw_new_user:
    emit("waiting", "waiting-assistant", phase_for_waiting())
    sys.exit(1)
emit("waiting", "waiting-user", phase_for_waiting())
sys.exit(1)
PY
}

read_analysis_fields() {
  local analysis_file="$1"
  local key value
  while IFS=$'\t' read -r key value; do
    case "$key" in
      detail) last_detail="$value" ;;
      phase) LAST_PHASE="$value" ;;
      transcript_lines) LAST_TRANSCRIPT_LINES="$value" ;;
      last_event) LAST_EVENT="$value" ;;
      last_tool) LAST_TOOL="$value" ;;
      assistant_text_seen) ASSISTANT_TEXT_SEEN="$value" ;;
    esac
  done < "$analysis_file"
}

monitor_loop() {
  load_run_env
  mkdir -p "$RUN_DIR"
  echo "[claude-tmux] event=monitor run_dir=$RUN_DIR tmux=$TMUX_SESSION session_id=$SESSION_ID"

  if [[ -f "$STATUS_FILE" ]]; then
    state=""
    exit_code=""
    while IFS=$'\t' read -r key value; do
      case "$key" in
        state) state="$value" ;;
        exit_code) exit_code="$value" ;;
      esac
    done < <(read_env_values "$STATUS_FILE" state exit_code)
    if [[ "${state:-}" == "dry-run" ]]; then
      echo "[claude-tmux] event=finish state=dry-run exit_code=${exit_code:-0} final=$FINAL_FILE attach=\"tmux attach -t $TMUX_SESSION\""
      return "${exit_code:-0}"
    fi
  fi

  local started
  started="$(date +%s)"
  local last_detail="waiting"
  LAST_PHASE="starting"
  STALLED_FOR_SECONDS="0"
  LAST_TRANSCRIPT_LINES="0"
  LAST_EVENT="unknown"
  LAST_TOOL=""
  ASSISTANT_TEXT_SEEN="false"
  local last_progress_at="$started"
  local last_fingerprint=""

  while true; do
    capture_pane
    local transcript
    transcript="$(find_transcript)"
    if [[ -n "$transcript" && -f "$transcript" ]]; then
      TRANSCRIPT_FILE="$transcript"
      write_run_env
      if analyze_turn "$transcript" >/tmp/claude-tmux-parse.$$ 2>/tmp/claude-tmux-parse-err.$$; then
        read_analysis_fields /tmp/claude-tmux-parse.$$
        write_status "done" "0" "turn complete"
        rm -f /tmp/claude-tmux-parse.$$ /tmp/claude-tmux-parse-err.$$
        echo "[claude-tmux] event=finish state=done exit_code=0 phase=$LAST_PHASE transcript_lines=$LAST_TRANSCRIPT_LINES final=$FINAL_FILE attach=\"tmux attach -t $TMUX_SESSION\""
        return 0
      else
        read_analysis_fields /tmp/claude-tmux-parse.$$
        rm -f /tmp/claude-tmux-parse.$$ /tmp/claude-tmux-parse-err.$$
      fi
    else
      last_detail="waiting-transcript"
      LAST_PHASE="waiting-transcript"
      LAST_TRANSCRIPT_LINES="0"
      LAST_EVENT="missing-transcript"
      LAST_TOOL=""
      ASSISTANT_TEXT_SEEN="false"
    fi

    # Stall detection tracks transcript PROGRESS only. The tmux pane is still
    # captured (for inspection and the missing-pane check below) but is
    # deliberately excluded from the fingerprint: Claude Code's TUI animates a
    # live "esc to interrupt - Ns" counter every second, so a pane checksum
    # would change on every heartbeat and pin stalled_for_seconds near zero even
    # during a genuine hang -- defeating the very signal the operator relies on.
    local transcript_mtime fingerprint
    transcript_mtime="0"
    if [[ -n "${TRANSCRIPT_FILE:-}" && -f "$TRANSCRIPT_FILE" ]]; then
      transcript_mtime="$(file_mtime "$TRANSCRIPT_FILE")"
    fi
    fingerprint="${TRANSCRIPT_FILE:-unknown}:${LAST_TRANSCRIPT_LINES:-0}:$transcript_mtime"

    if [[ -n "$TMUX_SESSION" ]] && ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      write_status "failed" "1" "tmux session ended before monitored turn completed"
      echo "[claude-tmux] event=finish state=failed exit_code=1 detail=\"tmux session ended\" attach=\"tmux attach -t $TMUX_SESSION\""
      return 1
    fi

    local now elapsed
    now="$(date +%s)"
    if [[ "$fingerprint" != "$last_fingerprint" ]]; then
      last_fingerprint="$fingerprint"
      last_progress_at="$now"
    fi
    STALLED_FOR_SECONDS=$((now - last_progress_at))
    elapsed=$((now - started))
    if (( TIMEOUT_SECONDS > 0 && elapsed >= TIMEOUT_SECONDS )); then
      write_status "timeout" "124" "$last_detail"
      echo "[claude-tmux] event=timeout elapsed=${elapsed}s detail=$last_detail phase=$LAST_PHASE stalled_for=${STALLED_FOR_SECONDS}s transcript_lines=$LAST_TRANSCRIPT_LINES last_event=$LAST_EVENT last_tool=$LAST_TOOL attach=\"tmux attach -t $TMUX_SESSION\""
      return 124
    fi

    write_status "running" "" "$last_detail"
    echo "[claude-tmux] event=progress elapsed=${elapsed}s detail=$last_detail phase=$LAST_PHASE stalled_for=${STALLED_FOR_SECONDS}s transcript_lines=$LAST_TRANSCRIPT_LINES last_event=$LAST_EVENT last_tool=$LAST_TOOL transcript=${TRANSCRIPT_FILE:-unknown} attach=\"tmux attach -t $TMUX_SESSION\""
    sleep "$HEARTBEAT_SECONDS"
  done
}

if [[ "$MODE" == "monitor" ]]; then
  monitor_loop
  exit $?
fi

if [[ "$MODE" == "attach" ]]; then
  if [[ -n "$RUN_DIR" ]]; then
    load_run_env
  fi
  if [[ -z "$TMUX_SESSION" ]]; then
    echo "[FAIL] attach requires --run-dir or --tmux-session" >&2
    exit 2
  fi
  echo "[claude-tmux] event=attach tmux=$TMUX_SESSION"
  exec tmux attach -t "$TMUX_SESSION"
fi

if [[ "$MODE" == "stop" ]]; then
  if [[ -n "$RUN_DIR" ]]; then
    load_run_env
  fi
  if [[ -z "$TMUX_SESSION" ]]; then
    echo "[FAIL] stop requires --run-dir or --tmux-session" >&2
    exit 2
  fi
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  echo "[claude-tmux] event=stop tmux=$TMUX_SESSION"
  exit 0
fi

if [[ "$MODE" == "list" ]]; then
  echo "[claude-tmux] runs root=$RUN_ROOT"
  if [[ -d "$RUN_ROOT" ]]; then
    find "$RUN_ROOT" -maxdepth 2 -name run.env -print 2>/dev/null | sort | tail -30 | while read -r env_file; do
      RUN_ID=""; SESSION_ID=""; TMUX_SESSION=""; WORKSPACE=""; RUN_DIR="$(dirname "$env_file")"
      while IFS=$'\t' read -r key value; do
        case "$key" in
          RUN_ID) RUN_ID="$value" ;;
          SESSION_ID) SESSION_ID="$value" ;;
          TMUX_SESSION) TMUX_SESSION="$value" ;;
          WORKSPACE) WORKSPACE="$value" ;;
          RUN_DIR) RUN_DIR="$value" ;;
        esac
      done < <(read_env_values "$env_file" RUN_ID SESSION_ID TMUX_SESSION WORKSPACE RUN_DIR)
      state="unknown"
      if [[ -f "$RUN_DIR/status.env" ]]; then
        while IFS=$'\t' read -r key value; do
          case "$key" in
            state) state="$value" ;;
          esac
        done < <(read_env_values "$RUN_DIR/status.env" state)
      fi
      printf '%s\tstate=%s\ttmux=%s\tsession=%s\tworkspace=%s\n' "$RUN_DIR" "${state:-unknown}" "$TMUX_SESSION" "$SESSION_ID" "$WORKSPACE"
    done
  fi
  echo "[claude-tmux] live tmux sessions"
  tmux list-sessions 2>/dev/null || true
  exit 0
fi

if [[ "$MODE" == "start" && ( -n "$PROMPT_TEXT" || -n "$PROMPT_FILE" ) ]]; then
  echo "[FAIL] start mode does not accept --prompt or --prompt-file; use run" >&2
  exit 2
fi

if [[ -n "$PROMPT_FILE" && ! -f "$PROMPT_FILE" ]]; then
  echo "[FAIL] prompt file not found: $PROMPT_FILE" >&2
  exit 2
fi

if [[ ! -d "$WORKSPACE" ]]; then
  echo "[FAIL] workspace not found: $WORKSPACE" >&2
  exit 2
fi

if [[ -z "$SESSION_ID" ]]; then
  if [[ -n "$RESUME_SESSION_ID" ]]; then
    SESSION_ID="$RESUME_SESSION_ID"
  else
    SESSION_ID="$(new_uuid)"
  fi
fi

SESSION_SHORT="${SESSION_ID%%-*}"
if [[ -z "$TMUX_SESSION" ]]; then
  TMUX_SESSION="$(sanitize_tmux_name "claude-$SESSION_SHORT")"
else
  TMUX_SESSION="$(sanitize_tmux_name "$TMUX_SESSION")"
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(new_uuid)"
RUN_TIMESTAMP="${RUN_ID%%-*}"
RUN_UUID_PART="${RUN_ID#*-}"
RUN_UUID_SHORT="${RUN_UUID_PART%%-*}"
RUN_SHORT="$RUN_TIMESTAMP-$RUN_UUID_SHORT"
if [[ -z "$RUN_DIR" ]]; then
  RUN_DIR="$RUN_ROOT/$RUN_SHORT"
fi

mkdir -p "$RUN_DIR"
PROMPT_PATH="$RUN_DIR/prompt.txt"
PROMPT_TO_SEND="$RUN_DIR/prompt-to-send.txt"
FINAL_FILE="$RUN_DIR/final.md"
COMMAND_FILE="$RUN_DIR/command.txt"
PREFLIGHT_FILE="$RUN_DIR/preflight.log"
PANE_FILE="$RUN_DIR/pane.txt"
STATUS_FILE="$RUN_DIR/status.env"
RUN_ENV_FILE="$RUN_DIR/run.env"
MONITOR_SCRIPT="$RUN_DIR/monitor.sh"
CONTINUE_SCRIPT="$RUN_DIR/continue.sh"
SUBMIT_SCRIPT="$RUN_DIR/submit.sh"
RESEND_SCRIPT="$RUN_DIR/resend.sh"
TRANSCRIPT_FILE=""
BASE_TRANSCRIPT_LINES="0"

if [[ -n "$PROMPT_TEXT" ]]; then
  printf '%s\n' "$PROMPT_TEXT" > "$PROMPT_PATH"
elif [[ -n "$PROMPT_FILE" ]]; then
  cp "$PROMPT_FILE" "$PROMPT_PATH"
else
  : > "$PROMPT_PATH"
fi

if [[ "$MODE" == "run" ]]; then
  cp "$PROMPT_PATH" "$PROMPT_TO_SEND"
else
  : > "$PROMPT_TO_SEND"
fi

CLAUDE_CMD=(claude)
if [[ -n "$RESUME_SESSION_ID" ]]; then
  CLAUDE_CMD+=(--resume "$RESUME_SESSION_ID")
else
  CLAUDE_CMD+=(--session-id "$SESSION_ID")
fi
[[ -n "$DISPLAY_NAME" ]] && CLAUDE_CMD+=(--name "$DISPLAY_NAME")
[[ -n "$MODEL" ]] && CLAUDE_CMD+=(--model "$MODEL")
[[ -n "$EFFORT" ]] && CLAUDE_CMD+=(--effort "$EFFORT")
[[ -n "$PERMISSION_MODE" ]] && CLAUDE_CMD+=(--permission-mode "$PERMISSION_MODE")
[[ -n "$AGENT_NAME" ]] && CLAUDE_CMD+=(--agent "$AGENT_NAME")
[[ -n "$ALLOWED_TOOLS" ]] && CLAUDE_CMD+=(--allowed-tools "$ALLOWED_TOOLS")
[[ -n "$DISALLOWED_TOOLS" ]] && CLAUDE_CMD+=(--disallowed-tools "$DISALLOWED_TOOLS")
[[ -n "$TOOLS" ]] && CLAUDE_CMD+=(--tools "$TOOLS")
if (( ${#ADD_DIRS[@]} > 0 )); then
  for dir in "${ADD_DIRS[@]}"; do
    CLAUDE_CMD+=(--add-dir "$dir")
  done
fi
if (( ${#EXTRA_ARGS[@]} > 0 )); then
  CLAUDE_CMD+=("${EXTRA_ARGS[@]}")
fi

CLAUDE_CMD_STRING=""
for part in "${CLAUDE_CMD[@]}"; do
  CLAUDE_CMD_STRING+="$(shell_quote "$part") "
done
CLAUDE_CMD_STRING="${CLAUDE_CMD_STRING% }"

{
  echo "claude tmux session: $TMUX_SESSION"
  echo "workspace: $WORKSPACE"
  echo "session id: $SESSION_ID"
  echo "resume session: $RESUME_SESSION_ID"
  echo "command: tmux new-session -d -s $(shell_quote "$TMUX_SESSION") -c $(shell_quote "$WORKSPACE") $CLAUDE_CMD_STRING"
  if [[ "$MODE" == "run" ]]; then
    echo "prompt transport: tmux load-buffer + paste-buffer + ${PASTE_SETTLE_SECONDS}s settle + tmux send-keys ${SUBMIT_KEY}"
    echo "prompt file: $PROMPT_PATH"
    echo "submit helper: $SUBMIT_SCRIPT"
    echo "resend helper: $RESEND_SCRIPT"
  fi
  echo "attach: tmux attach -t $(shell_quote "$TMUX_SESSION")"
} > "$COMMAND_FILE"

{
  echo "CLAUDE_TMUX_PREFLIGHT_$(date +%s%N)"
  tmux -V 2>&1 || true
  claude --version 2>&1 || true
  claude auth status --text 2>&1 || true
  git -C "$WORKSPACE" rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
  git -C "$WORKSPACE" status --short 2>/dev/null | head -40 || true
} > "$PREFLIGHT_FILE"

write_run_env

cat > "$MONITOR_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec $(shell_quote "$SCRIPT_PATH") monitor --run-dir $(shell_quote "$RUN_DIR")
EOF
chmod u=rwx,go= "$MONITOR_SCRIPT"

cat > "$CONTINUE_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if command -v tmux >/dev/null 2>&1 && tmux has-session -t $(shell_quote "$TMUX_SESSION") 2>/dev/null; then
  exec $(shell_quote "$SCRIPT_PATH") run --continue-run $(shell_quote "$RUN_DIR") "\$@"
fi
exec $(shell_quote "$SCRIPT_PATH") run --continue-run $(shell_quote "$RUN_DIR") --resume-session $(shell_quote "$SESSION_ID") "\$@"
EOF
chmod u=rwx,go= "$CONTINUE_SCRIPT"

cat > "$SUBMIT_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec tmux send-keys -t $(shell_quote "$TMUX_SESSION") $(shell_quote "$SUBMIT_KEY")
EOF
chmod u=rwx,go= "$SUBMIT_SCRIPT"

cat > "$RESEND_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
buffer_name="claude-tmux-resend-\$(date +%s)"
tmux load-buffer -b "\$buffer_name" $(shell_quote "$PROMPT_TO_SEND")
tmux paste-buffer -d -b "\$buffer_name" -t $(shell_quote "$TMUX_SESSION")
sleep $(shell_quote "$PASTE_SETTLE_SECONDS")
exec tmux send-keys -t $(shell_quote "$TMUX_SESSION") $(shell_quote "$SUBMIT_KEY")
EOF
chmod u=rwx,go= "$RESEND_SCRIPT"

write_status "created" "" "artifacts written"

echo "[claude-tmux] event=paths run_dir=$RUN_DIR monitor=$MONITOR_SCRIPT continue=$CONTINUE_SCRIPT submit=$SUBMIT_SCRIPT resend=$RESEND_SCRIPT final=$FINAL_FILE attach=\"tmux attach -t $TMUX_SESSION\""

if [[ "$DRY_RUN" == "true" ]]; then
  write_status "dry-run" "0" "dry run complete"
  echo "[claude-tmux] event=dry-run command=$COMMAND_FILE"
  exit 0
fi

if ! command -v tmux >/dev/null 2>&1; then
  write_status "failed" "127" "tmux not installed"
  echo "[claude-tmux] event=finish state=failed exit_code=127 detail=\"tmux not installed\""
  exit 127
fi

if ! command -v claude >/dev/null 2>&1; then
  write_status "failed" "127" "claude not installed"
  echo "[claude-tmux] event=finish state=failed exit_code=127 detail=\"claude not installed\""
  exit 127
fi

if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  tmux new-session -d -s "$TMUX_SESSION" -c "$WORKSPACE" "$CLAUDE_CMD_STRING"
  echo "[claude-tmux] event=start tmux=$TMUX_SESSION session_id=$SESSION_ID workspace=$WORKSPACE"
  sleep "$STARTUP_WAIT_SECONDS"
else
  echo "[claude-tmux] event=reuse tmux=$TMUX_SESSION session_id=$SESSION_ID workspace=$WORKSPACE"
fi

if [[ "$MODE" == "start" ]]; then
  write_status "running" "" "tmux session started"
  capture_pane
  echo "[claude-tmux] event=ready attach=\"tmux attach -t $TMUX_SESSION\""
  exit 0
fi

TRANSCRIPT_FILE="$(find_transcript)"
if [[ -n "$TRANSCRIPT_FILE" && -f "$TRANSCRIPT_FILE" ]]; then
  BASE_TRANSCRIPT_LINES="$(wc -l < "$TRANSCRIPT_FILE" | tr -d '[:space:]')"
else
  BASE_TRANSCRIPT_LINES="0"
fi
write_run_env

BUFFER_NAME="claude-tmux-$RUN_SHORT"
write_status "running" "" "pasting prompt"
if ! tmux load-buffer -b "$BUFFER_NAME" "$PROMPT_TO_SEND"; then
  write_status "failed" "1" "tmux load-buffer failed"
  echo "[claude-tmux] event=finish state=failed exit_code=1 detail=\"tmux load-buffer failed\" attach=\"tmux attach -t $TMUX_SESSION\""
  exit 1
fi
if ! tmux paste-buffer -d -b "$BUFFER_NAME" -t "$TMUX_SESSION"; then
  write_status "failed" "1" "tmux paste-buffer failed"
  echo "[claude-tmux] event=finish state=failed exit_code=1 detail=\"tmux paste-buffer failed\" attach=\"tmux attach -t $TMUX_SESSION\""
  exit 1
fi
sleep "$PASTE_SETTLE_SECONDS"
if ! tmux send-keys -t "$TMUX_SESSION" "$SUBMIT_KEY"; then
  write_status "failed" "1" "tmux send-keys failed"
  echo "[claude-tmux] event=finish state=failed exit_code=1 detail=\"tmux send-keys failed\" attach=\"tmux attach -t $TMUX_SESSION\""
  exit 1
fi
write_status "running" "" "prompt sent"
capture_pane
echo "[claude-tmux] event=sent run_id=$RUN_ID tmux=$TMUX_SESSION attach=\"tmux attach -t $TMUX_SESSION\""

if [[ "$NO_WAIT" == "true" ]]; then
  echo "[claude-tmux] event=monitor-command command=$MONITOR_SCRIPT"
  exit 0
fi

monitor_loop
