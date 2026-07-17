#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
# shellcheck source=cursor/skills/cursor/bin/cursor-agent-lib.sh
source "$SCRIPT_DIR/cursor-agent-lib.sh"

MODE="${1:-}"
usage() {
  cat >&2 <<'EOF'
Usage: cursor-run.sh run|review|resume [options] [-- extra-agent-args...]

  --prompt TEXT          Prompt text passed to Cursor Agent.
  --prompt-file PATH     Prompt file passed to Cursor Agent.
  --workspace PATH       Working directory (default: current directory).
  --run-root PATH        Artifact root (default: ~/.cursor/headless-runs).
  --run-dir PATH         Exact artifact directory.
  --run-dir-file PATH    Publish the exact artifact directory immediately.
  --continue-run PATH    Resume the session and defaults from a prior run.
  --session ID           Resume this Cursor session (resume mode).
  --model MODEL          Override Cursor's configured default model.
  --auth MODE            auto, login, or api-key (default: auto).
  --env-file PATH        Explicit dotenv file containing CURSOR_API_KEY.
  --read-only            Use Cursor ask mode and disable workspace progress.
  --no-force             Do not pass --force for write-capable runs.
  --no-approve-mcps      Do not pass --approve-mcps for write-capable runs.
  --heartbeat SECONDS    Progress cadence (default: 15).
  --stall-timeout SECS   Stop after no meaningful activity (default: 300).
  --timeout SECONDS      Overall process deadline (default: 2700).
  --dry-run              Write artifacts without launching Cursor Agent.

review is read-only ask mode. The runner never automatically replays a prompt.
EOF
}

case "$MODE" in
  run|review|resume) shift ;;
  -h|--help) usage; exit 0 ;;
  *) usage; exit 2 ;;
esac

PROMPT_TEXT=""
PROMPT_FILE=""
WORKSPACE="$PWD"
RUN_ROOT="${CURSOR_RUNS_DIR:-$HOME/.cursor/headless-runs}"
RUN_DIR=""
RUN_DIR_FILE=""
CONTINUE_RUN_DIR=""
SESSION_ID=""
MODEL=""
RESOLVED_MODEL=""
MODEL_EVENT_EMITTED="false"
AUTH_MODE="auto"
ENV_FILE="${CURSOR_ENV_FILE:-}"
READ_ONLY="false"
FORCE_RUN="true"
APPROVE_MCPS="true"
HEARTBEAT_SECONDS="${CURSOR_HEARTBEAT_SECONDS:-15}"
STALL_TIMEOUT_SECONDS="${CURSOR_STALL_TIMEOUT_SECONDS:-300}"
TIMEOUT_SECONDS="${CURSOR_TIMEOUT_SECONDS:-2700}"
TERM_GRACE_SECONDS="${CURSOR_TERM_GRACE_SECONDS:-5}"
DRY_RUN="false"
EXTRA_ARGS=()

WORKSPACE_SET="false"
RUN_ROOT_SET="false"
SESSION_SET="false"
MODEL_SET="false"
AUTH_SET="false"
ENV_FILE_SET="false"
READ_ONLY_SET="false"
FORCE_SET="false"
APPROVE_SET="false"
HEARTBEAT_SET="false"
STALL_TIMEOUT_SET="false"
TIMEOUT_SET="false"

