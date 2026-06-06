#!/usr/bin/env bash
# golden-scrub-check.sh — flag un-neutralized nondeterminism in golden/snapshot files.
#
# Ports the SCRUBBERS.md scrub catalog + canonicalize() as a review-time grep:
# scans the golden/snapshot files a PR adds or changes and reports any RAW
# dynamic value (UUID, ISO + Unix timestamp, duration, memory address, abs/home/
# tmp path, port, PID) that should have been scrubbed to a [PLACEHOLDER] before
# the artifact was frozen. A raw hit = leaked nondeterminism = future test rot.
#
# Usage:
#   golden-scrub-check.sh <file> [<file> ...]
#   git diff --name-only --diff-filter=AM <base>...HEAD \
#     | grep -E '\.(snap|snap\.new|golden|approved|received|ambr)$|/(__snapshots__|snapshots|golden|goldenfiles)/' \
#     | xargs -r golden-scrub-check.sh
#
# Exit: 0 = no raw dynamic values found; 1 = leaks found (printed file:line:pattern).
# Whitelisted: anything already inside [...]/<...> placeholder brackets on the line.

set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: golden-scrub-check.sh <golden-or-snapshot-file> ..." >&2
  exit 2
fi

# pattern-name | ERE. Each is a class that MUST be scrubbed in a stable golden.
patterns=(
  'UUID|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  'ISO_TIMESTAMP|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
  'UNIX_TS|(^|[^0-9])1[6-9][0-9]{8}([^0-9]|$)'
  'DURATION|[0-9]+(\.[0-9]+)?[ ]*(ms|us|µs|ns|sec|min)\b'
  'MEM_ADDR|0x[0-9a-fA-F]{6,16}'
  'HOME_PATH|/(Users|home)/[A-Za-z0-9_.-]+/'
  'TMP_PATH|/tmp/[A-Za-z0-9._-]+'
  'PORT|localhost:[0-9]{4,5}'
  'PID|pid[=: ][0-9]+'
)

found=0
for f in "$@"; do
  [ -f "$f" ] || continue
  while IFS= read -r entry; do
    name="${entry%%|*}"
    re="${entry#*|}"
    # Report only lines NOT already masked by a placeholder bracket for this class.
    grep -nE "$re" "$f" 2>/dev/null | grep -vE '\[[A-Z_]+\]|<[a-z_]+>|\[redacted\]|\[uuid\]|\[timestamp\]' \
      | while IFS= read -r hit; do
          echo "$f: RAW $name -> ${hit}"
          # signal via marker file since the pipe runs in a subshell
          echo x >> "${TMPDIR:-/tmp}/.golden_scrub_hits.$$"
        done
  done < <(printf '%s\n' "${patterns[@]}")
done

if [ -f "${TMPDIR:-/tmp}/.golden_scrub_hits.$$" ]; then
  rm -f "${TMPDIR:-/tmp}/.golden_scrub_hits.$$"
  found=1
fi

if [ "$found" -eq 0 ]; then
  echo "golden-scrub-check: no raw dynamic values found (all scrubbed or none present)."
fi
exit "$found"
