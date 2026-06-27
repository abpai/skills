#!/usr/bin/env bash
# Shared Cursor Agent CLI helpers for composer scripts.
# Source this file; do not execute directly.

cursor_agent_lib_loaded="${cursor_agent_lib_loaded:-}"

if [[ -n "$cursor_agent_lib_loaded" ]]; then
  return 0 2>/dev/null || exit 0
fi
cursor_agent_lib_loaded=1

CURSOR_AGENT_BIN=""
RESOLVED_CURSOR_AUTH=""
ACTIVE_CURSOR_KEY=""

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

redact() {
  sed -E \
    -e 's/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1…/g' \
    -e 's/(crsr_[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1…/g' \
    -e 's/(CURSOR_API_KEY=)[^[:space:]]+/\1[redacted]/Ig' \
    -e 's/(api[-_ ]?key[:=][[:space:]]*)[^[:space:]]+/\1[redacted]/Ig'
}

resolve_agent_bin() {
  if command -v agent >/dev/null 2>&1; then
    CURSOR_AGENT_BIN="agent"
    return 0
  fi
  if command -v cursor-agent >/dev/null 2>&1; then
    CURSOR_AGENT_BIN="cursor-agent"
    return 0
  fi
  return 1
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    if [[ "$line" == CURSOR_API_KEY=* ]]; then
      ACTIVE_CURSOR_KEY="$(strip_quotes "${line#CURSOR_API_KEY=}")"
      return 0
    fi
  done < "$file"
  return 1
}

find_cursor_api_key() {
  local workspace="${1:-$PWD}"
  local env_file="${2:-}"
  local env_file_explicit="${3:-false}"
  local auth_mode="${4:-auto}"

  ACTIVE_CURSOR_KEY=""

  if [[ -n "${CURSOR_API_KEY:-}" ]]; then
    ACTIVE_CURSOR_KEY="$CURSOR_API_KEY"
    return 0
  fi

  if [[ "$env_file_explicit" == "true" ]]; then
    if load_env_file "$env_file"; then
      return 0
    fi
    echo "[FAIL] explicit env file did not contain CURSOR_API_KEY: $env_file" >&2
    return 1
  fi

  if [[ -n "$env_file" ]]; then
    if load_env_file "$env_file"; then
      return 0
    fi
    if [[ "$auth_mode" == "api-key" ]]; then
      echo "[FAIL] CURSOR_ENV_FILE did not contain CURSOR_API_KEY: $env_file" >&2
      return 1
    fi
  fi

  local dir
  dir="$(cd "$workspace" 2>/dev/null && pwd -P || printf '%s' "$workspace")"
  while :; do
    if load_env_file "$dir/.env"; then
      return 0
    fi
    local next
    next="$(dirname "$dir")"
    [[ "$next" == "$dir" ]] && break
    dir="$next"
  done

  return 1
}

check_browser_authenticated() {
  local bin="${1:-$CURSOR_AGENT_BIN}"
  local status_output

  [[ -n "$bin" ]] || return 1

  status_output="$(mktemp)"
  if (unset CURSOR_API_KEY; "$bin" status --format json >"$status_output" 2>/dev/null); then
    if command -v jq >/dev/null 2>&1 &&
      jq -e '
        (.authenticated == true)
        or (.isAuthenticated == true)
        or (.auth.authenticated == true)
        or (.status == "authenticated")
      ' "$status_output" >/dev/null 2>&1; then
      rm -f "$status_output"
      return 0
    fi
  fi

  if (unset CURSOR_API_KEY; "$bin" status 2>/dev/null | grep -Eiq 'authenticated|logged in|signed in'); then
    rm -f "$status_output"
    return 0
  fi

  rm -f "$status_output"
  return 1
}

print_cursor_auth_help() {
  cat >&2 <<'EOF'
Cursor Agent CLI is not authenticated.

Use one of:

  agent login

or:

  export CURSOR_API_KEY=...

Then rerun this command.
EOF
}

resolve_cursor_auth() {
  local auth_mode="${1:-auto}"
  local workspace="${2:-$PWD}"
  local env_file="${3:-}"
  local env_file_explicit="${4:-false}"

  RESOLVED_CURSOR_AUTH=""
  ACTIVE_CURSOR_KEY=""

  if ! resolve_agent_bin; then
    echo "[FAIL] Cursor Agent CLI not found. Install it first: curl https://cursor.com/install -fsS | bash" >&2
    return 1
  fi

  case "$auth_mode" in
    auto|api-key|login) ;;
    *)
      echo "[FAIL] --auth must be auto, api-key, or login" >&2
      return 1
      ;;
  esac

  if [[ "$auth_mode" == "login" ]]; then
    if [[ "$env_file_explicit" == "true" ]]; then
      echo "[FAIL] --env-file cannot be combined with --auth login" >&2
      return 1
    fi
    if check_browser_authenticated "$CURSOR_AGENT_BIN"; then
      RESOLVED_CURSOR_AUTH="login"
      return 0
    fi
    print_cursor_auth_help
    return 1
  fi

  if [[ "$auth_mode" == "api-key" ]]; then
    if find_cursor_api_key "$workspace" "$env_file" "$env_file_explicit" "$auth_mode"; then
      RESOLVED_CURSOR_AUTH="api-key"
      return 0
    fi
    echo "[FAIL] CURSOR_API_KEY not found; set it, pass CURSOR_ENV_FILE/--env-file, or use --auth login" >&2
    return 1
  fi

  # auto: browser login first, CURSOR_API_KEY fallback, hard stop if neither.
  if check_browser_authenticated "$CURSOR_AGENT_BIN"; then
    RESOLVED_CURSOR_AUTH="login"
    return 0
  fi

  if find_cursor_api_key "$workspace" "$env_file" "$env_file_explicit" "$auth_mode"; then
    RESOLVED_CURSOR_AUTH="api-key"
    return 0
  fi

  print_cursor_auth_help
  return 1
}

run_with_cursor_auth() {
  if [[ "$RESOLVED_CURSOR_AUTH" == "api-key" && -n "$ACTIVE_CURSOR_KEY" ]]; then
    CURSOR_API_KEY="$ACTIVE_CURSOR_KEY" "$@"
  else
    (unset CURSOR_API_KEY; "$@")
  fi
}