require_value() {
  [[ -n "${2:-}" ]] || { echo "[FAIL] missing value for $1" >&2; exit 2; }
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT_TEXT="${2:-}"; require_value "$1" "$PROMPT_TEXT"; shift 2 ;;
    --prompt-file) PROMPT_FILE="${2:-}"; require_value "$1" "$PROMPT_FILE"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; require_value "$1" "$WORKSPACE"; WORKSPACE_SET="true"; shift 2 ;;
    --run-root) RUN_ROOT="${2:-}"; require_value "$1" "$RUN_ROOT"; RUN_ROOT_SET="true"; shift 2 ;;
    --run-dir) RUN_DIR="${2:-}"; require_value "$1" "$RUN_DIR"; shift 2 ;;
    --run-dir-file) RUN_DIR_FILE="${2:-}"; require_value "$1" "$RUN_DIR_FILE"; shift 2 ;;
    --continue-run) CONTINUE_RUN_DIR="${2:-}"; require_value "$1" "$CONTINUE_RUN_DIR"; shift 2 ;;
    --session) SESSION_ID="${2:-}"; require_value "$1" "$SESSION_ID"; SESSION_SET="true"; shift 2 ;;
    --model) MODEL="${2:-}"; require_value "$1" "$MODEL"; MODEL_SET="true"; shift 2 ;;
    --auth) AUTH_MODE="${2:-}"; require_value "$1" "$AUTH_MODE"; AUTH_SET="true"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; require_value "$1" "$ENV_FILE"; ENV_FILE_SET="true"; shift 2 ;;
    --read-only) READ_ONLY="true"; READ_ONLY_SET="true"; shift ;;
    --no-force) FORCE_RUN="false"; FORCE_SET="true"; shift ;;
    --no-approve-mcps) APPROVE_MCPS="false"; APPROVE_SET="true"; shift ;;
    --heartbeat) HEARTBEAT_SECONDS="${2:-}"; require_value "$1" "$HEARTBEAT_SECONDS"; HEARTBEAT_SET="true"; shift 2 ;;
    --stall-timeout) STALL_TIMEOUT_SECONDS="${2:-}"; require_value "$1" "$STALL_TIMEOUT_SECONDS"; STALL_TIMEOUT_SET="true"; shift 2 ;;
    --timeout) TIMEOUT_SECONDS="${2:-}"; require_value "$1" "$TIMEOUT_SECONDS"; TIMEOUT_SET="true"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; while [[ $# -gt 0 ]]; do EXTRA_ARGS+=("$1"); shift; done ;;
    *) echo "[FAIL] unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -z "$PROMPT_TEXT" || -z "$PROMPT_FILE" ]] || { echo "[FAIL] use --prompt or --prompt-file, not both" >&2; exit 2; }
[[ -n "$PROMPT_TEXT" || -n "$PROMPT_FILE" ]] || { echo "[FAIL] $MODE requires --prompt or --prompt-file" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "[FAIL] python3 is required" >&2; exit 127; }
for number in "$HEARTBEAT_SECONDS" "$STALL_TIMEOUT_SECONDS" "$TIMEOUT_SECONDS" "$TERM_GRACE_SECONDS"; do
  case "$number" in ''|*[!0-9]*) echo "[FAIL] timeout values must be integer seconds" >&2; exit 2 ;; esac
done
(( HEARTBEAT_SECONDS > 0 )) || { echo "[FAIL] --heartbeat must be at least 1" >&2; exit 2; }

absolute_path() { case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac; }
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
  local prior="$CONTINUE_RUN_DIR/run.env" key value
  [[ -f "$prior" ]] || { echo "[FAIL] prior run.env not found: $prior" >&2; exit 2; }
  while IFS=$'\t' read -r key value; do
    case "$key" in
      WORKSPACE) [[ "$WORKSPACE_SET" == "true" ]] || WORKSPACE="$value" ;;
      RUN_ROOT) [[ "$RUN_ROOT_SET" == "true" ]] || RUN_ROOT="$value" ;;
      SESSION_ID) [[ "$SESSION_SET" == "true" ]] || SESSION_ID="$value" ;;
      MODEL) [[ "$MODEL_SET" == "true" ]] || MODEL="$value" ;;
      AUTH_MODE) [[ "$AUTH_SET" == "true" ]] || AUTH_MODE="$value" ;;
      ENV_FILE) [[ "$ENV_FILE_SET" == "true" ]] || ENV_FILE="$value" ;;
      READ_ONLY) [[ "$READ_ONLY_SET" == "true" ]] || READ_ONLY="$value" ;;
      FORCE_RUN) [[ "$FORCE_SET" == "true" ]] || FORCE_RUN="$value" ;;
      APPROVE_MCPS) [[ "$APPROVE_SET" == "true" ]] || APPROVE_MCPS="$value" ;;
      HEARTBEAT_SECONDS) [[ "$HEARTBEAT_SET" == "true" ]] || HEARTBEAT_SECONDS="$value" ;;
      STALL_TIMEOUT_SECONDS) [[ "$STALL_TIMEOUT_SET" == "true" ]] || STALL_TIMEOUT_SECONDS="$value" ;;
      TIMEOUT_SECONDS) [[ "$TIMEOUT_SET" == "true" ]] || TIMEOUT_SECONDS="$value" ;;
    esac
  done < <(read_env_values "$prior" WORKSPACE RUN_ROOT SESSION_ID MODEL AUTH_MODE ENV_FILE READ_ONLY FORCE_RUN APPROVE_MCPS HEARTBEAT_SECONDS STALL_TIMEOUT_SECONDS TIMEOUT_SECONDS)
  [[ -n "$SESSION_ID" ]] || { echo "[FAIL] prior run has no Cursor session id" >&2; exit 2; }
}

