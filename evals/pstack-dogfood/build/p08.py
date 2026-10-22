import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("p08-mirror-sync")
base = {}
base[".gitignore"] = "/tmp/\n"
base["README.md"] = r'''
# mirror-sync

Keeps local copies of the upstream package mirrors listed in `mirrors.txt`.
Production runs nightly from cron on the mirror host:

```sh
MIRROR_SOURCE=mirror@upstream.example:/srv/mirrors \
MIRROR_DEST=/data/mirrors \
MIRROR_FETCH="rsync -a --delete -e ssh" \
  bin/mirror-sync --jobs 4
```

Some mirrors are large (the biggest is ~40 GB). `MIRROR_DEST/state.json`
records when each mirror last synced; `bin/mirror-status` prints it and the
monitoring check reads it.

Requires bash and jq. `tests/smoke.sh` runs everything against local
directories (`MIRROR_FETCH` defaults to `cp -R`).
'''
base["mirrors.txt"] = r'''
# one mirror per line
alpine
debian-security
pypi-wheels
crates
npm-scoped
ubuntu-ports
'''
base["bin/mirror-sync"] = r'''
#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: mirror-sync [--jobs N] [--list FILE]" >&2
  exit 2
}

jobs=1
list="${MIRROR_LIST:-mirrors.txt}"
while [ $# -gt 0 ]; do
  case "$1" in
    --jobs) jobs="${2:?}"; shift 2 ;;
    --list) list="${2:?}"; shift 2 ;;
    *) usage ;;
  esac
done

: "${MIRROR_SOURCE:?set MIRROR_SOURCE}"
: "${MIRROR_DEST:?set MIRROR_DEST}"
command -v jq >/dev/null || { echo "mirror-sync: jq is required" >&2; exit 1; }

here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$MIRROR_DEST"
[ -s "$MIRROR_DEST/state.json" ] || echo '{}' >"$MIRROR_DEST/state.json"

grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$list" |
  xargs -P "$jobs" -n 1 "$here/mirror-sync-one"

echo "mirror-sync: $(jq 'length' "$MIRROR_DEST/state.json") mirrors recorded"
'''
base["bin/mirror-sync-one"] = r'''
#!/usr/bin/env bash
set -euo pipefail

name="$1"
src="$MIRROR_SOURCE/$name"
dest="$MIRROR_DEST/$name"
state="$MIRROR_DEST/state.json"
fetch="${MIRROR_FETCH:-cp -R}"

echo "mirror-sync: $name"
rm -rf "$dest"
$fetch "$src" "$dest"

files=$(find "$dest" -type f | wc -l | tr -d ' ')
synced_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq --arg n "$name" --arg t "$synced_at" --argjson f "$files" \
  '.[$n] = {synced_at: $t, files: $f}' "$state" >"$state.tmp"
mv "$state.tmp" "$state"
'''
base["bin/mirror-status"] = r'''
#!/usr/bin/env bash
set -euo pipefail
: "${MIRROR_DEST:?set MIRROR_DEST}"
jq -r 'to_entries | sort_by(.key)[] | "\(.key)\t\(.value.synced_at)\t\(.value.files) files"' \
  "$MIRROR_DEST/state.json"
'''
base["tests/smoke.sh"] = r'''
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/src"
for m in alpine crates pypi-wheels; do
  mkdir -p "$work/src/$m/pool"
  for i in 1 2 3; do echo "$m package $i" >"$work/src/$m/pool/pkg-$i.tar"; done
done
printf 'alpine\ncrates\npypi-wheels\n' >"$work/mirrors.txt"

MIRROR_SOURCE="$work/src" MIRROR_DEST="$work/dest" \
  "$root/bin/mirror-sync" --list "$work/mirrors.txt"

count=$(jq 'length' "$work/dest/state.json")
[ "$count" = 3 ] || { echo "expected 3 mirrors in state.json, got $count" >&2; exit 1; }
diff -r "$work/src/crates" "$work/dest/crates"
MIRROR_DEST="$work/dest" "$root/bin/mirror-status"
echo "smoke: ok"
'''
write_tree(root, base)
commit(root)
