#!/usr/bin/env bash
# Resolve the directory containing composer-run.sh and cursor-agent-doctor.sh.
# Prints the bin directory on stdout; exits 1 when not found.
#
# Usage:
#   COMPOSER_BIN="$(composer-path.sh)"
#   "$COMPOSER_BIN/composer-run.sh" generate ...
#   eval "$(composer-path.sh --export)"

set -euo pipefail

find_composer_bin() {
  local script_dir candidate

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # 1. Claude plugin install: plugin bin/ is on PATH.
  if command -v composer-run.sh >/dev/null 2>&1; then
    dirname "$(command -v composer-run.sh)"
    return 0
  fi

  # 2. This script's directory (installed skill sibling bin/, or source checkout).
  if [[ -x "$script_dir/composer-run.sh" ]]; then
    printf '%s\n' "$script_dir"
    return 0
  fi

  # 3. Common Codex / flat skill install locations.
  for candidate in \
    "$HOME/.agents/skills/composer/bin" \
    "${COMPOSER_SKILL_DIR:-}/bin" \
    "$HOME/.codex/skills/composer/bin" \
    ; do
    [[ -n "$candidate" && -x "$candidate/composer-run.sh" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done

  # 4. Source checkout (abpai/skills layout).
  for candidate in \
    "$HOME/Projects/skills/composer/skills/composer/bin" \
    "$HOME/Projects/skills/composer/bin" \
    ; do
    [[ -x "$candidate/composer-run.sh" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done

  return 1
}

case "${1:-}" in
  --export)
    if bin="$(find_composer_bin)"; then
      printf 'export COMPOSER_BIN=%q\n' "$bin"
      exit 0
    fi
    cat >&2 <<'EOF'
[FAIL] Composer wrapper scripts not found.

Looked for composer-run.sh on PATH and under:
  - this script's bin/ directory
  - $COMPOSER_SKILL_DIR/bin
  - ~/.agents/skills/composer/bin
  - ~/Projects/skills/composer/skills/composer/bin

Reinstall the composer skill, or run agent -p directly when wrappers are unavailable.
EOF
    exit 1
    ;;
  -h|--help)
    cat <<'EOF'
Usage: composer-path.sh [--export]

Print the directory containing composer-run.sh and cursor-agent-doctor.sh.
EOF
    ;;
  *)
    find_composer_bin
    ;;
esac
