#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

MODE="${1:-}"
usage() {
  cat >&2 <<'EOF'
Usage: antigravity-run.sh run|review|resume [options] [-- extra-agy-args...]

  --prompt TEXT          Prompt text passed to Antigravity.
  --prompt-file PATH     Prompt file passed to Antigravity.
  --workspace PATH       Source working directory (default: current directory).
  --run-root PATH        Artifact root (default: ~/.gemini/antigravity-cli/headless-runs).
  --run-dir PATH         Exact artifact directory.
  --run-dir-file PATH    Publish the exact artifact directory immediately.
  --continue-run PATH    Resume the conversation and defaults from a prior run.
  --conversation ID      Resume this exact conversation (resume mode).
  --model MODEL          Exact model slug from `agy models`.
  --effort LEVEL         low, medium, or high.
  --agent NAME           Exact agent name from `agy agents`.
  --allow-all            Pass --dangerously-skip-permissions.
  --sandbox              Enable Antigravity terminal sandboxing.
  --heartbeat SECONDS    Progress cadence (default: 15).
  --stall-timeout SECS   Stop after no meaningful activity (default: 300).
  --timeout SECONDS      Overall process deadline (default: 2700).
  --dry-run              Write artifacts without launching Antigravity.

review runs in an isolated local clone. The runner never replays a prompt.
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
RUN_ROOT="${ANTIGRAVITY_RUNS_DIR:-$HOME/.gemini/antigravity-cli/headless-runs}"
RUN_DIR=""
RUN_DIR_FILE=""
CONTINUE_RUN_DIR=""
PRIOR_MODE=""
CONVERSATION_ID=""
MODEL=""
EFFORT=""
AGENT=""
ALLOW_ALL="false"
SANDBOX="false"
HEARTBEAT_SECONDS="${ANTIGRAVITY_HEARTBEAT_SECONDS:-15}"
STALL_TIMEOUT_SECONDS="${ANTIGRAVITY_STALL_TIMEOUT_SECONDS:-300}"
TIMEOUT_SECONDS="${ANTIGRAVITY_TIMEOUT_SECONDS:-2700}"
TERM_GRACE_SECONDS="${ANTIGRAVITY_TERM_GRACE_SECONDS:-5}"
DRY_RUN="false"
EXTRA_ARGS=()

WORKSPACE_SET="false"
RUN_ROOT_SET="false"
CONVERSATION_SET="false"
MODEL_SET="false"
EFFORT_SET="false"
AGENT_SET="false"
ALLOW_ALL_SET="false"
SANDBOX_SET="false"
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
    --conversation) CONVERSATION_ID="${2:-}"; require_value "$1" "$CONVERSATION_ID"; CONVERSATION_SET="true"; shift 2 ;;
    --model) MODEL="${2:-}"; require_value "$1" "$MODEL"; MODEL_SET="true"; shift 2 ;;
    --effort) EFFORT="${2:-}"; require_value "$1" "$EFFORT"; EFFORT_SET="true"; shift 2 ;;
    --agent) AGENT="${2:-}"; require_value "$1" "$AGENT"; AGENT_SET="true"; shift 2 ;;
    --allow-all) ALLOW_ALL="true"; ALLOW_ALL_SET="true"; shift ;;
    --sandbox) SANDBOX="true"; SANDBOX_SET="true"; shift ;;
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
case "$EFFORT" in ""|low|medium|high) ;; *) echo "[FAIL] --effort must be low, medium, or high" >&2; exit 2 ;; esac

