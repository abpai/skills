#!/usr/bin/env bash
# Source this file from cursor-run.sh.

CURSOR_AGENT_BIN=""
RESOLVED_CURSOR_AUTH=""
ACTIVE_CURSOR_KEY=""

resolve_agent_bin() {
  if command -v agent >/dev/null 2>&1; then
    CURSOR_AGENT_BIN="agent"
  elif command -v cursor-agent >/dev/null 2>&1; then
    CURSOR_AGENT_BIN="cursor-agent"
  else
    return 1
  fi
}

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

load_explicit_env_file() {
  local file="$1" line
  [[ -f "$file" ]] || { echo "[FAIL] Cursor env file not found: $file" >&2; return 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == CURSOR_API_KEY=* ]]; then
      ACTIVE_CURSOR_KEY="$(strip_quotes "${line#CURSOR_API_KEY=}")"
      [[ -n "$ACTIVE_CURSOR_KEY" ]] && return 0
    fi
  done < "$file"
  echo "[FAIL] explicit Cursor env file has no CURSOR_API_KEY: $file" >&2
  return 1
}

check_browser_authenticated() {
  local output
  output="$(mktemp)"
  if (unset CURSOR_API_KEY; "$CURSOR_AGENT_BIN" status --format json) > "$output" 2>/dev/null &&
    python3 - "$output" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except (OSError, json.JSONDecodeError):
    raise SystemExit(1)
ok = data.get("authenticated") is True or data.get("isAuthenticated") is True or data.get("status") == "authenticated"
raise SystemExit(0 if ok else 1)
PY
  then
    rm -f "$output"
    return 0
  fi
  rm -f "$output"
  return 1
}

print_cursor_auth_help() {
  cat >&2 <<'EOF'
Cursor Agent CLI is not authenticated.

Run `agent login`, export CURSOR_API_KEY, or pass an explicit key file with
`--env-file PATH` / CURSOR_ENV_FILE. Workspace and ancestor .env files are not
searched.
EOF
}

resolve_cursor_auth() {
  local mode="${1:-auto}" env_file="${2:-}"
  RESOLVED_CURSOR_AUTH=""
  ACTIVE_CURSOR_KEY=""
  resolve_agent_bin || { echo "[FAIL] Cursor Agent CLI not found (agent or cursor-agent)" >&2; return 1; }

  case "$mode" in auto|login|api-key) ;; *) echo "[FAIL] --auth must be auto, login, or api-key" >&2; return 1 ;; esac

  if [[ "$mode" != "api-key" ]] && check_browser_authenticated 2>/dev/null; then
    RESOLVED_CURSOR_AUTH="login"
    return 0
  fi
  if [[ "$mode" == "login" ]]; then
    print_cursor_auth_help
    return 1
  fi
  if [[ -n "${CURSOR_API_KEY:-}" ]]; then
    ACTIVE_CURSOR_KEY="$CURSOR_API_KEY"
    RESOLVED_CURSOR_AUTH="api-key"
    return 0
  fi
  if [[ -n "$env_file" ]] && load_explicit_env_file "$env_file"; then
    RESOLVED_CURSOR_AUTH="api-key"
    return 0
  fi
  print_cursor_auth_help
  return 1
}

run_with_cursor_auth() {
  if [[ "$RESOLVED_CURSOR_AUTH" == "api-key" ]]; then
    CURSOR_API_KEY="$ACTIVE_CURSOR_KEY" "$@"
  else
    (unset CURSOR_API_KEY; "$@")
  fi
}