load_continue_defaults
[[ "$MODE" != "review" ]] || READ_ONLY="true"
RESUMING="false"
if [[ "$MODE" == "resume" || -n "$CONTINUE_RUN_DIR" ]]; then RESUMING="true"; fi
[[ "$MODE" != "resume" || -n "$SESSION_ID" ]] || { echo "[FAIL] resume requires --session or --continue-run" >&2; exit 2; }

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
  printf '%s\n' "$RUN_DIR" >> "$RUN_DIR_FILE.history"
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
RUNNER_LOG="$RUN_DIR/runner.log"
MONITOR_SCRIPT="$RUN_DIR/monitor.sh"
CONTINUE_SCRIPT="$RUN_DIR/continue.sh"
BASELINE_FILE="$RUN_DIR/workspace-baseline.txt"
STALL_MARKER="$RUN_DIR/.stalled"
HARD_TIMEOUT_MARKER="$RUN_DIR/.hard-timeout"
rm -f "$STALL_MARKER" "$HARD_TIMEOUT_MARKER"
: > "$EVENTS_LOG"
rm -f "$STDOUT_LOG"
ln "$EVENTS_LOG" "$STDOUT_LOG"
: > "$STDERR_LOG"
: > "$FINAL_MESSAGE"
: > "$PREFLIGHT_LOG"
: > "$RUNNER_LOG"
if [[ -n "$PROMPT_TEXT" ]]; then printf '%s\n' "$PROMPT_TEXT" > "$PROMPT_RUN_FILE"; else cp "$PROMPT_FILE" "$PROMPT_RUN_FILE"; fi

if ! resolve_agent_bin; then
  echo "[FAIL] Cursor Agent CLI not found (agent or cursor-agent)" | tee -a "$RUNNER_LOG" >&2
  exit 127
fi

agent_cmd=("$CURSOR_AGENT_BIN" -p --output-format stream-json --stream-partial-output --trust)
if [[ "$RESUMING" == "true" ]]; then agent_cmd+=(--resume "$SESSION_ID"); fi
[[ -z "$MODEL" ]] || agent_cmd+=(--model "$MODEL")
if [[ "$READ_ONLY" == "true" ]]; then
  agent_cmd+=(--mode ask)
else
  [[ "$FORCE_RUN" != "true" ]] || agent_cmd+=(--force)
  [[ "$APPROVE_MCPS" != "true" ]] || agent_cmd+=(--approve-mcps)