absolute_path() { case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac; }
shell_quote() { printf '%q' "$1"; }
byte_count() { [[ -f "$1" ]] && wc -c < "$1" | tr -d '[:space:]' || printf 0; }

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
      MODE) PRIOR_MODE="$value" ;;
      WORKSPACE) [[ "$WORKSPACE_SET" == "true" ]] || WORKSPACE="$value" ;;
      RUN_ROOT) [[ "$RUN_ROOT_SET" == "true" ]] || RUN_ROOT="$value" ;;
      CONVERSATION_ID) [[ "$CONVERSATION_SET" == "true" ]] || CONVERSATION_ID="$value" ;;
      MODEL) [[ "$MODEL_SET" == "true" ]] || MODEL="$value" ;;
      EFFORT) [[ "$EFFORT_SET" == "true" ]] || EFFORT="$value" ;;
      AGENT) [[ "$AGENT_SET" == "true" ]] || AGENT="$value" ;;
      ALLOW_ALL) [[ "$ALLOW_ALL_SET" == "true" ]] || ALLOW_ALL="$value" ;;
      SANDBOX) [[ "$SANDBOX_SET" == "true" ]] || SANDBOX="$value" ;;
      HEARTBEAT_SECONDS) [[ "$HEARTBEAT_SET" == "true" ]] || HEARTBEAT_SECONDS="$value" ;;
      STALL_TIMEOUT_SECONDS) [[ "$STALL_TIMEOUT_SET" == "true" ]] || STALL_TIMEOUT_SECONDS="$value" ;;
      TIMEOUT_SECONDS) [[ "$TIMEOUT_SET" == "true" ]] || TIMEOUT_SECONDS="$value" ;;
    esac
  done < <(read_env_values "$prior" MODE WORKSPACE RUN_ROOT CONVERSATION_ID MODEL EFFORT AGENT ALLOW_ALL SANDBOX HEARTBEAT_SECONDS STALL_TIMEOUT_SECONDS TIMEOUT_SECONDS)
  [[ -n "$CONVERSATION_ID" ]] || { echo "[FAIL] prior run has no Antigravity conversation id" >&2; exit 2; }
}

load_continue_defaults
RESUMING="false"
if [[ "$MODE" == "resume" || -n "$CONTINUE_RUN_DIR" || -n "$CONVERSATION_ID" ]]; then RESUMING="true"; fi
[[ "$MODE" != "resume" || -n "$CONVERSATION_ID" ]] || { echo "[FAIL] resume requires --conversation or --continue-run" >&2; exit 2; }
if [[ "$MODE" == "resume" && "$PRIOR_MODE" == "review" ]]; then MODE="review"; fi

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
SOURCE_BEFORE="$RUN_DIR/source-status-before.txt"
SOURCE_AFTER="$RUN_DIR/source-status-after.txt"
REVIEW_WORKSPACE="$RUN_DIR/review-workspace"
: > "$EVENTS_LOG"
rm -f "$STDOUT_LOG"
ln "$EVENTS_LOG" "$STDOUT_LOG"
: > "$STDERR_LOG"
: > "$FINAL_MESSAGE"
: > "$PREFLIGHT_LOG"
: > "$RUNNER_LOG"
: > "$COMMAND_FILE"
if [[ -n "$PROMPT_TEXT" ]]; then printf '%s\n' "$PROMPT_TEXT" > "$PROMPT_RUN_FILE"; else cp "$PROMPT_FILE" "$PROMPT_RUN_FILE"; fi

AGY_BIN="${ANTIGRAVITY_BIN:-}"
if [[ -z "$AGY_BIN" ]]; then AGY_BIN="$(command -v agy || true)"; fi
MODEL_LIST_OK="false"
MODEL_LIST=""

SOURCE_WORKSPACE="$WORKSPACE"
ACTIVE_WORKSPACE="$WORKSPACE"

workspace_fingerprint() {
  local target="$1"
  if ! git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'not-a-git-worktree'
    return 0
  fi
  {
    git -C "$target" rev-parse --verify HEAD 2>/dev/null || true
    git -C "$target" diff --binary HEAD -- 2>/dev/null || true
    git -C "$target" ls-files --others --exclude-standard -z 2>/dev/null |
      while IFS= read -r -d '' path; do
        printf 'untracked\0%s\0' "$path"
        git -C "$target" hash-object --no-filters -- "$path" 2>/dev/null || true
      done
  } | cksum | awk '{print $1 ":" $2}'
}

