#!/usr/bin/env bash
# Usage: run-hidden.sh <candidate-root>
# Copies the candidate tree into a fresh temp dir, adds the hidden acceptance
# tests, and runs the whole suite. The candidate tree is never modified.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
candidate="${1:?candidate root}"
work="$(mktemp -d "${TMPDIR:-/tmp}/a06-hidden.XXXXXX")"
cp -R "$candidate/." "$work/"
cp "$here/hidden/acceptance.test.ts" "$work/tests/zz-acceptance.test.ts"
cd "$work"
echo "== hidden + visible suite in $work"
bun test