fi
agent_cmd+=(--workspace "$WORKSPACE")
(( ${#EXTRA_ARGS[@]} == 0 )) || agent_cmd+=("${EXTRA_ARGS[@]}")

{
  printf 'cwd='; shell_quote "$WORKSPACE"; printf '\ncommand='
  for arg in "${agent_cmd[@]}"; do shell_quote "$arg"; printf ' '; done
  printf '\nprompt_file='; shell_quote "$PROMPT_RUN_FILE"; printf '\n'
} > "$COMMAND_FILE"

byte_count() { [[ -f "$1" ]] && wc -c < "$1" | tr -d '[:space:]' || printf 0; }
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
    printf 'MODE=%q\nWORKSPACE=%q\nRUN_ROOT=%q\nRUN_DIR=%q\nRUN_DIR_FILE=%q\n' "$MODE" "$WORKSPACE" "$RUN_ROOT" "$RUN_DIR" "$RUN_DIR_FILE"
    printf 'SESSION_ID=%q\nMODEL=%q\nAUTH_MODE=%q\nENV_FILE=%q\n' "$SESSION_ID" "$MODEL" "$AUTH_MODE" "$ENV_FILE"
    printf 'READ_ONLY=%q\nFORCE_RUN=%q\nAPPROVE_MCPS=%q\n' "$READ_ONLY" "$FORCE_RUN" "$APPROVE_MCPS"
    printf 'HEARTBEAT_SECONDS=%q\nSTALL_TIMEOUT_SECONDS=%q\nTIMEOUT_SECONDS=%q\n' "$HEARTBEAT_SECONDS" "$STALL_TIMEOUT_SECONDS" "$TIMEOUT_SECONDS"
  } > "$RUN_ENV_FILE"
}

write_status() {
  local state="$1" exit_code="${2:-}" elapsed="${3:-0}" health="${4:-$1}" stalled_for="${5:-0}" source="${6:-none}"
  local bytes tmp
  bytes="$(byte_count "$EVENTS_LOG")"
  printf 'state=%s health=%s exit_code=%s elapsed_seconds=%s stalled_for_seconds=%s progress_source=%s event_bytes=%s\n' \
    "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source" "$bytes" >> "$RUNNER_LOG"
  tmp="$(mktemp "$STATUS_FILE.tmp.XXXXXX")"
  {
    printf 'state=%q\nhealth=%q\nexit_code=%q\nelapsed_seconds=%q\nstalled_for_seconds=%q\nprogress_source=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source"
    printf 'pid=%q\nwrapper_pid=%q\nsession_id=%q\nworkspace=%q\nrun_dir=%q\nrun_dir_file=%q\n' "${CHILD_PID:-}" "$$" "$SESSION_ID" "$WORKSPACE" "$RUN_DIR" "$RUN_DIR_FILE"
    printf 'model=%q\nrequested_model=%q\nauth=%q\nread_only=%q\nevent_bytes=%q\n' "$RESOLVED_MODEL" "$MODEL" "$RESOLVED_CURSOR_AUTH" "$READ_ONLY" "$bytes"
    printf 'stdout_log=%q\nstderr_log=%q\nrunner_log=%q\nevents_log=%q\nfinal_message=%q\nmonitor_script=%q\ncontinue_script=%q\n' "$STDOUT_LOG" "$STDERR_LOG" "$RUNNER_LOG" "$EVENTS_LOG" "$FINAL_MESSAGE" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT"
  } > "$tmp"
  mv "$tmp" "$STATUS_FILE"
  python3 - "$STATUS_JSON" "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source" "${CHILD_PID:-}" "$$" "$SESSION_ID" "$WORKSPACE" "$RUN_DIR" "$RUN_DIR_FILE" "$RESOLVED_MODEL" "$MODEL" "$RESOLVED_CURSOR_AUTH" "$READ_ONLY" "$bytes" "$STDOUT_LOG" "$STDERR_LOG" "$RUNNER_LOG" "$EVENTS_LOG" "$FINAL_MESSAGE" <<'PY'
import json, os, sys
from pathlib import Path
(path,state,health,exit_code,elapsed,stalled,source,pid,wrapper_pid,session,workspace,run_dir,run_dir_file,model,requested_model,auth,read_only,event_bytes,stdout,stderr,runner,events,final)=sys.argv[1:]
def number(value): return int(value) if value.isdigit() else None
data={"state":state,"health":health,"exit_code":number(exit_code),"elapsed_seconds":number(elapsed) or 0,"stalled_for_seconds":number(stalled) or 0,"progress_source":source,"pid":number(pid),"wrapper_pid":number(wrapper_pid),"session_id":session,"workspace":workspace,"run_dir":run_dir,"run_dir_file":run_dir_file,"model":model,"requested_model":requested_model,"auth":auth,"read_only":read_only=="true","event_bytes":number(event_bytes) or 0,"stdout_log":stdout,"stderr_log":stderr,"runner_log":runner,"events_log":events,"final_message":final}
tmp=Path(path+f".tmp.{os.getpid()}")
tmp.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")
tmp.replace(path)
PY
}

cat > "$MONITOR_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
RUN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATUS="$RUN_DIR/status.json"
STARTED_AT="$(date +%s)"
LIMIT="${CURSOR_MONITOR_TIMEOUT_SECONDS:-3600}"
case "$LIMIT" in ''|*[!0-9]*) echo "[cursor-run] monitor=failed detail=invalid-timeout" >&2; exit 2 ;; esac
while true; do
  if [[ -f "$STATUS" ]]; then
    row="$(python3 - "$STATUS" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("\t".join(str(d.get(k,"")) for k in ("state","health","exit_code","elapsed_seconds","session_id","model","final_message","wrapper_pid")))