SOURCE_FINGERPRINT_BEFORE="$(workspace_fingerprint "$SOURCE_WORKSPACE")"
git -C "$SOURCE_WORKSPACE" status --short > "$SOURCE_BEFORE" 2>/dev/null || true

prepare_review_workspace() {
  [[ "$MODE" == "review" ]] || return 0
  git -C "$SOURCE_WORKSPACE" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "[FAIL] review mode requires a Git worktree" >&2
    exit 2
  }
  git clone -q --no-hardlinks "$SOURCE_WORKSPACE" "$REVIEW_WORKSPACE"
  git -C "$SOURCE_WORKSPACE" diff --binary HEAD -- > "$RUN_DIR/source.patch"
  if [[ -s "$RUN_DIR/source.patch" ]]; then
    git -C "$REVIEW_WORKSPACE" apply --binary --whitespace=nowarn "$RUN_DIR/source.patch"
  fi
  git -C "$SOURCE_WORKSPACE" ls-files --others --exclude-standard -z > "$RUN_DIR/source-untracked.zlist"
  python3 - "$SOURCE_WORKSPACE" "$REVIEW_WORKSPACE" "$RUN_DIR/source-untracked.zlist" <<'PY'
import os, shutil, sys
from pathlib import Path

source, destination, listing = map(Path, sys.argv[1:])
for raw in listing.read_bytes().split(b"\0"):
    if not raw:
        continue
    relative = Path(os.fsdecode(raw))
    src = source / relative
    dst = destination / relative
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_symlink():
        if dst.exists() or dst.is_symlink():
            dst.unlink()
        dst.symlink_to(os.readlink(src))
    else:
        shutil.copy2(src, dst)
PY
  ACTIVE_WORKSPACE="$REVIEW_WORKSPACE"
}

write_run_env() {
  {
    printf 'MODE=%q\nWORKSPACE=%q\nRUN_ROOT=%q\nRUN_DIR=%q\nRUN_DIR_FILE=%q\n' "$MODE" "$WORKSPACE" "$RUN_ROOT" "$RUN_DIR" "$RUN_DIR_FILE"
    printf 'CONVERSATION_ID=%q\nMODEL=%q\nEFFORT=%q\nAGENT=%q\n' "$CONVERSATION_ID" "$MODEL" "$EFFORT" "$AGENT"
    printf 'ALLOW_ALL=%q\nSANDBOX=%q\n' "$ALLOW_ALL" "$SANDBOX"
    printf 'HEARTBEAT_SECONDS=%q\nSTALL_TIMEOUT_SECONDS=%q\nTIMEOUT_SECONDS=%q\n' "$HEARTBEAT_SECONDS" "$STALL_TIMEOUT_SECONDS" "$TIMEOUT_SECONDS"
  } > "$RUN_ENV_FILE"
}

