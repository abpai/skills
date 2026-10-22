#!/usr/bin/env bash
# Kept for muscle memory and older docs. Validation now lives in the `skills`
# CLI (scripts/skills.ts); run `bin/skills gate --list` to see every gate.
#
#   scripts/validate-skills.sh                  -> bin/skills gate surfaces structure tooling runners
#   scripts/validate-skills.sh --skip-versions  -> bin/skills check (fast, offline)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for arg in "$@"; do
  if [[ "$arg" == "--skip-versions" ]]; then
    exec "$ROOT_DIR/bin/skills" check
  fi
done

exec "$ROOT_DIR/bin/skills" gate surfaces structure tooling runners
