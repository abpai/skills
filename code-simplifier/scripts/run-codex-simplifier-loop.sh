#!/usr/bin/env bash
# Run Codex simplification repeatedly until no more changes are made
# or until a maximum number of iterations is reached.

set -euo pipefail

# Start in the current working directory.
# The expectation is that this is a git repository root.
workdir="$(pwd)"

# Default options.
max_iterations=5
codex_cmd="codex exec --full-auto"
dry_run=false
prompt='Use the code-simplifier skill to simplify recent changes for readability and maintainability while preserving exact behavior, public interfaces, side effects, and tests. If no safe simplification remains, make no edits and say no further changes are needed.'

capture_worktree_state() {
  git status --porcelain=v1 --untracked-files=all
}

usage() {
  cat <<'USAGE'
Usage:
  run-codex-simplifier-loop.sh [options]

Options:
  --max-iterations N    Maximum rounds to run (default: 5)
  --codex-cmd "CMD"     Codex command to execute (default: "codex exec --full-auto")
  --prompt "TEXT"       Prompt sent to Codex each round
  --workdir DIR         Working directory (default: current directory)
  --dry-run             Show planned commands without running Codex
  --help                Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --max-iterations requires a value" >&2; exit 2; }
      [[ "$1" =~ ^[1-9][0-9]*$ ]] || { echo "Error: --max-iterations must be a positive integer" >&2; exit 2; }
      max_iterations="$1"
      ;;
    --codex-cmd)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --codex-cmd requires a value" >&2; exit 2; }
      codex_cmd="$1"
      ;;
    --prompt)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --prompt requires a value" >&2; exit 2; }
      prompt="$1"
      ;;
    --workdir)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --workdir requires a value" >&2; exit 2; }
      workdir="$1"
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

# Validate required binaries.
command -v git >/dev/null 2>&1 || { echo "Error: git is required" >&2; exit 1; }
read -r -a codex_argv <<< "${codex_cmd}"
[[ ${#codex_argv[@]} -gt 0 ]] || { echo "Error: --codex-cmd must not be empty" >&2; exit 2; }
command -v "${codex_argv[0]}" >/dev/null 2>&1 || { echo "Error: ${codex_argv[0]} is required" >&2; exit 1; }

# Enter selected working directory.
cd "${workdir}"

# Ensure we are inside a git repository.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: working directory is not a git repository: ${workdir}" >&2
  exit 1
}

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Info: working tree already has changes; loop continues from current state."
fi

any_changes=false
rounds_run=0

for ((i=1; i<=max_iterations; i++)); do
  rounds_run="$i"
  echo
  echo "=== Simplifier round ${i}/${max_iterations} ==="

  pre_state="$(capture_worktree_state)"

  if [[ "${dry_run}" == true ]]; then
    printf '[dry-run] Would run:'
    printf ' %q' "${codex_argv[@]}" "${prompt}"
    printf '\n'
  else
    "${codex_argv[@]}" "${prompt}"
  fi

  post_state="$(capture_worktree_state)"

  if [[ "${pre_state}" != "${post_state}" ]]; then
    echo "Round ${i}: changes detected."
    any_changes=true
  else
    echo "Round ${i}: no changes detected; stopping early."
    break
  fi
done

echo
if [[ "${any_changes}" == true ]]; then
  echo "Done: ${rounds_run} round(s) executed with at least one change."
else
  echo "Done: ${rounds_run} round(s) executed with no changes."
fi
