#!/usr/bin/env bash
# Validate every SKILL.md against the *real* `npx skills` installer.
#
# Why this exists: the installer parses frontmatter with the spec-compliant
# `yaml` npm package and SILENTLY SKIPS any skill whose frontmatter fails to
# parse, surfacing only "No skills found". Claude Code's own loader is far more
# lenient, so a skill can work in-app yet be completely un-installable via
# `npx skills add/update` (we shipped exactly that bug when an umbrella
# description gained an unquoted "Subcommands: '...'" — a bare ': ' inside a
# plain scalar). validate-skills.sh now catches this class offline via a strict
# PyYAML parse; this script is the belt-and-suspenders check that runs the
# actual installer so we catch anything the proxy misses (discovery, structure,
# CLI behaviour changes).
#
# Strategy: point the installer at each skill's own directory in `--list` mode
# (discovery only, never installs) with INSTALL_INTERNAL_SKILLS=1 so even the
# hidden per-command wrappers are exercised, and assert it discovers the skill.
#
# Offline-safe: if the CLI can't be fetched/run at all (no network), this WARNs
# and exits 0 so local runs aren't blocked. CI has network and runs for real.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKILLS_CMD=(npx --yes skills)

strip_ansi() { sed 's/\x1b\[[0-9;]*m//g' | tr -d '\r'; }

# ── Preflight: can we run the installer at all? ──
# Locally a missing CLI (offline) WARNs and skips so dev runs aren't blocked. In
# CI we must NOT silently green this job on an npm/DNS/registry failure — the
# whole point is to exercise the real installer — so hard-fail when $CI is set.
if ! "${SKILLS_CMD[@]}" --version >/dev/null 2>&1; then
  if [[ -n "${CI:-}" ]]; then
    echo "[FAIL] could not run '${SKILLS_CMD[*]}' under CI — the npx skills installer must be reachable for this check"
    exit 1
  fi
  echo "[WARN] could not run '${SKILLS_CMD[*]}' (offline?); skipping npx install validation"
  exit 0
fi

SKILL_FILES=()
while IFS= read -r skill_file; do
  SKILL_FILES+=("$skill_file")
done < <(find . -name SKILL.md -type f -not -path './.git/*' | sort)

if [[ ${#SKILL_FILES[@]} -eq 0 ]]; then
  echo "No SKILL.md files found."
  exit 1
fi

echo "Validating ${#SKILL_FILES[@]} skill(s) against the npx skills installer..."

failed=0
for skill_file in "${SKILL_FILES[@]}"; do
  skill_dir="$(dirname "$skill_file")"
  # Capture the installer's exit STATUS and output separately. Piping straight
  # into strip_ansi would mask the installer status with sed's, so a crashed run
  # that happened to print "Found 1 skill" could false-pass. We require status 0
  # AND a positive "Found N" AND no "No skills found".
  set +e
  raw="$(INSTALL_INTERNAL_SKILLS=1 "${SKILLS_CMD[@]}" add "$skill_dir" --list -y 2>&1)"
  status=$?
  set -e
  out="$(printf '%s' "$raw" | strip_ansi)"

  if [[ $status -ne 0 ]] \
     || grep -qiE 'No skills found' <<<"$out" \
     || ! grep -qiE 'Found [1-9][0-9]* skill' <<<"$out"; then
    echo "  [FAIL] $skill_file: installer did not discover this skill (exit status $status)"
    echo "         → frontmatter likely fails the installer's YAML parse; quote any value containing ': '."
    # Surface the most useful line of installer output for debugging.
    grep -iE 'No skills found|Found [0-9]+ skill|error|invalid' <<<"$out" | head -3 | sed 's/^/         /'
    failed=1
  else
    echo "  [OK]   $skill_file"
  fi
done

if [[ $failed -ne 0 ]]; then
  echo ""
  echo "One or more skills are un-installable via 'npx skills'. See messages above."
  exit 1
fi

echo "All ${#SKILL_FILES[@]} skill(s) are discoverable by the npx skills installer."