RESULT_STATUS=""
RESULT_ERROR=""
DENIAL_COUNT="0"
write_status() {
  local state="$1" exit_code="${2:-}" elapsed="${3:-0}" health="${4:-$1}" stalled_for="${5:-0}" source="${6:-none}"
  local bytes tmp
  bytes="$(byte_count "$EVENTS_LOG")"
  printf 'state=%s health=%s exit_code=%s elapsed_seconds=%s stalled_for_seconds=%s progress_source=%s event_bytes=%s\n' \
    "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source" "$bytes" >> "$RUNNER_LOG"
  tmp="$(mktemp "$STATUS_FILE.tmp.XXXXXX")"
  {
    printf 'state=%q\nhealth=%q\nexit_code=%q\nelapsed_seconds=%q\nstalled_for_seconds=%q\nprogress_source=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source"
    printf 'pid=%q\nwrapper_pid=%q\nconversation_id=%q\nworkspace=%q\nactive_workspace=%q\nrun_dir=%q\nrun_dir_file=%q\n' "${CHILD_PID:-}" "$$" "$CONVERSATION_ID" "$SOURCE_WORKSPACE" "$ACTIVE_WORKSPACE" "$RUN_DIR" "$RUN_DIR_FILE"
    printf 'model=%q\neffort=%q\nagent=%q\nreview_isolated=%q\nallow_all=%q\nsandbox=%q\n' "$MODEL" "$EFFORT" "$AGENT" "$([[ "$MODE" == "review" ]] && printf true || printf false)" "$ALLOW_ALL" "$SANDBOX"
    printf 'result_status=%q\nresult_error=%q\ndenial_count=%q\nevent_bytes=%q\n' "$RESULT_STATUS" "$RESULT_ERROR" "$DENIAL_COUNT" "$bytes"
    printf 'stdout_log=%q\nstderr_log=%q\nrunner_log=%q\nevents_log=%q\nfinal_message=%q\nmonitor_script=%q\ncontinue_script=%q\n' "$STDOUT_LOG" "$STDERR_LOG" "$RUNNER_LOG" "$EVENTS_LOG" "$FINAL_MESSAGE" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT"
  } > "$tmp"
  mv "$tmp" "$STATUS_FILE"
  python3 - "$STATUS_JSON" "$state" "$health" "$exit_code" "$elapsed" "$stalled_for" "$source" "${CHILD_PID:-}" "$$" "$CONVERSATION_ID" "$SOURCE_WORKSPACE" "$ACTIVE_WORKSPACE" "$RUN_DIR" "$RUN_DIR_FILE" "$MODEL" "$EFFORT" "$AGENT" "$MODE" "$ALLOW_ALL" "$SANDBOX" "$RESULT_STATUS" "$RESULT_ERROR" "$DENIAL_COUNT" "$bytes" "$STDOUT_LOG" "$STDERR_LOG" "$RUNNER_LOG" "$EVENTS_LOG" "$FINAL_MESSAGE" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT" <<'PY'
import json, os, sys
from pathlib import Path

(path,state,health,exit_code,elapsed,stalled,source,pid,wrapper_pid,conversation,workspace,active_workspace,run_dir,run_dir_file,model,effort,agent,mode,allow_all,sandbox,result_status,result_error,denial_count,event_bytes,stdout,stderr,runner,events,final,monitor,continuation)=sys.argv[1:]
def number(value):
    try: return int(value)
    except ValueError: return None
data={"state":state,"health":health,"exit_code":number(exit_code),"elapsed_seconds":number(elapsed) or 0,"stalled_for_seconds":number(stalled) or 0,"progress_source":source,"pid":number(pid),"wrapper_pid":number(wrapper_pid),"conversation_id":conversation,"workspace":workspace,"active_workspace":active_workspace,"run_dir":run_dir,"run_dir_file":run_dir_file,"model":model,"effort":effort,"agent":agent,"review_isolated":mode=="review","allow_all":allow_all=="true","sandbox":sandbox=="true","result_status":result_status,"result_error":result_error,"denial_count":number(denial_count) or 0,"event_bytes":number(event_bytes) or 0,"stdout_log":stdout,"stderr_log":stderr,"runner_log":runner,"events_log":events,"final_message":final,"monitor_script":monitor,"continue_script":continuation}
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
LIMIT="${ANTIGRAVITY_MONITOR_TIMEOUT_SECONDS:-3600}"
case "$LIMIT" in ''|*[!0-9]*) echo "[antigravity-run] monitor=failed detail=invalid-timeout" >&2; exit 2 ;; esac
while true; do
  if [[ -f "$STATUS" ]]; then
    row="$(python3 - "$STATUS" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("\t".join(str(d.get(k,"")) for k in ("state","health","exit_code","elapsed_seconds","conversation_id","model","final_message","wrapper_pid")))