PY
)"
    IFS=$'\t' read -r state health exit_code elapsed session model final wrapper_pid <<< "$row"
    case "$state" in
      finished|failed|stalled|timed-out|interrupted|dry-run)
        printf '[cursor-run] monitor=done state=%s health=%s exit_code=%s elapsed=%ss session_id=%s model=%s final=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$session" "$model" "$final"
        [[ "$exit_code" =~ ^[0-9]+$ ]] && exit "$exit_code"
        exit 1 ;;
    esac
    if [[ "$wrapper_pid" =~ ^[0-9]+$ ]] && ! kill -0 "$wrapper_pid" 2>/dev/null; then
      printf '[cursor-run] monitor=abandoned state=%s wrapper_pid=%s\n' "$state" "$wrapper_pid" >&2
      exit 1
    fi
  fi
  if (( LIMIT > 0 && $(date +%s)-STARTED_AT >= LIMIT )); then
    printf '[cursor-run] monitor=timed-out timeout=%ss status=%q\n' "$LIMIT" "$STATUS" >&2
    exit 124
  fi
  sleep "${CURSOR_MONITOR_POLL_SECONDS:-3}"
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
    git -C "$WORKSPACE" ls-files --others --exclude-standard -z 2>/dev/null |
      while IFS= read -r -d '' path; do git -C "$WORKSPACE" diff --no-index -- /dev/null "$path" 2>/dev/null || true; done
  } > "$RUN_DIR/workspace.diff"
  { [[ -z "$BASE_HEAD" ]] || git -C "$WORKSPACE" diff --name-only "$BASE_HEAD" 2>/dev/null || true; git -C "$WORKSPACE" ls-files --others --exclude-standard 2>/dev/null || true; } | awk 'NF && !seen[$0]++' > "$RUN_DIR/changed-files.txt"
}

descendant_pids() {
  local parent="$1" child
  command -v pgrep >/dev/null 2>&1 || return 0
  while IFS= read -r child; do [[ "$child" =~ ^[0-9]+$ ]] || continue; descendant_pids "$child"; printf '%s\n' "$child"; done < <(pgrep -P "$parent" 2>/dev/null || true)
}

terminate_process_tree() {
  local root="$1" pid attempt alive targets=()
  while IFS= read -r pid; do targets+=("$pid"); done < <(descendant_pids "$root")
  targets+=("$root")
  kill -TERM -- "-$root" 2>/dev/null || true
  kill -TERM "${targets[@]}" 2>/dev/null || true
  for ((attempt=0; attempt<TERM_GRACE_SECONDS*10; attempt++)); do
    alive="false"; kill -0 -- "-$root" 2>/dev/null && alive="true"
    [[ "$alive" == "false" ]] && return 0
    sleep 0.1
  done
  kill -KILL -- "-$root" 2>/dev/null || true
  kill -KILL "${targets[@]}" 2>/dev/null || true
}

RUN_FINALIZED="false"
# shellcheck disable=SC2329 # Called through the EXIT trap.
cleanup_on_exit() {
  local code=$? elapsed=0
  trap - EXIT INT TERM
  if [[ "$RUN_FINALIZED" != "true" ]]; then
    [[ -z "${CHILD_PID:-}" ]] || terminate_process_tree "$CHILD_PID"
    [[ -z "${STARTED_AT:-}" ]] || elapsed=$(($(date +%s)-STARTED_AT))
    [[ ! -f "$STATUS_FILE" ]] || write_status failed "$code" "$elapsed" failed 0 wrapper-exit || true
  fi
  exit "$code"
}

# shellcheck disable=SC2329 # Called through signal traps.
handle_signal() {
  local signal="$1" code="$2" elapsed=0
  [[ -z "${STARTED_AT:-}" ]] || elapsed=$(($(date +%s)-STARTED_AT))
  [[ -z "${CHILD_PID:-}" ]] || terminate_process_tree "$CHILD_PID"
  write_status interrupted "$code" "$elapsed" interrupted
  RUN_FINALIZED="true"
  echo "[cursor-run] event=interrupt signal=$signal"
  exit "$code"
}
trap cleanup_on_exit EXIT
trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM

