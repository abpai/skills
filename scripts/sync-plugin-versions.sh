#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "[FAIL] scripts/sync-plugin-versions.sh: bun is required to sync plugin manifest versions"
  exit 1
fi

exec bun scripts/skill-metadata.ts sync-plugin-versions "$@"
