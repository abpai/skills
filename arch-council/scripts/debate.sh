#!/usr/bin/env bash
# Orchestrate a structured architecture debate between Claude and Codex.
# Claude proposes, Codex critiques, Claude synthesizes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="${SCRIPT_DIR}/../prompts"

# Defaults.
question=""
repos=""
rounds=1
claude_timeout=600
codex_timeout=480
context_file=""
output_dir=""
claude_model="opus"
codex_model="gpt-5.4"
dry_run=false
MONITOR_PIDS=()

usage() {
  cat <<'USAGE'
Usage:
  debate.sh [options]

Options:
  --question "..."           Architecture question (required)
  --repos "dir1,dir2,..."   Comma-separated repo paths (required)
  --rounds N                 Debate rounds (default: 1, max: 3)
  --claude-timeout N         Seconds for Claude calls (default: 600)
  --codex-timeout N          Seconds for Codex calls (default: 480)
  --context-file PATH        Skip context build, use pre-built file
  --output-dir DIR           Output directory (default: /tmp/arch-council-<ts>)
  --claude-model MODEL       Claude model (default: opus)
  --codex-model MODEL        Codex model (default: gpt-5.4)
  --dry-run                  Show planned commands without executing
  --help                     Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --question)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --question requires a value" >&2; exit 2; }
      question="$1"
      ;;
    --repos)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --repos requires a value" >&2; exit 2; }
      repos="$1"
      ;;
    --rounds)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --rounds requires a value" >&2; exit 2; }
      [[ "$1" =~ ^[1-3]$ ]] || { echo "Error: --rounds must be 1, 2, or 3" >&2; exit 2; }
      rounds="$1"
      ;;
    --claude-timeout)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --claude-timeout requires a value" >&2; exit 2; }
      [[ "$1" =~ ^[1-9][0-9]*$ ]] || { echo "Error: --claude-timeout must be a positive integer" >&2; exit 2; }
      claude_timeout="$1"
      ;;
    --codex-timeout)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --codex-timeout requires a value" >&2; exit 2; }
      [[ "$1" =~ ^[1-9][0-9]*$ ]] || { echo "Error: --codex-timeout must be a positive integer" >&2; exit 2; }
      codex_timeout="$1"
      ;;
    --context-file)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --context-file requires a value" >&2; exit 2; }
      context_file="$1"
      ;;
    --output-dir)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --output-dir requires a value" >&2; exit 2; }
      output_dir="$1"
      ;;
    --claude-model)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --claude-model requires a value" >&2; exit 2; }
      claude_model="$1"
      ;;
    --codex-model)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --codex-model requires a value" >&2; exit 2; }
      codex_model="$1"
      ;;
    --dry-run)
      dry_run=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

# Validate required arguments.
[[ -n "${question}" ]] || { echo "Error: --question is required" >&2; exit 2; }
if [[ -z "${context_file}" && -z "${repos}" ]]; then
  echo "Error: --repos is required unless --context-file is provided" >&2
  exit 2
fi

# Validate required binaries for live runs only.
if [[ "${dry_run}" != true ]]; then
  command -v claude >/dev/null 2>&1 || { echo "Error: claude CLI is required (install: npm i -g @anthropic-ai/claude-code)" >&2; exit 1; }
  command -v codex >/dev/null 2>&1 || { echo "Error: codex CLI is required (install: npm i -g @openai/codex)" >&2; exit 1; }
fi

# Set up output directory.
if [[ -z "${output_dir}" ]]; then
  output_dir="/tmp/arch-council-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "${output_dir}"

echo "=== Architecture Council ==="
echo "Question: ${question}"
echo "Repos: ${repos}"
echo "Rounds: ${rounds}"
echo "Output: ${output_dir}"
echo ""

# ── Timeout wrapper ──────────────────────────────────────────────────
run_with_timeout() {
  local secs="$1"; local label="$2"; shift 2
  if command -v timeout >/dev/null 2>&1; then
    timeout --signal=TERM --kill-after=30 "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout --signal=TERM --kill-after=30 "$secs" "$@"
  else
    # Fallback: background process + watchdog.
    "$@" & local pid=$!
    ( sleep "$secs" && kill -TERM "$pid" 2>/dev/null ) & local wd=$!
    wait "$pid" 2>/dev/null; local rc=$?
    kill "$wd" 2>/dev/null; wait "$wd" 2>/dev/null
    return $rc
  fi
}

