#!/usr/bin/env bash
set -euo pipefail

MODEL="composer-2.5-fast"
TIMEOUT_SECONDS="60"
RUN_SMOKE="false"
CHECK_CODEX="true"
ENV_FILE="${CURSOR_ENV_FILE:-}"
CURSOR_KEY_VALUE="${CURSOR_API_KEY:-}"

usage() {
  cat <<'EOF'
Usage: cursor-agent-doctor.sh [--smoke] [--model MODEL] [--timeout SECONDS] [--env-file PATH] [--skip-codex]

Checks the local Cursor Agent + Composer setup without printing secrets.

Options:
  --smoke            Run a small headless Composer prompt.
  --model MODEL      Model to require/smoke (default: composer-2.5-fast).
  --timeout SECONDS  Timeout for Cursor/Codex probes (default: 60).
  --env-file PATH    Load CURSOR_API_KEY from this dotenv file.
  --skip-codex       Skip Codex login status check.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke)
      RUN_SMOKE="true"
      shift
      ;;
    --model)
      MODEL="${2:?missing value for --model}"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:?missing value for --timeout}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?missing value for --env-file}"
      shift 2
      ;;
    --skip-codex)
      CHECK_CODEX="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[FAIL] unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

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

find_and_load_env() {
  if [[ -n "$ENV_FILE" ]]; then
    if load_env_file "$ENV_FILE"; then
      echo "[OK] loaded CURSOR_API_KEY from explicit env file"
      return 0
    fi
    echo "[FAIL] explicit env file did not contain CURSOR_API_KEY: $ENV_FILE"
    return 1
  fi

  if [[ -n "${CURSOR_API_KEY:-}" ]]; then
    CURSOR_KEY_VALUE="$CURSOR_API_KEY"
    echo "[OK] CURSOR_API_KEY already present in environment"
    return 0
  fi

  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if load_env_file "$dir/.env"; then
      echo "[OK] loaded CURSOR_API_KEY from .env"
      return 0
    fi
    dir="$(dirname "$dir")"
  done

  echo "[WARN] CURSOR_API_KEY not found in environment or ancestor .env files"
  return 1
}

redact() {
  sed -E \
    -e 's/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1…/g' \
    -e 's/(CURSOR_API_KEY=)[^[:space:]]+/\1[redacted]/Ig' \
    -e 's/(api[-_ ]?key[:=][[:space:]]*)[^[:space:]]+/\1[redacted]/Ig'
}

run_timeout() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "$TIMEOUT_SECONDS" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$TIMEOUT_SECONDS" "$@"
  else
    "$@"
  fi
}

run_timeout_15() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 15 "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout 15 "$@"
  else
    "$@"
  fi
}

run_cursor_timeout() {
  if [[ -n "$CURSOR_KEY_VALUE" ]]; then
    CURSOR_API_KEY="$CURSOR_KEY_VALUE" run_timeout cursor-agent "$@"
  else
    run_timeout cursor-agent "$@"
  fi
}

failed=0

if command -v cursor-agent >/dev/null 2>&1; then
  echo "[OK] cursor-agent found: $(command -v cursor-agent)"
  if version_output="$(cursor-agent --version 2>&1 | redact)"; then
    echo "[OK] cursor-agent version: $version_output"
  else
    echo "[FAIL] cursor-agent --version failed"
    failed=1
  fi
else
  echo "[FAIL] cursor-agent not found on PATH"
  failed=1
fi

if ! find_and_load_env; then
  failed=1
fi

if [[ $failed -eq 0 ]]; then
  models_output="$(mktemp)"
  if run_cursor_timeout models >"$models_output" 2>&1; then
    echo "[OK] cursor-agent models succeeded"
    if grep -Fq "$MODEL" "$models_output"; then
      echo "[OK] required model available: $MODEL"
    elif grep -Eq '(^|[[:space:]])composer-2\.5(-fast)?([[:space:]]|-)' "$models_output"; then
      echo "[WARN] $MODEL not listed, but another Composer 2.5 model is available"
    else
      echo "[FAIL] no Composer 2.5 model found in model list"
      failed=1
    fi
  else
    echo "[FAIL] cursor-agent models failed or timed out"
    redact <"$models_output" | tail -20
    failed=1
  fi
  rm -f "$models_output"
fi

if [[ "$CHECK_CODEX" == "true" ]]; then
  if command -v codex >/dev/null 2>&1; then
    echo "[OK] codex found: $(command -v codex)"
    codex --version 2>&1 | redact | sed 's/^/[OK] codex version: /'
    if run_timeout_15 codex login status >/dev/null 2>&1; then
      echo "[OK] codex login status succeeded"
    else
      echo "[WARN] codex login status did not succeed; run codex login if OpenAI review is needed"
    fi
  else
    echo "[WARN] codex not found; skip OpenAI/Codex login check"
  fi
fi

if [[ "$RUN_SMOKE" == "true" && $failed -eq 0 ]]; then
  smoke_dir="$(mktemp -d "${TMPDIR:-/tmp}/composer-smoke.XXXXXX")"
  smoke_output="$(mktemp)"
  prompt='Reply with exactly: composer-smoke-ok'
  if run_cursor_timeout -p --mode ask --trust --workspace "$smoke_dir" --model "$MODEL" --output-format text "$prompt" >"$smoke_output" 2>&1; then
    if grep -q 'composer-smoke-ok' "$smoke_output"; then
      echo "[OK] composer smoke returned expected text"
    else
      echo "[FAIL] composer smoke completed but did not return expected text"
      redact <"$smoke_output" | tail -20
      failed=1
    fi
  else
    echo "[FAIL] composer smoke failed or timed out"
    redact <"$smoke_output" | tail -20
    failed=1
  fi
  rm -f "$smoke_output"
  rm -R "$smoke_dir" 2>/dev/null || true
fi

if [[ $failed -ne 0 ]]; then
  echo "[FAIL] composer setup check failed"
  exit 1
fi

echo "[OK] composer setup check passed"
