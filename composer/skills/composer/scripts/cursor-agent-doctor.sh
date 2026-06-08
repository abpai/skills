#!/usr/bin/env bash
set -euo pipefail

MODEL="composer-2.5-fast"
TIMEOUT_SECONDS="60"
RUN_SMOKE="false"
CHECK_CODEX="true"
ENV_FILE="${CURSOR_ENV_FILE:-}"
ENV_FILE_EXPLICIT="false"
CURSOR_KEY_VALUE="${CURSOR_API_KEY:-}"
AUTH_MODE="auto"
ACTIVE_CURSOR_KEY=""
SMOKE_ALREADY_RAN="false"

usage() {
  cat <<'EOF'
Usage: cursor-agent-doctor.sh [--smoke] [--model MODEL] [--timeout SECONDS] [--env-file PATH] [--auth MODE] [--skip-codex]

Checks the local Cursor Agent + Composer setup without printing secrets.

Options:
  --smoke            Run a small headless Composer prompt.
  --model MODEL      Model to require/smoke (default: composer-2.5-fast).
  --timeout SECONDS  Timeout for Cursor/Codex probes (default: 60).
  --env-file PATH    Load CURSOR_API_KEY from this dotenv file.
  --auth MODE        auto, api-key, or login (default: auto).
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
      ENV_FILE_EXPLICIT="true"
      shift 2
      ;;
    --auth)
      AUTH_MODE="${2:?missing value for --auth}"
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

case "$AUTH_MODE" in
  auto|api-key|login) ;;
  *)
    echo "[FAIL] --auth must be auto, api-key, or login" >&2
    exit 2
    ;;
esac

if [[ "$ENV_FILE_EXPLICIT" == "true" && "$AUTH_MODE" == "login" ]]; then
  echo "[FAIL] --env-file cannot be combined with --auth login" >&2
  exit 2
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

find_and_load_env() {
  CURSOR_KEY_VALUE=""

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
    -e 's/(crsr_[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1…/g' \
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

run_cursor_models() {
  local key="$1"
  local output_file="$2"

  if [[ -n "$key" ]]; then
    CURSOR_API_KEY="$key" run_timeout cursor-agent models >"$output_file" 2>&1
  else
    (unset CURSOR_API_KEY; run_timeout cursor-agent models >"$output_file" 2>&1)
  fi
}

model_list_has_name() {
  local output_file="$1"
  local wanted="$2"
  # Scan every whitespace-delimited field, not just $1, so a leading marker
  # (e.g. "* composer-2.5" for the active model, or a "- " bullet) doesn't hide
  # the id. Field equality still avoids substring false positives.
  awk -v wanted="$wanted" '{ for (i = 1; i <= NF; i++) if ($i == wanted) found = 1 } END { exit(found ? 0 : 1) }' "$output_file"
}

model_list_has_composer_25() {
  local output_file="$1"
  awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^composer-2\.5(-fast)?$/) found = 1 } END { exit(found ? 0 : 1) }' "$output_file"
}

check_models() {
  local label="$1"
  local key="$2"
  local models_output
  models_output="$(mktemp)"

  if run_cursor_models "$key" "$models_output"; then
    echo "[OK] cursor-agent models succeeded using $label"
    if model_list_has_name "$models_output" "$MODEL"; then
      echo "[OK] required model available: $MODEL"
      rm -f "$models_output"
      return 0
    fi
    if model_list_has_composer_25 "$models_output"; then
      echo "[WARN] $MODEL not listed, but another Composer 2.5 model is available"
      rm -f "$models_output"
      return 0
    fi
    echo "[WARN] no Composer 2.5 model found in model list for $label"
    redact <"$models_output" | tail -20
  else
    echo "[WARN] cursor-agent models failed or timed out using $label"
    redact <"$models_output" | tail -20
  fi

  rm -f "$models_output"
  return 1
}

run_cursor_prompt() {
  local key="$1"
  shift

  if [[ -n "$key" ]]; then
    CURSOR_API_KEY="$key" run_timeout cursor-agent "$@"
  else
    (unset CURSOR_API_KEY; run_timeout cursor-agent "$@")
  fi
}

