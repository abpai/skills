#!/usr/bin/env bash
# multi-pass-runner.sh — scaffolding for the audit -> fix -> rescan -> verify
# convergence loop from the multi-pass-bug-hunting lens.
#
# Ported and generalized from jeffery-skills/multi-pass-bug-hunting
# (references/TOOLS.md: "Full Pass Sequence" + "Pre-Commit Check").
# The source hardcodes `ubs` (Ultimate Bug Scanner) and cargo/npm; this port
# auto-detects the project's scanner and test runner and degrades gracefully.
#
# This is a SKELETON: it runs the 4 passes and prints what each pass found, but
# the FIX step (pass 1->2) and the FRESH-EYES re-read (pass 2) are human/model
# judgment — the script cannot do them. Re-run after every fix until pass 4 is
# clean (the convergence criteria).
#
# Usage:
#   multi-pass-runner.sh [--base <ref>] [--staged]
#     --base <ref>   compare against <ref> instead of auto-detected base
#     --staged       pre-commit mode: scope = staged files, 1 quick pass
set -u

BASE=""
STAGED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --staged) STAGED=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }

# --- detect base ref (NEW issues only; pre-existing noise must not drown the
#     defects THIS change introduced — the --comparison=baseline idea) ---
detect_base() {
  if [ -n "$BASE" ]; then echo "$BASE"; return; fi
  for ref in origin/HEAD origin/main main; do
    if git rev-parse --verify -q "$ref" >/dev/null 2>&1; then echo "$ref"; return; fi
  done
  echo "HEAD~1"
}

# --- detect the scanner: prefer ubs, else language-native ---
scan_changed() {
  local files="$1"
  if have ubs; then
    echo "+ ubs (changed files)"
    if [ "$STAGED" -eq 1 ]; then
      ubs --staged
    elif [ -n "$files" ]; then
      # scope the scan to the changed files passed in (not the whole tree)
      printf '%s\n' "$files" | xargs ubs
    else
      ubs .
    fi
    return $?
  fi
  # clippy::unwrap_used/expect_used catch panics; eslint no-floating-promises
  # catches the missing-await class; ruff B+S = bugbear+bandit; staticcheck SA*.
  local rc=0
  if [ -f Cargo.toml ] && have cargo; then
    echo "+ cargo clippy -- -W clippy::unwrap_used -W clippy::expect_used -D warnings"
    cargo clippy -- -W clippy::unwrap_used -W clippy::expect_used -D warnings || rc=$?
  fi
  if { [ -f package.json ] || ls ./*.ts >/dev/null 2>&1; } && have npx; then
    echo "+ eslint (no-floating-promises / no-misused-promises)"
    echo "$files" | grep -E '\.(ts|tsx|js|jsx)$' | xargs -r npx eslint --rule '@typescript-eslint/no-floating-promises: error' || rc=$?
  fi
  if have ruff; then echo "+ ruff check --select=E,F,B,S"; ruff check . --select=E,F,B,S || rc=$?; fi
  if have staticcheck; then echo '+ staticcheck -checks=SA* ./...'; staticcheck -checks="SA*" ./... || rc=$?; fi
  if have shellcheck; then echo "+ shellcheck"; echo "$files" | grep -E '\.sh$' | xargs -r shellcheck || rc=$?; fi
  return $rc
}

run_tests() {
  if [ -f Cargo.toml ] && have cargo; then echo "+ cargo test --all"; cargo test --all; return $?; fi
  if [ -f package.json ] && have npm; then echo "+ npm test"; CI=true npm test; return $?; fi
  if have pytest; then echo "+ pytest -v"; pytest -v; return $?; fi
  echo "no test runner detected — name the manual verification instead"; return 0
}

BASE_REF="$(detect_base)"
echo "=== multi-pass-runner  base=$BASE_REF  staged=$STAGED ==="

if [ "$STAGED" -eq 1 ]; then
  CHANGED="$(git diff --cached --name-only)"
else
  CHANGED="$(git diff --name-only "$BASE_REF"...HEAD; git diff --name-only; git ls-files --others --exclude-standard)"
fi
CHANGED="$(printf '%s\n' "$CHANGED" | sort -u | sed '/^$/d')"
echo "changed files:"; printf '%s\n' "$CHANGED"

echo; echo "=== PASS 1: surface scan (null deref / missing-await / leak / injection) ==="
scan_changed "$CHANGED"; P1=$?
echo "pass1 scanner exit: $P1  -> triage each finding (real / FP / missing-test), FIX real bugs, then re-run this script"

if [ "$STAGED" -eq 1 ]; then
  echo; echo "=== staged mode: 1 pass only. Stop when scanner exits 0. ==="
  exit $P1
fi

echo; echo "=== PASS 2: fresh-eyes re-read (manual — script lists the files) ==="
echo "re-read EACH of these with fresh eyes; grep the repo for any bug you find:"
printf '%s\n' "$CHANGED"

echo; echo "=== PASS 3: integration — tests + holistic diff ==="
run_tests; P3=$?
echo "+ git diff $BASE_REF...HEAD | head -200  (review holistically for regressions / shared-state mutation / races)"

echo; echo "=== PASS 4: final verification scan (must be clean) ==="
if have ubs; then ubs . --fail-on-warning; P4=$?; else scan_changed "$CHANGED"; P4=$?; fi

echo
echo "=== CONVERGENCE CHECK (stop only when ALL true) ==="
echo "[ $([ "$P4" -eq 0 ] && echo x || echo ' ') ] final scan exits 0   (got $P4)"
echo "[ $([ "$P3" -eq 0 ] && echo x || echo ' ') ] all tests pass        (got $P3)"
echo "[ ] no new findings on fresh re-read   (you assert)"
echo "[ ] no deferred items remaining        (you assert)"
[ "$P4" -eq 0 ] && [ "$P3" -eq 0 ] || { echo "NOT converged — fix, then re-run."; exit 1; }
echo "scanner+tests clean. Confirm the two manual criteria, or loop back to pass 1."
