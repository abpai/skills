#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cursor-agent-lib.sh
source "$SCRIPT_DIR/cursor-agent-lib.sh"

MODE="${1:-}"
usage() {
  cat >&2 <<'EOF'
Usage: composer-run.sh generate|review --prompt-file PATH [options]

Options:
  --prompt-file PATH      Prompt file read by this wrapper and passed as Cursor's positional prompt.
  --workspace PATH        Workspace directory (default: current directory).
  --model MODEL           Cursor model (generate default: composer-2.5-fast; review default: composer-2.5).
  --output-format FORMAT  text, json, or stream-json (default: text).
  --mode MODE             Cursor read-only mode for this run: ask or plan (review default: ask).
  --auth MODE             Wrapper auth mode: auto, api-key, or login (default: auto).
                          auto = browser login first, then CURSOR_API_KEY, else hard stop.
                          Wrapper-only; not a Cursor Agent CLI flag.
  --env-file PATH         Load CURSOR_API_KEY from this dotenv file.
  --timeout SECONDS       Timeout for the run (default: 1800).
  --worktree NAME         Let Cursor Agent create/use an isolated worktree.
  --worktree-base REF     Base ref for Cursor Agent worktree.
  --no-force              Generate without --force.
  --no-approve-mcps       Generate without --approve-mcps.
EOF
}

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  usage
  exit 0
elif [[ "$MODE" == "generate" || "$MODE" == "review" ]]; then
  shift
else
  usage
  exit 2
fi

PROMPT_FILE=""
WORKSPACE="$PWD"
MODEL=""
OUTPUT_FORMAT="text"
RUN_MODE=""
AUTH_MODE="auto"
ENV_FILE="${CURSOR_ENV_FILE:-}"
ENV_FILE_EXPLICIT="false"
TIMEOUT_SECONDS="1800"
WORKTREE_NAME=""
WORKTREE_BASE=""
FORCE_GENERATE="true"
APPROVE_MCPS="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt-file)
      PROMPT_FILE="${2:?missing value for --prompt-file}"
      shift 2
      ;;
    --workspace)
      WORKSPACE="${2:?missing value for --workspace}"
      shift 2
      ;;
    --model)
      MODEL="${2:?missing value for --model}"
      shift 2
      ;;
    --output-format)
      OUTPUT_FORMAT="${2:?missing value for --output-format}"
      shift 2
      ;;
    --mode)
      RUN_MODE="${2:?missing value for --mode}"
      shift 2
      ;;
    --auth)
      AUTH_MODE="${2:?missing value for --auth}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?missing value for --env-file}"
      ENV_FILE_EXPLICIT="true"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:?missing value for --timeout}"
      shift 2
      ;;
    --worktree)
      WORKTREE_NAME="${2:?missing value for --worktree}"
      shift 2
      ;;
    --worktree-base)
      WORKTREE_BASE="${2:?missing value for --worktree-base}"
      shift 2
      ;;
    --no-force)
      FORCE_GENERATE="false"
      shift
      ;;
    --no-approve-mcps)
      APPROVE_MCPS="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[FAIL] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

case "$OUTPUT_FORMAT" in
  text|json|stream-json) ;;
  *)
    echo "[FAIL] --output-format must be text, json, or stream-json" >&2
    exit 2
    ;;
esac

case "$RUN_MODE" in
  ""|ask|plan) ;;
  *)
    echo "[FAIL] --mode must be ask or plan" >&2
    exit 2
    ;;
esac

if [[ -z "$PROMPT_FILE" || ! -f "$PROMPT_FILE" ]]; then
  echo "[FAIL] --prompt-file is required and must exist" >&2
  exit 2
fi

if [[ -z "$MODEL" ]]; then
  if [[ "$MODE" == "generate" ]]; then
    MODEL="composer-2.5-fast"
  else
    MODEL="composer-2.5"
  fi
fi

if ! resolve_cursor_auth "$AUTH_MODE" "$WORKSPACE" "$ENV_FILE" "$ENV_FILE_EXPLICIT"; then
  exit 1
fi

prompt="$(<"$PROMPT_FILE")"
cmd=("$CURSOR_AGENT_BIN" -p --trust --output-format "$OUTPUT_FORMAT" --model "$MODEL")

if [[ "$MODE" == "review" ]]; then
  cmd+=(--mode "${RUN_MODE:-ask}")
else
  if [[ -n "$RUN_MODE" ]]; then
    cmd+=(--mode "$RUN_MODE")
  fi
  if [[ "$FORCE_GENERATE" == "true" ]]; then
    cmd+=(--force)
  fi
  if [[ "$APPROVE_MCPS" == "true" ]]; then
    cmd+=(--approve-mcps)
  fi
fi

if [[ -n "$WORKTREE_NAME" ]]; then
  cmd+=(--worktree "$WORKTREE_NAME")
  if [[ -n "$WORKTREE_BASE" ]]; then
    cmd+=(--worktree-base "$WORKTREE_BASE")
  fi
else
  cmd+=(--workspace "$WORKSPACE")
fi

if command -v timeout >/dev/null 2>&1; then
  run_with_cursor_auth timeout "$TIMEOUT_SECONDS" "${cmd[@]}" "$prompt"
elif command -v gtimeout >/dev/null 2>&1; then
  run_with_cursor_auth gtimeout "$TIMEOUT_SECONDS" "${cmd[@]}" "$prompt"
else
  run_with_cursor_auth "${cmd[@]}" "$prompt"
fi