extract_result() {
  local output key value
  output="$(python3 - "$EVENTS_LOG" "$FINAL_MESSAGE" <<'PY'
import json,os,sys
from pathlib import Path
events,final=map(Path,sys.argv[1:])
result=""; assistant=""; session=""; model=""
for raw in events.read_text(encoding="utf-8",errors="replace").splitlines():
    try: event=json.loads(raw)
    except json.JSONDecodeError: continue
    if isinstance(event.get("session_id"),str): session=event["session_id"]
    if not model and event.get("type")=="system" and event.get("subtype")=="init" and isinstance(event.get("model"),str): model=event["model"]
    if event.get("type")=="result" and isinstance(event.get("result"),str): result=event["result"]
    if event.get("type")=="assistant" and isinstance(event.get("message"),dict):
        content=event["message"].get("content",[])
        text="".join(part.get("text","") for part in content if isinstance(part,dict) and part.get("type")=="text")
        if text.strip(): assistant=text
final_text=assistant or result
if final_text:
    tmp=Path(str(final)+f".tmp.{os.getpid()}")
    tmp.write_text(final_text.rstrip()+"\n",encoding="utf-8")
    tmp.replace(final)
print(f"SESSION_ID\t{session}")
print(f"MODEL\t{model}")
PY
)"
  while IFS=$'\t' read -r key value; do
    case "$key" in
      SESSION_ID) [[ -z "$value" ]] || SESSION_ID="$value" ;;
      MODEL) record_resolved_model "$value" ;;
    esac
  done <<< "$output"
}

record_resolved_model() {
  local model="$1"
  [[ -n "$model" ]] || return 0
  RESOLVED_MODEL="$model"
  if [[ "$MODEL_EVENT_EMITTED" != "true" ]]; then
    MODEL_EVENT_EMITTED="true"
    printf '[cursor-run] event=model model=%s\n' "$RESOLVED_MODEL"
  fi
}

refresh_resolved_model() {
  local model
  [[ -n "$RESOLVED_MODEL" ]] && return 0
  model="$(python3 - "$EVENTS_LOG" <<'PY'
import json,sys
from pathlib import Path
for raw in Path(sys.argv[1]).read_text(encoding="utf-8",errors="replace").splitlines():
    try: event=json.loads(raw)
    except json.JSONDecodeError: continue
    if event.get("type")=="system" and event.get("subtype")=="init" and isinstance(event.get("model"),str):
        print(event["model"])
        break
PY
)"
  record_resolved_model "$model"
}

printf '[cursor-run] event=start run_id=%s mode=%s workspace=%q\n' "$RUN_ID" "$MODE" "$WORKSPACE"
printf '[cursor-run] event=paths run_dir=%q run_dir_file=%q status=%q status_json=%q monitor=%q continue=%q events=%q final=%q\n' "$RUN_DIR" "$RUN_DIR_FILE" "$STATUS_FILE" "$STATUS_JSON" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT" "$EVENTS_LOG" "$FINAL_MESSAGE"

AUTH_DIAGNOSTIC="$RUN_DIR/.auth-diagnostic"
if ! resolve_cursor_auth "$AUTH_MODE" "$ENV_FILE" 2> "$AUTH_DIAGNOSTIC"; then
  cat "$AUTH_DIAGNOSTIC" >&2
  cat "$AUTH_DIAGNOSTIC" >> "$RUNNER_LOG"
  rm -f "$AUTH_DIAGNOSTIC"
  write_run_env
  write_status failed 1 0 failed 0 auth
  RUN_FINALIZED="true"
  echo "[cursor-run] event=finish state=failed exit_code=1 detail=auth"
  exit 1
fi
rm -f "$AUTH_DIAGNOSTIC"

{
  printf 'timestamp=%s\nworkspace=%s\nauth=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$WORKSPACE" "$RESOLVED_CURSOR_AUTH"
  run_with_cursor_auth "$CURSOR_AGENT_BIN" --version 2>&1 || true
  if [[ "$RESOLVED_CURSOR_AUTH" == "login" ]]; then
    printf 'status_probe=authenticated\n'
  else
    printf 'status_probe=skipped-api-key\n'
  fi
  git -C "$WORKSPACE" status --short 2>/dev/null | head -40 || true
} > "$PREFLIGHT_LOG"
capture_workspace_baseline
write_run_env
write_status planned "" 0 planned
printf '[cursor-run] event=ready auth=%s\n' "$RESOLVED_CURSOR_AUTH"

if [[ "$DRY_RUN" == "true" ]]; then
  write_status dry-run 0 0 dry-run
  RUN_FINALIZED="true"
  echo "[cursor-run] event=dry-run exit_code=0"
  exit 0
fi