PY
)"
    IFS=$'\t' read -r state health exit_code elapsed conversation model final wrapper_pid <<< "$row"
    case "$state" in
      finished|dry-run)
        printf '[antigravity-run] monitor=done state=%s health=%s exit_code=%s elapsed=%ss conversation_id=%s model=%s final=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$conversation" "$model" "$final"
        [[ "$exit_code" == "0" ]] && exit 0
        exit 1 ;;
      failed|stalled|timed-out|interrupted)
        printf '[antigravity-run] monitor=done state=%s health=%s exit_code=%s elapsed=%ss conversation_id=%s model=%s final=%q\n' "$state" "$health" "$exit_code" "$elapsed" "$conversation" "$model" "$final"
        if [[ "$exit_code" =~ ^[1-9][0-9]*$ ]]; then exit "$exit_code"; fi
        exit 1 ;;
    esac
    if [[ "$wrapper_pid" =~ ^[0-9]+$ ]] && ! kill -0 "$wrapper_pid" 2>/dev/null; then
      printf '[antigravity-run] monitor=abandoned state=%s wrapper_pid=%s\n' "$state" "$wrapper_pid" >&2
      exit 1
    fi
  fi
  if (( LIMIT > 0 && $(date +%s)-STARTED_AT >= LIMIT )); then
    printf '[antigravity-run] monitor=timed-out timeout=%ss status=%q\n' "$LIMIT" "$STATUS" >&2
    exit 124
  fi
  sleep "${ANTIGRAVITY_MONITOR_POLL_SECONDS:-3}"
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
  BASE_HEAD="$(git -C "$ACTIVE_WORKSPACE" rev-parse --verify HEAD 2>/dev/null || true)"
  { printf 'workspace=%s\nhead=%s\nstatus_before:\n' "$ACTIVE_WORKSPACE" "$BASE_HEAD"; git -C "$ACTIVE_WORKSPACE" status --short 2>/dev/null || true; } > "$BASELINE_FILE"
}

capture_workspace_artifacts() {
  git -C "$ACTIVE_WORKSPACE" status --short > "$RUN_DIR/workspace-status.txt" 2>/dev/null || true
  {
    [[ -z "$BASE_HEAD" ]] || git -C "$ACTIVE_WORKSPACE" diff "$BASE_HEAD" 2>/dev/null || true
    git -C "$ACTIVE_WORKSPACE" ls-files --others --exclude-standard -z 2>/dev/null |
      while IFS= read -r -d '' path; do git -C "$ACTIVE_WORKSPACE" diff --no-index -- /dev/null "$path" 2>/dev/null || true; done
  } > "$RUN_DIR/workspace.diff"
  { [[ -z "$BASE_HEAD" ]] || git -C "$ACTIVE_WORKSPACE" diff --name-only "$BASE_HEAD" 2>/dev/null || true; git -C "$ACTIVE_WORKSPACE" ls-files --others --exclude-standard 2>/dev/null || true; } | awk 'NF && !seen[$0]++' > "$RUN_DIR/changed-files.txt"
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
  if declare -F extract_result >/dev/null; then extract_result || true; fi
  write_run_env || true
  write_status interrupted "$code" "$elapsed" interrupted
  RUN_FINALIZED="true"
  echo "[antigravity-run] event=interrupt signal=$signal"
  exit "$code"
}
trap cleanup_on_exit EXIT
trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM

