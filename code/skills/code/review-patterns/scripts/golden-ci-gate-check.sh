#!/usr/bin/env bash
# golden-ci-gate-check.sh — verify the golden/snapshot CI gate is COMPARE-ONLY.
#
# Ports CI-GOLDENS.md "Iron Rule": CI must never write goldens; it compares and
# fails. This checks two failure modes a reviewer must catch on a golden PR:
#   1. PENDING-UPDATE RESIDUE: any *.snap.new or *.actual file committed/present
#      in the tree is an unreviewed pending update — the gate is leaking.
#   2. AUTO-UPDATE GATE HOLE: CI workflow runs goldens WITHOUT the strict env var
#      (INSTA_UPDATE=no, or UPDATE_GOLDENS/UPDATE_SNAPSHOTS/REGENERATE_GOLDENFILES
#      left set), so CI would silently rewrite goldens instead of failing.
#
# Usage:  golden-ci-gate-check.sh [repo-root]   (defaults to cwd)
# Exit:   0 = gate looks compare-only; 1 = residue or auto-update hole found.

set -uo pipefail
root="${1:-.}"
cd "$root" || { echo "cannot cd to $root" >&2; exit 2; }

fail=0

# 1. Pending-update residue (the concrete signal a seal must catch).
residue=$(find . \( -name '*.snap.new' -o -name '*.actual' -o -name '*.received.*' \) \
  -not -path './.git/*' 2>/dev/null)
if [ -n "$residue" ]; then
  echo "RESIDUE: pending golden updates present (unreviewed) — must be reviewed + removed before merge:"
  echo "$residue" | sed 's/^/  /'
  fail=1
fi

# 2. CI workflow auto-update hole.
wf_dir=".github/workflows"
if [ -d "$wf_dir" ]; then
  # Files that run goldens/snapshots.
  runs=$(grep -rliE 'insta|UPDATE_GOLDENS|UPDATE_SNAPSHOTS|snapshot|golden|cargo test|vitest|jest' "$wf_dir" 2>/dev/null)
  for wf in $runs; do
    # Dangerous: an update/accept env or flag set in a CI workflow.
    if grep -nEi 'INSTA_UPDATE:[[:space:]]*"?(always|auto|new|unseen)"?|UPDATE_GOLDENS:[[:space:]]*"?1"?|UPDATE_SNAPSHOTS:[[:space:]]*"?(true|1)"?|REGENERATE_GOLDENFILES|--accept-unseen|insta accept|-u\b|--update-snapshots' "$wf" >/dev/null 2>&1; then
      echo "AUTO-UPDATE HOLE: $wf runs goldens in a writable/accept mode (CI must be INSTA_UPDATE=no / compare-only):"
      grep -nEi 'INSTA_UPDATE|UPDATE_GOLDENS|UPDATE_SNAPSHOTS|REGENERATE_GOLDENFILES|accept-unseen|insta accept|update-snapshots|-u\b' "$wf" | sed 's/^/  /'
      fail=1
    fi
  done
fi

if [ "$fail" -eq 0 ]; then
  echo "golden-ci-gate-check: no residue, no auto-update hole detected (compare-only gate looks intact)."
fi
exit "$fail"