check_login_status() {
  local status_output
  status_output="$(mktemp)"

  if (unset CURSOR_API_KEY; run_timeout cursor-agent status >"$status_output" 2>&1) &&
    ! grep -qiE 'not logged in|not authenticated|authentication required' "$status_output"; then
    echo "[OK] cursor-agent status succeeded using Cursor login"
    rm -f "$status_output"
    return 0
  fi

  echo "[FAIL] Cursor login is not ready; run cursor-agent login or use CURSOR_API_KEY"
  redact <"$status_output" | tail -10
  rm -f "$status_output"
  return 1
}

smoke_probe() {
  local label="$1"
  local key="$2"
  local smoke_dir
  local smoke_output
  local prompt

  smoke_dir="$(mktemp -d "${TMPDIR:-/tmp}/composer-smoke.XXXXXX")"
  smoke_output="$(mktemp)"
  prompt='Reply with exactly: composer-smoke-ok'

  if run_cursor_prompt "$key" -p --mode ask --trust --workspace "$smoke_dir" --model "$MODEL" --output-format text "$prompt" >"$smoke_output" 2>&1; then
    if grep -q 'composer-smoke-ok' "$smoke_output"; then
      echo "[OK] composer smoke returned expected text using $label"
      rm -f "$smoke_output"
      rm -R "$smoke_dir" 2>/dev/null || true
      return 0
    fi
    echo "[FAIL] composer smoke completed using $label but did not return expected text"
  else
    echo "[FAIL] composer smoke failed or timed out using $label"
  fi

  redact <"$smoke_output" | tail -20
  rm -f "$smoke_output"
  rm -R "$smoke_dir" 2>/dev/null || true
  return 1
}

try_api_key_auth() {
  if check_models "CURSOR_API_KEY" "$CURSOR_KEY_VALUE"; then
    ACTIVE_CURSOR_KEY="$CURSOR_KEY_VALUE"
    return 0
  fi

  echo "[WARN] model listing did not prove Composer availability; trying a tiny headless prompt with CURSOR_API_KEY"
  if smoke_probe "CURSOR_API_KEY" "$CURSOR_KEY_VALUE"; then
    ACTIVE_CURSOR_KEY="$CURSOR_KEY_VALUE"
    SMOKE_ALREADY_RAN="true"
    return 0
  fi

  return 1
}

try_login_auth() {
  if ! check_login_status; then
    return 1
  fi

  if check_models "Cursor login" ""; then
    :
  else
    echo "[WARN] model listing did not prove Composer availability; continuing to the login smoke proof"
  fi

  if smoke_probe "Cursor login" ""; then
    ACTIVE_CURSOR_KEY=""
    SMOKE_ALREADY_RAN="true"
    return 0
  fi

  return 1
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

if [[ $failed -eq 0 ]]; then
  if [[ "$AUTH_MODE" == "login" ]]; then
    echo "[OK] using Cursor browser login/cache auth"
    if ! try_login_auth; then
      failed=1
    fi
  else
    if find_and_load_env; then
      if try_api_key_auth; then
        :
      elif [[ "$AUTH_MODE" == "auto" ]]; then
        echo "[WARN] CURSOR_API_KEY did not prove Composer availability; retrying with Cursor login"
        if ! try_login_auth; then
          failed=1
        fi
      else
        failed=1
      fi
    elif [[ "$AUTH_MODE" == "api-key" ]]; then
      failed=1
    else
      echo "[OK] no CURSOR_API_KEY found; trying Cursor browser login/cache auth"
      if ! try_login_auth; then
        failed=1
      fi
    fi
  fi
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

if [[ "$RUN_SMOKE" == "true" && $failed -eq 0 && "$SMOKE_ALREADY_RAN" != "true" ]]; then
  if ! smoke_probe "selected auth" "$ACTIVE_CURSOR_KEY"; then
    failed=1
  fi
fi

if [[ $failed -ne 0 ]]; then
  echo "[FAIL] composer setup check failed"
  exit 1
fi

echo "[OK] composer setup check passed"