extract_result() {
  local output key value
  output="$(python3 - "$EVENTS_LOG" "$STDERR_LOG" "$FINAL_MESSAGE" <<'PY'
import json,re,sys
from pathlib import Path

events,stderr,final=map(Path,sys.argv[1:])
conversation=""; status=""; response=""; error=""; denials=0
permission_pattern=re.compile(r"(permission|approval).*(denied|required|unavailable)|soft[- ]denied|not allowed in headless",re.I)
for raw in events.read_text(encoding="utf-8",errors="replace").splitlines():
    try: event=json.loads(raw)
    except json.JSONDecodeError: continue
    if event.get("event")=="init":
        conversation=event.get("conversation_id") or event.get("init",{}).get("conversation_id") or conversation
    if event.get("event")=="step_update":
        step=event.get("step_update") or {}
        info=step.get("tool_info") or {}
        tool_error=info.get("error")
        if isinstance(tool_error,dict): tool_error=" ".join(str(tool_error.get(k,"")) for k in ("type","message"))
        if isinstance(tool_error,str) and permission_pattern.search(tool_error): denials+=1
    if event.get("event")=="result" and isinstance(event.get("result"),dict):
        result=event["result"]
        conversation=result.get("conversation_id") or conversation
        status=str(result.get("status") or "")
        response=str(result.get("response") or "")
        error=str(result.get("error") or "")
diagnostics=stderr.read_text(encoding="utf-8",errors="replace")
denials += len(permission_pattern.findall(diagnostics))
if response:
    tmp=Path(str(final)+".tmp")
    tmp.write_text(response.rstrip()+"\n",encoding="utf-8")
    tmp.replace(final)
for name,value in (("CONVERSATION_ID",conversation),("RESULT_STATUS",status),("RESULT_ERROR",error.replace("\n"," ")),("DENIAL_COUNT",str(denials))):
    print(f"{name}\t{value}")
PY
)"
  while IFS=$'\t' read -r key value; do
    case "$key" in
      CONVERSATION_ID) [[ -z "$value" ]] || CONVERSATION_ID="$value" ;;
      RESULT_STATUS) RESULT_STATUS="$value" ;;
      RESULT_ERROR) RESULT_ERROR="$value" ;;
      DENIAL_COUNT) DENIAL_COUNT="$value" ;;
    esac
  done <<< "$output"
}

fail_preflight() {
  local code="$1" message="$2"
  RESULT_ERROR="$message"
  printf '[FAIL] %s\n' "$message" | tee -a "$RUNNER_LOG" >&2
  write_run_env
  write_status failed "$code" 0 failed 0 preflight
  RUN_FINALIZED="true"
  printf '[antigravity-run] event=finish state=failed exit_code=%s detail=preflight\n' "$code"
  exit "$code"
}

printf '[antigravity-run] event=start run_id=%s mode=%s workspace=%q\n' "$RUN_ID" "$MODE" "$SOURCE_WORKSPACE"
printf '[antigravity-run] event=paths run_dir=%q run_dir_file=%q status=%q status_json=%q monitor=%q continue=%q events=%q final=%q\n' "$RUN_DIR" "$RUN_DIR_FILE" "$STATUS_FILE" "$STATUS_JSON" "$MONITOR_SCRIPT" "$CONTINUE_SCRIPT" "$EVENTS_LOG" "$FINAL_MESSAGE"

write_run_env
write_status planned "" 0 planned

if [[ -z "$AGY_BIN" || ! -x "$AGY_BIN" ]]; then
  fail_preflight 127 "Antigravity CLI not found (expected agy)"
fi

if MODEL_LIST="$("$AGY_BIN" models 2> "$RUN_DIR/.models-stderr")"; then
  MODEL_LIST_OK="true"
fi
if [[ -n "$MODEL" && "$MODEL_LIST_OK" == "true" ]]; then
  MODEL_IDS="$(printf '%s\n' "$MODEL_LIST" | sed $'s/\033\\[[0-9;]*m//g' | awk 'NF { print $1 }')"
  if ! grep -qxF "$MODEL" <<< "$MODEL_IDS"; then
    fail_preflight 2 "unknown --model $MODEL; run \`agy models\` and pass an exact slug"
  fi
elif [[ -n "$MODEL" ]]; then
  fail_preflight 2 "could not verify --model because \`agy models\` failed"
fi
rm -f "$RUN_DIR/.models-stderr"

prepare_review_workspace