STARTED_AT="$(date +%s)"
LAST_PROGRESS_AT="$STARTED_AT"
PREVIOUS="$(byte_count "$EVENTS_LOG"):$(workspace_progress_fingerprint)"
prompt="$(cat "$PROMPT_RUN_FILE"; printf x)"
prompt="${prompt%x}"
process_group_cmd=(python3 -c 'import os,sys; os.setsid(); os.chdir(sys.argv[1]); os.execvp(sys.argv[2],sys.argv[2:])' "$WORKSPACE" "${agent_cmd[@]}" "$prompt")
if [[ "$RESOLVED_CURSOR_AUTH" == "api-key" ]]; then
  export CURSOR_API_KEY="$ACTIVE_CURSOR_KEY"
else
  unset CURSOR_API_KEY
fi
"${process_group_cmd[@]}" > "$EVENTS_LOG" 2> "$STDERR_LOG" &
CHILD_PID=$!
write_status running "" 0 active 0 spawn
printf '[cursor-run] event=spawn pid=%s\n' "$CHILD_PID"

STOP_KIND=""
while kill -0 "$CHILD_PID" 2>/dev/null; do
  sleep "$HEARTBEAT_SECONDS"
  kill -0 "$CHILD_PID" 2>/dev/null || break
  NOW="$(date +%s)"
  ELAPSED=$((NOW-STARTED_AT))
  FINGERPRINT="$(byte_count "$EVENTS_LOG"):$(workspace_progress_fingerprint)"
  refresh_resolved_model
  SOURCE="none"
  if [[ "$FINGERPRINT" != "$PREVIOUS" ]]; then PREVIOUS="$FINGERPRINT"; LAST_PROGRESS_AT="$NOW"; SOURCE="stream-or-workspace"; fi
  STALLED_FOR=$((NOW-LAST_PROGRESS_AT))
  if (( TIMEOUT_SECONDS > 0 && ELAPSED >= TIMEOUT_SECONDS )); then
    STOP_KIND="hard"; : > "$HARD_TIMEOUT_MARKER"
    write_status running "" "$ELAPSED" hard-timeout-detected "$STALLED_FOR" deadline
    printf '[cursor-run] event=timeout-detected kind=hard pid=%s\n' "$CHILD_PID"
    terminate_process_tree "$CHILD_PID"
    break
  fi
  if (( STALL_TIMEOUT_SECONDS > 0 && STALLED_FOR >= STALL_TIMEOUT_SECONDS )); then
    STOP_KIND="stall"; printf 'silent\n' > "$STALL_MARKER"
    write_status running "" "$ELAPSED" stall-detected "$STALLED_FOR" "$SOURCE"
    printf '[cursor-run] event=stall kind=silent elapsed=%ss stalled_for=%ss pid=%s\n' "$ELAPSED" "$STALLED_FOR" "$CHILD_PID"
    terminate_process_tree "$CHILD_PID"
    break
  fi
  write_status running "" "$ELAPSED" active "$STALLED_FOR" "$SOURCE"
  if [[ "$SOURCE" == "none" ]]; then
    printf '[cursor-run] event=heartbeat progress_source=none elapsed=%ss stalled_for=%ss event_bytes=%s\n' "$ELAPSED" "$STALLED_FOR" "$(byte_count "$EVENTS_LOG")"
  else
    printf '[cursor-run] event=progress progress_source=%s elapsed=%ss stalled_for=%ss event_bytes=%s\n' "$SOURCE" "$ELAPSED" "$STALLED_FOR" "$(byte_count "$EVENTS_LOG")"
  fi
done

set +e
wait "$CHILD_PID"; EXIT_CODE=$?
set -e
terminate_process_tree "$CHILD_PID"
refresh_resolved_model
[[ -z "$STOP_KIND" ]] || EXIT_CODE=124
extract_result
capture_workspace_artifacts
ENDED_AT="$(date +%s)"; ELAPSED=$((ENDED_AT-STARTED_AT))
FINAL_STATE="finished"
if [[ "$STOP_KIND" == "hard" ]]; then FINAL_STATE="timed-out"; elif [[ "$STOP_KIND" == "stall" ]]; then FINAL_STATE="stalled"; elif (( EXIT_CODE != 0 )); then FINAL_STATE="failed"; fi
write_run_env
write_status "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED" "$FINAL_STATE" 0 finish
RUN_FINALIZED="true"
printf '[cursor-run] event=finish state=%s exit_code=%s elapsed=%ss session_id=%s model=%s final=%q\n' "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED" "$SESSION_ID" "$RESOLVED_MODEL" "$FINAL_MESSAGE"
exit "$EXIT_CODE"
