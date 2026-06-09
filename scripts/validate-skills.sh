#!/usr/bin/env bash
set -euo pipefail

# Structural + content validation lives in scripts/validate_skills.py. Shared
# version-source metadata lives in scripts/skill-metadata.ts and is reused by
# validation, generation, manifest sync, and CI. This wrapper runs those checks,
# then layers on toolchain checks that genuinely need external tools (bun
# build/test, bash -n, py_compile, bun build for TS), and prints the final
# pass/fail verdict.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failed=0

if ! command -v bun >/dev/null 2>&1; then
  echo "[FAIL] scripts/validate-skills.sh: bun is required to validate skill metadata and TypeScript helpers; install bun or skip this gate"
  exit 1
fi

# ── Plugin / skill / agent / marketplace / versions validation (Python) ──
# Passes through flags (e.g. --skip-versions) verbatim.
if ! python3 scripts/validate_skills.py "$@"; then
  failed=1
fi

# ── Validate shared metadata tooling ──

metadata_test="scripts/skill-metadata.test.ts"
if [[ -f "$metadata_test" ]]; then
  if bun test "$metadata_test" >/tmp/skills-validate-metadata-test.log 2>&1; then
    echo "  [OK] $metadata_test (bun test)"
    rm -f /tmp/skills-validate-metadata-test.log
  else
    echo "[FAIL] $metadata_test: bun test failed"
    cat /tmp/skills-validate-metadata-test.log
    rm -f /tmp/skills-validate-metadata-test.log
    failed=1
  fi
fi

# ── Validate bundled TypeScript helpers ──

finish_lane_script="code/skills/code/scripts/finish-lane.ts"
if [[ -f "$finish_lane_script" ]]; then
  if bun build "$finish_lane_script" --target=bun --outfile /tmp/skills-validate-finish-lane.js >/tmp/skills-validate-finish-lane.log 2>&1; then
    echo "  [OK] $finish_lane_script (bun build)"
    rm -f /tmp/skills-validate-finish-lane.js /tmp/skills-validate-finish-lane.log
  else
    echo "[FAIL] $finish_lane_script: bun build failed"
    cat /tmp/skills-validate-finish-lane.log
    rm -f /tmp/skills-validate-finish-lane.js /tmp/skills-validate-finish-lane.log
    failed=1
  fi

  finish_lane_test="code/skills/code/scripts/finish-lane.test.ts"
  if [[ -f "$finish_lane_test" ]]; then
    # finish-lane tests spawn temp git repos and subprocesses. Bun's default
    # 5s per-test timeout is tight on busy local/CI runners, so give this
    # subprocess-heavy suite enough room while keeping a finite guardrail.
    if bun test --timeout=30000 "$finish_lane_test" >/tmp/skills-validate-finish-lane-test.log 2>&1; then
      echo "  [OK] $finish_lane_test (bun test)"
      rm -f /tmp/skills-validate-finish-lane-test.log
    else
      echo "[FAIL] $finish_lane_test: bun test failed"
      cat /tmp/skills-validate-finish-lane-test.log
      rm -f /tmp/skills-validate-finish-lane-test.log
      failed=1
    fi
  fi
fi

# ── Syntax-check other shipped helper scripts (Finding 14) ──
#
# Low-cost syntax/parse checks across all shipped helpers, each guarded by a
# tool-availability check so a missing tool degrades gracefully (mirrors the
# `command -v bun` guard above) instead of failing the run. Helpers are
# discovered generically under each plugin's skills/ and hooks/ dirs plus the
# repo's own scripts/, excluding finish-lane.* (already built/tested above) and
# this validator itself.

# Shell helpers: `bash -n` parse check.
SHELL_HELPERS=()
while IFS= read -r f; do
  SHELL_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o -name '*.sh' -type f -print \
         | grep -vE '/scripts/validate-skills\.sh$' | sort)
if [[ ${#SHELL_HELPERS[@]} -gt 0 ]]; then
  if ! command -v bash >/dev/null 2>&1; then
    echo "  [SKIP] shell helper syntax checks (bash not found)"
  else
    for sh_file in "${SHELL_HELPERS[@]}"; do
      if ! bash -n "$sh_file" >/tmp/skills-validate-sh.log 2>&1; then
        echo "[FAIL] $sh_file: bash -n syntax check failed"
        cat /tmp/skills-validate-sh.log
        failed=1
      fi
    done
    rm -f /tmp/skills-validate-sh.log
    echo "  [OK] shell helper syntax (${#SHELL_HELPERS[@]} scripts, bash -n)"
  fi
fi

# Python helpers: `python3 -m py_compile` parse check. Includes this validator's
# own scripts/ module so a syntax error there is caught even when the run above
# happened to short-circuit early.
PY_HELPERS=()
while IFS= read -r f; do
  PY_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o \
           -path '*/__pycache__/*' -prune -o \
           -path './.ruff_cache/*' -prune -o \
           -path './.understand/*' -prune -o \
           -path './.workflow/*' -prune -o \
           -name '*.py' -type f -print | sort)
if [[ ${#PY_HELPERS[@]} -gt 0 ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "  [SKIP] python helper syntax checks (python3 not found)"
  else
    if python3 -m py_compile "${PY_HELPERS[@]}" >/tmp/skills-validate-py.log 2>&1; then
      echo "  [OK] python helper syntax (${#PY_HELPERS[@]} scripts, py_compile)"
    else
      echo "[FAIL] python helper py_compile failed"
      cat /tmp/skills-validate-py.log
      failed=1
    fi
    rm -f /tmp/skills-validate-py.log
  fi
fi

# Other TypeScript helpers: `bun build --target=bun` to a temp outfile. Skips
# finish-lane.ts (built above) and *.test.ts files (exercised via `bun test`).
TS_HELPERS=()
while IFS= read -r f; do
  TS_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o -name '*.ts' -type f -print \
         | grep -vE '/finish-lane(\.test)?\.ts$' \
         | grep -vE '\.test\.ts$' | sort)
if [[ ${#TS_HELPERS[@]} -gt 0 ]]; then
  for ts_file in "${TS_HELPERS[@]}"; do
    if bun build "$ts_file" --target=bun --outfile /tmp/skills-validate-ts.js >/tmp/skills-validate-ts.log 2>&1; then
      rm -f /tmp/skills-validate-ts.js
    else
      echo "[FAIL] $ts_file: bun build failed"
      cat /tmp/skills-validate-ts.log
      failed=1
    fi
  done
  rm -f /tmp/skills-validate-ts.js /tmp/skills-validate-ts.log
  echo "  [OK] other TypeScript helper builds (${#TS_HELPERS[@]} scripts, bun build)"
fi

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Validation passed."