agy_cmd=("$AGY_BIN" --output-format stream-json --print-timeout "${TIMEOUT_SECONDS}s")
[[ "$RESUMING" != "true" ]] || agy_cmd+=(--conversation "$CONVERSATION_ID")
[[ -z "$MODEL" ]] || agy_cmd+=(--model "$MODEL")
[[ -z "$EFFORT" ]] || agy_cmd+=(--effort "$EFFORT")
[[ -z "$AGENT" ]] || agy_cmd+=(--agent "$AGENT")
[[ "$ALLOW_ALL" != "true" ]] || agy_cmd+=(--dangerously-skip-permissions)
[[ "$SANDBOX" != "true" ]] || agy_cmd+=(--sandbox)
(( ${#EXTRA_ARGS[@]} == 0 )) || agy_cmd+=("${EXTRA_ARGS[@]}")
agy_cmd+=(-p)

{
  printf 'cwd='; shell_quote "$ACTIVE_WORKSPACE"; printf '\ncommand='
  for arg in "${agy_cmd[@]}"; do shell_quote "$arg"; printf ' '; done
  printf '<prompt-from-file>\nprompt_file='; shell_quote "$PROMPT_RUN_FILE"; printf '\n'
} > "$COMMAND_FILE"

{
  printf 'timestamp=%s\nworkspace=%s\nactive_workspace=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SOURCE_WORKSPACE" "$ACTIVE_WORKSPACE"
  "$AGY_BIN" --version 2>&1
  printf 'models_probe=%s\n' "$MODEL_LIST_OK"
  [[ -z "$MODEL" ]] || printf 'requested_model=%s\n' "$MODEL"
  printf 'auth=cached-credentials-unverified-until-run\n'
  git -C "$ACTIVE_WORKSPACE" status --short 2>/dev/null | head -40 || true
} > "$PREFLIGHT_LOG"
capture_workspace_baseline
write_run_env
write_status planned "" 0 planned
printf '[antigravity-run] event=ready model=%s effort=%s review_isolated=%s\n' "${MODEL:-configured-default}" "${EFFORT:-configured-default}" "$([[ "$MODE" == "review" ]] && printf true || printf false)"

if [[ "$DRY_RUN" == "true" ]]; then
  write_status dry-run 0 0 dry-run
  RUN_FINALIZED="true"
  echo "[antigravity-run] event=dry-run exit_code=0"
  exit 0
fi

STARTED_AT="$(date +%s)"
LAST_PROGRESS_AT="$STARTED_AT"
PREVIOUS="$(byte_count "$EVENTS_LOG"):$(workspace_fingerprint "$ACTIVE_WORKSPACE")"
prompt="$(cat "$PROMPT_RUN_FILE"; printf x)"
prompt="${prompt%x}"
process_group_cmd=(python3 -c 'import os,sys; os.setsid(); os.chdir(sys.argv[1]); os.execvp(sys.argv[2],sys.argv[2:])' "$ACTIVE_WORKSPACE" "${agy_cmd[@]}" "$prompt")
"${process_group_cmd[@]}" > "$EVENTS_LOG" 2> "$STDERR_LOG" &
CHILD_PID=$!
write_status running "" 0 active 0 spawn
printf '[antigravity-run] event=spawn pid=%s\n' "$CHILD_PID"

STOP_KIND=""
while kill -0 "$CHILD_PID" 2>/dev/null; do
  sleep "$HEARTBEAT_SECONDS"
  kill -0 "$CHILD_PID" 2>/dev/null || break
  NOW="$(date +%s)"
  ELAPSED=$((NOW-STARTED_AT))
  FINGERPRINT="$(byte_count "$EVENTS_LOG"):$(workspace_fingerprint "$ACTIVE_WORKSPACE")"
  SOURCE="none"
  if [[ "$FINGERPRINT" != "$PREVIOUS" ]]; then PREVIOUS="$FINGERPRINT"; LAST_PROGRESS_AT="$NOW"; SOURCE="stream-or-workspace"; fi
  STALLED_FOR=$((NOW-LAST_PROGRESS_AT))
  if (( TIMEOUT_SECONDS > 0 && ELAPSED >= TIMEOUT_SECONDS )); then
    STOP_KIND="hard"
    write_status running "" "$ELAPSED" hard-timeout-detected "$STALLED_FOR" deadline
    printf '[antigravity-run] event=timeout-detected kind=hard pid=%s\n' "$CHILD_PID"
    terminate_process_tree "$CHILD_PID"
    break
  fi
  if (( STALL_TIMEOUT_SECONDS > 0 && STALLED_FOR >= STALL_TIMEOUT_SECONDS )); then
    STOP_KIND="stall"
    write_status running "" "$ELAPSED" stall-detected "$STALLED_FOR" "$SOURCE"
    printf '[antigravity-run] event=stall kind=silent elapsed=%ss stalled_for=%ss pid=%s\n' "$ELAPSED" "$STALLED_FOR" "$CHILD_PID"
    terminate_process_tree "$CHILD_PID"
    break
  fi
  write_status running "" "$ELAPSED" active "$STALLED_FOR" "$SOURCE"
  if [[ "$SOURCE" == "none" ]]; then
    printf '[antigravity-run] event=heartbeat progress_source=none elapsed=%ss stalled_for=%ss event_bytes=%s\n' "$ELAPSED" "$STALLED_FOR" "$(byte_count "$EVENTS_LOG")"
  else
    printf '[antigravity-run] event=progress progress_source=%s elapsed=%ss stalled_for=%ss event_bytes=%s\n' "$SOURCE" "$ELAPSED" "$STALLED_FOR" "$(byte_count "$EVENTS_LOG")"
  fi
done

set +e
wait "$CHILD_PID"; EXIT_CODE=$?
set -e
terminate_process_tree "$CHILD_PID"
[[ -z "$STOP_KIND" ]] || EXIT_CODE=124
extract_result
capture_workspace_artifacts
git -C "$SOURCE_WORKSPACE" status --short > "$SOURCE_AFTER" 2>/dev/null || true
SOURCE_FINGERPRINT_AFTER="$(workspace_fingerprint "$SOURCE_WORKSPACE")"
ENDED_AT="$(date +%s)"; ELAPSED=$((ENDED_AT-STARTED_AT))
FINAL_STATE="finished"
if [[ "$STOP_KIND" == "hard" ]]; then
  FINAL_STATE="timed-out"
elif [[ "$STOP_KIND" == "stall" ]]; then
  FINAL_STATE="stalled"
elif (( EXIT_CODE != 0 )); then
  FINAL_STATE="failed"
elif [[ "$RESULT_STATUS" != "SUCCESS" ]]; then
  FINAL_STATE="failed"; EXIT_CODE=1
elif (( DENIAL_COUNT > 0 )); then
  FINAL_STATE="failed"; EXIT_CODE=1
elif [[ "$MODE" == "review" && "$SOURCE_FINGERPRINT_BEFORE" != "$SOURCE_FINGERPRINT_AFTER" ]]; then
  FINAL_STATE="failed"; EXIT_CODE=1; RESULT_ERROR="source workspace changed during isolated review"
fi
write_run_env
write_status "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED" "$FINAL_STATE" 0 finish
RUN_FINALIZED="true"
printf '[antigravity-run] event=finish state=%s exit_code=%s elapsed=%ss conversation_id=%s model=%s result_status=%s denials=%s final=%q\n' "$FINAL_STATE" "$EXIT_CODE" "$ELAPSED" "$CONVERSATION_ID" "${MODEL:-configured-default}" "$RESULT_STATUS" "$DENIAL_COUNT" "$FINAL_MESSAGE"
if [[ "$FINAL_STATE" == "failed" && ! -s "$FINAL_MESSAGE" && -s "$STDERR_LOG" ]]; then
  printf '[antigravity-run] event=failure-reason stderr_log=%q\n' "$STDERR_LOG"
  tail -c 2000 "$STDERR_LOG" | sed 's/^/[antigravity-run] stderr| /'
fi
exit "$EXIT_CODE"
