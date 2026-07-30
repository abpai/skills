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

# --skip-versions is the bun-free structural contract: it skips every
# version-derived surface (Python: versions.json + docs cards) AND, here, the
# bun-dependent toolchain blocks below (metadata test, finish-lane build/test,
# TS helper builds). With bun present we still run everything. Without bun and
# WITHOUT --skip-versions we hard-fail, because a silent partial run would read
# as a full pass.
skip_versions=0
for arg in "$@"; do
  [[ "$arg" == "--skip-versions" ]] && skip_versions=1
done

have_bun=1
if ! command -v bun >/dev/null 2>&1; then
  have_bun=0
  if [[ "$skip_versions" -ne 1 ]]; then
    echo "[FAIL] scripts/validate-skills.sh: bun is required to validate skill metadata and TypeScript helpers; install bun, or pass --skip-versions for a bun-free structural-only run"
    exit 1
  fi
  echo "  [SKIP] bun toolchain checks (bun not found; --skip-versions bun-free run: skipping metadata test, finish-lane build/test, and TS helper builds)"
fi

# ── Plugin / skill / agent / marketplace / versions validation (Python) ──
# Passes through flags (e.g. --skip-versions) verbatim.
if ! python3 scripts/validate_skills.py "$@"; then
  failed=1
fi

validator_test="scripts/validate_skills.test.py"
if [[ -f "$validator_test" ]]; then
  if python3 "$validator_test" >/tmp/skills-validate-validator-test.log 2>&1; then
    echo "  [OK] $validator_test (python unittest)"
    rm -f /tmp/skills-validate-validator-test.log
  else
    echo "[FAIL] $validator_test: python unittest failed"
    cat /tmp/skills-validate-validator-test.log
    rm -f /tmp/skills-validate-validator-test.log
    failed=1
  fi
fi

claude_runner_test="scripts/test-claude-runner.sh"
if [[ -f "$claude_runner_test" ]]; then
  if bash "$claude_runner_test" >/tmp/skills-validate-claude-runner-test.log 2>&1; then
    echo "  [OK] $claude_runner_test (fake Claude preflight regression)"
    rm -f /tmp/skills-validate-claude-runner-test.log
  else
    echo "[FAIL] $claude_runner_test: regression test failed"
    cat /tmp/skills-validate-claude-runner-test.log
    rm -f /tmp/skills-validate-claude-runner-test.log
    failed=1
  fi
fi

# ── Validate shared metadata tooling ──

metadata_test="scripts/skill-metadata.test.ts"
if [[ "$have_bun" -eq 1 && -f "$metadata_test" ]]; then
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
if [[ "$have_bun" -eq 1 && -f "$finish_lane_script" ]]; then
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
done < <(find . -path ./.git -prune -o \
           -path '*/node_modules/*' -prune -o \
           -path './evals/eve/*' -prune -o \
           -path '*/__pycache__/*' -prune -o \
           -path './.ruff_cache/*' -prune -o \
           -path './.understand/*' -prune -o \
           -path './.workflow/*' -prune -o \
           -name '*.sh' -type f -print \
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
           -path '*/node_modules/*' -prune -o \
           -path './evals/eve/*' -prune -o \
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
# Also skips evals/eve/: a self-contained Eve sub-project (marketplace-internal
# eval infra, NOT a published plugin) with external npm deps this gate never
# installs — its own harness-smoke CI job typechecks it against the real Eve
# types, which is strictly stronger than a bun build here.
TS_HELPERS=()
while IFS= read -r f; do
  TS_HELPERS+=("$f")
done < <(find . -path ./.git -prune -o \
           -path '*/node_modules/*' -prune -o \
           -path './evals/eve/*' -prune -o \
           -path '*/__pycache__/*' -prune -o \
           -path './.ruff_cache/*' -prune -o \
           -path './.understand/*' -prune -o \
           -path './.workflow/*' -prune -o \
           -name '*.ts' -type f -print \
         | grep -vE '/finish-lane(\.test)?\.ts$' \
         | grep -vE '\.test\.ts$' | sort)
if [[ "$have_bun" -eq 1 && ${#TS_HELPERS[@]} -gt 0 ]]; then
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

# ── Codex output schemas: OpenAI strict-mode compliance ──
#
# codex-exec ships JSON schemas used as `codex exec --output-schema`. OpenAI's
# Structured Outputs strict mode requires that every object's `required` array
# list *every* key in its `properties` (optional fields are expressed with a
# nullable type, not by omission from `required`). A schema that violates this
# fails ~5s into every run with `invalid_json_schema` — a class of regression
# that shipped once (the default candidate-report schema left `notes` out of
# `required`) because the dry-run test path never calls the API. Guard it.
CODEX_SCHEMAS=()
while IFS= read -r f; do
  CODEX_SCHEMAS+=("$f")
done < <(find codex-exec -name '*.schema.json' -type f 2>/dev/null | sort)
if [[ ${#CODEX_SCHEMAS[@]} -gt 0 ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "  [SKIP] codex output schema strict-mode check (python3 not found)"
  elif python3 scripts/check_strict_schema.py "${CODEX_SCHEMAS[@]}"; then
    echo "  [OK] codex output schemas strict-mode (${#CODEX_SCHEMAS[@]} files)"
  else
    failed=1
  fi
fi

# ── Mirrored interface contracts: plugin-root ↔ installed-skill copy ──
#
# Some plugins ship an INTERFACES.md at the plugin root (for source-checkout
# readers) AND mirror it into skills/<name>/ so installed skills can read it via
# a sibling `./INTERFACES.md` path (the plugin root is not copied into the
# runtime skill cache). The two copies MUST stay byte-identical, but the
# SKILL.md-only validators above never discover a loose support file, so a
# future edit to one copy would silently drift. Enforce parity here.
MIRRORED_IFACES=()
while IFS= read -r f; do
  MIRRORED_IFACES+=("$f")
done < <(find . -path ./.git -prune -o \
           -path '*/node_modules/*' -prune -o \
           -path './evals/eve/*' -prune -o \
           -path '*/__pycache__/*' -prune -o \
           -path '*/skills/*/INTERFACES.md' -type f -print | sort)
for skill_iface in "${MIRRORED_IFACES[@]}"; do
  # ./<plugin>/skills/<name>/INTERFACES.md → ./<plugin>/INTERFACES.md
  plugin_root="${skill_iface%/skills/*}"
  root_iface="$plugin_root/INTERFACES.md"
  [[ -f "$root_iface" ]] || continue
  if cmp -s "$root_iface" "$skill_iface"; then
    echo "  [OK] mirrored interface contract in sync ($skill_iface == $root_iface)"
  else
    echo "[FAIL] $skill_iface drifted from its plugin-root mirror $root_iface (must be byte-identical)"
    failed=1
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "Validation failed."
  exit 1
fi

echo "Validation passed."