# ── Progress monitor ─────────────────────────────────────────────────
# Returns PID. Caller must call stop_monitor PID to clean up.
# Keep a list of active monitors so we can clean up if the script exits early.
monitor_file() {
  local file="$1" label="$2"
  # Keep a single monitor pipeline for progress output.
  ( exec tail -f "$file" 2>/dev/null | sed "s/^/[${label}] /" ) &
  local pid=$!
  MONITOR_PIDS+=("$pid")
  echo "$pid"
}

stop_monitor() {
  local pid="$1"
  if [[ -z "${pid}" ]]; then
    return 0
  fi

  kill "$pid" 2>/dev/null
  # Also kill child processes (tail).
  pkill -P "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null || true

  local remaining=()
  local tracked
  for tracked in "${MONITOR_PIDS[@]}"; do
    if [[ "${tracked}" != "${pid}" ]]; then
      remaining+=("${tracked}")
    fi
  done
  MONITOR_PIDS=("${remaining[@]}")
}

cleanup_monitors() {
  local pid
  for pid in "${MONITOR_PIDS[@]}"; do
    stop_monitor "${pid}"
  done
}

trap cleanup_monitors EXIT INT TERM HUP

# ── Build prompt from template ───────────────────────────────────────
build_prompt() {
  local template="$1"
  shift
  # Read template and append variable sections.
  local prompt
  prompt="$(cat "${template}")"
  while [[ $# -ge 2 ]]; do
    local header="$1" content="$2"
    shift 2
    prompt="${prompt}

## ${header}

${content}"
  done
  echo "${prompt}"
}

# ── Run agent with retry on empty output ─────────────────────────────
run_claude() {
  local timeout_secs="$1" prompt_file="$2" output_file="$3" label="$4"

  echo "Running ${label}..."

  if [[ "${dry_run}" == true ]]; then
    printf '[dry-run] Would run: claude -p --model %s --effort high --permission-mode plan --no-session-persistence < %s\n' \
      "${claude_model}" "${prompt_file}"
    return 0
  fi

  touch "${output_file}"
  local mon_pid
  mon_pid="$(monitor_file "${output_file}" "${label}")"

  local rc=0
  run_with_timeout "${timeout_secs}" "${label}" \
    claude -p --model "${claude_model}" --effort high \
      --permission-mode plan --no-session-persistence \
      < "${prompt_file}" \
    > "${output_file}" 2>/dev/null || rc=$?

  stop_monitor "${mon_pid}"

  if [[ $rc -eq 124 ]]; then
    echo "Warning: ${label} timed out after ${timeout_secs}s" >&2
    if [[ -s "${output_file}" ]]; then
      echo "  Continuing with partial output." >&2
    else
      echo "  No output captured." >&2
      return 1
    fi
  elif [[ $rc -ne 0 ]]; then
    echo "Warning: ${label} exited with code ${rc}" >&2
  fi

  # Retry once if output is empty.
  if [[ ! -s "${output_file}" ]]; then
    echo "  Empty output — retrying ${label}..." >&2
    rc=0
    run_with_timeout "${timeout_secs}" "${label}-retry" \
      claude -p --model "${claude_model}" --effort high \
        --permission-mode plan --no-session-persistence \
        < "${prompt_file}" \
      > "${output_file}" || rc=$?
    if [[ ! -s "${output_file}" ]]; then
      echo "Error: ${label} produced no output after retry" >&2
      return 1
    fi
  fi
}

run_codex() {
  local timeout_secs="$1" prompt_file="$2" output_file="$3" label="$4"

  echo "Running ${label}..."

  if [[ "${dry_run}" == true ]]; then
    printf '[dry-run] Would run: codex exec --skip-git-repo-check --model %s --config model_reasoning_effort="high" --sandbox read-only - < %s 2>/dev/null\n' \
      "${codex_model}" "${prompt_file}"
    return 0
  fi

  touch "${output_file}"
  local mon_pid
  mon_pid="$(monitor_file "${output_file}" "${label}")"

  local rc=0
  run_with_timeout "${timeout_secs}" "${label}" \
    codex exec --skip-git-repo-check \
      --model "${codex_model}" \
      --config model_reasoning_effort="high" \
      --sandbox read-only \
      - < "${prompt_file}" \
    > "${output_file}" 2>/dev/null || rc=$?

  stop_monitor "${mon_pid}"

  if [[ $rc -eq 124 ]]; then
    echo "Warning: ${label} timed out after ${timeout_secs}s" >&2
    if [[ -s "${output_file}" ]]; then
      echo "  Continuing with partial output." >&2
    else
      echo "  No output captured." >&2
      return 1
    fi
  elif [[ $rc -ne 0 ]]; then
    echo "Warning: ${label} exited with code ${rc}" >&2
  fi

  # Retry once if output is empty (without suppressing stderr).
  if [[ ! -s "${output_file}" ]]; then
    echo "  Empty output — retrying ${label} (with stderr)..." >&2
    rc=0
    run_with_timeout "${timeout_secs}" "${label}-retry" \
      codex exec --skip-git-repo-check \
        --model "${codex_model}" \
        --config model_reasoning_effort="high" \
        --sandbox read-only \
        - < "${prompt_file}" \
      > "${output_file}" || rc=$?
    if [[ ! -s "${output_file}" ]]; then
      echo "Error: ${label} produced no output after retry" >&2
      return 1
    fi
  fi
}

# ── Step 1: Build context ────────────────────────────────────────────
if [[ -n "${context_file}" ]]; then
  if [[ ! -f "${context_file}" ]]; then
    echo "Error: context file not found: ${context_file}" >&2
    exit 1
  fi
  cp "${context_file}" "${output_dir}/context.md"
  echo "Using pre-built context: ${context_file}"
else
  echo "Building context pack..."
  if [[ "${dry_run}" == true ]]; then
    echo "[dry-run] Would run: bash ${SCRIPT_DIR}/build-context.sh --repos \"${repos}\" --output \"${output_dir}/context.md\""
  else
    bash "${SCRIPT_DIR}/build-context.sh" --repos "${repos}" --output "${output_dir}/context.md"
  fi
fi
echo ""

context="$(cat "${output_dir}/context.md" 2>/dev/null || echo "(context not yet built — dry run)")"

# ── Step 2: Run debate rounds ────────────────────────────────────────
for ((r=1; r<=rounds; r++)); do
  echo "━━━ Round ${r}/${rounds} ━━━"
  echo ""

  # Build propose prompt.
  if [[ $r -eq 1 ]]; then
    build_prompt "${PROMPTS_DIR}/propose.md" \
      "Architecture Question" "${question}" \
      "Codebase Context" "${context}" \
      > "${output_dir}/round${r}_propose_prompt.txt"
  else
    prev=$((r - 1))
    prev_synthesis="$(cat "${output_dir}/round${prev}_synthesis.md" 2>/dev/null || echo "(previous synthesis — dry run)")"
    build_prompt "${PROMPTS_DIR}/propose.md" \
      "Architecture Question" "${question}" \
      "Codebase Context" "${context}" \
      "Previous Round Synthesis (refine this)" "${prev_synthesis}" \
      > "${output_dir}/round${r}_propose_prompt.txt"
  fi

  # Claude proposes.
  run_claude "${claude_timeout}" \
    "${output_dir}/round${r}_propose_prompt.txt" \
    "${output_dir}/round${r}_proposal.md" \
    "round-${r}-propose" || {
      echo "Error: proposal step failed in round ${r}" >&2
      exit 1
    }
  echo ""

  # Build critique prompt.
  proposal="$(cat "${output_dir}/round${r}_proposal.md" 2>/dev/null || echo "(proposal — dry run)")"
  build_prompt "${PROMPTS_DIR}/critique.md" \
    "Architecture Question" "${question}" \
    "Codebase Context" "${context}" \
    "Proposal Under Review" "${proposal}" \
    > "${output_dir}/round${r}_critique_prompt.txt"

  # Codex critiques.
  run_codex "${codex_timeout}" \
    "${output_dir}/round${r}_critique_prompt.txt" \
    "${output_dir}/round${r}_critique.md" \
    "round-${r}-critique" || {
      echo "Error: critique step failed in round ${r}" >&2
      exit 1
    }
  echo ""

  # Build synthesize prompt.
  critique="$(cat "${output_dir}/round${r}_critique.md" 2>/dev/null || echo "(critique — dry run)")"
  build_prompt "${PROMPTS_DIR}/synthesize.md" \
    "Architecture Question" "${question}" \
    "Codebase Context" "${context}" \
    "Proposal" "${proposal}" \
    "Critique" "${critique}" \
    > "${output_dir}/round${r}_synthesize_prompt.txt"

  # Claude synthesizes.
  run_claude "${claude_timeout}" \
    "${output_dir}/round${r}_synthesize_prompt.txt" \
    "${output_dir}/round${r}_synthesis.md" \
    "round-${r}-synthesize" || {
      echo "Error: synthesis step failed in round ${r}" >&2
      exit 1
    }
  echo ""
done

# ── Final output ─────────────────────────────────────────────────────
final_synthesis="${output_dir}/round${rounds}_synthesis.md"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FINAL SYNTHESIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cat "${final_synthesis}" 2>/dev/null || echo "(no synthesis — dry run)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Artifacts: ${output_dir}/"
ls -1 "${output_dir}/"
