#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
usage() {
  cat >&2 <<'EOF'
Usage: composer-run.sh generate|review --prompt-file PATH [options]

Options:
  --prompt-file PATH      Prompt file to send to Cursor Agent.
  --workspace PATH        Workspace directory (default: current directory).
  --model MODEL           Cursor model (generate default: composer-2.5-fast; review default: composer-2.5).
  --output-format FORMAT  text, json, or stream-json (default: text).
  --mode MODE             Cursor read-only mode for this run: ask or plan (review default: ask).
  --auth MODE             auto, api-key, or login (default: auto).
  --env-file PATH         Load CURSOR_API_KEY from this dotenv file.
  --timeout SECONDS       Timeout for the run (default: 1800).
  --worktree NAME         Let Cursor Agent create/use an isolated worktree.
  --worktree-base REF     Base ref for Cursor Agent worktree.
  --no-force              Generate without --force.
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
TIMEOUT_SECONDS="1800"
WORKTREE_NAME=""
WORKTREE_BASE=""
FORCE_GENERATE="true"
CURSOR_KEY_VALUE="${CURSOR_API_KEY:-}"

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

case "$AUTH_MODE" in
  auto|api-key|login) ;;
  *)
    echo "[FAIL] --auth must be auto, api-key, or login" >&2
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

strip_quotes() {
  local value="$1"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    if [[ "$line" == CURSOR_API_KEY=* ]]; then
      CURSOR_KEY_VALUE="$(strip_quotes "${line#CURSOR_API_KEY=}")"
      return 0
    fi
  done < "$file"
  return 1
}

if [[ -n "$ENV_FILE" ]]; then
  if [[ "$AUTH_MODE" == "login" ]]; then
    echo "[FAIL] --env-file cannot be combined with --auth login" >&2
    exit 2
  fi
  load_env_file "$ENV_FILE" || {
    echo "[FAIL] explicit env file did not contain CURSOR_API_KEY: $ENV_FILE" >&2
    exit 1
  }
elif [[ "$AUTH_MODE" == "login" ]]; then
  CURSOR_KEY_VALUE=""
elif [[ -n "${CURSOR_API_KEY:-}" ]]; then
  CURSOR_KEY_VALUE="$CURSOR_API_KEY"
else
  # Search ancestor .env files starting from the workspace. Canonicalize to an
  # absolute path first so a relative --workspace (e.g. '.') can't make
  # `dirname` spin forever, and guard the loop against a fixed point regardless.
  dir="$(cd "$WORKSPACE" 2>/dev/null && pwd -P || printf '%s' "$WORKSPACE")"
  loaded="false"
  while :; do
    if load_env_file "$dir/.env"; then
      loaded="true"
      break
    fi
    next="$(dirname "$dir")"
    [[ "$next" == "$dir" ]] && break
    dir="$next"
  done
  if [[ "$loaded" != "true" && "$AUTH_MODE" == "api-key" ]]; then
    echo "[FAIL] CURSOR_API_KEY not found; set it, pass CURSOR_ENV_FILE/--env-file, or use --auth login" >&2
    exit 1
  fi
fi

prompt="$(<"$PROMPT_FILE")"
cmd=(cursor-agent -p --trust --output-format "$OUTPUT_FORMAT" --model "$MODEL")

if [[ "$MODE" == "review" ]]; then
  cmd+=(--mode "${RUN_MODE:-ask}")
else
  if [[ -n "$RUN_MODE" ]]; then
    cmd+=(--mode "$RUN_MODE")
  fi
  if [[ "$FORCE_GENERATE" == "true" ]]; then
    cmd+=(--force)
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

run_with_auth() {
  if [[ -n "$CURSOR_KEY_VALUE" ]]; then
    CURSOR_API_KEY="$CURSOR_KEY_VALUE" "$@"
  else
    (unset CURSOR_API_KEY; "$@")
  fi
}

if command -v timeout >/dev/null 2>&1; then
  run_with_auth timeout "$TIMEOUT_SECONDS" "${cmd[@]}" "$prompt"
elif command -v gtimeout >/dev/null 2>&1; then
  run_with_auth gtimeout "$TIMEOUT_SECONDS" "${cmd[@]}" "$prompt"
else
  run_with_auth "${cmd[@]}" "$prompt"
fi
