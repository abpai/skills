#!/usr/bin/env bash
set -euo pipefail
umask 077

# codex-workspace.sh — git worktree topology helper for dual-candidate Codex
# generate loops. Takes branch/worktree prepare, diff-vs-base bundling, and
# safe teardown out of orchestration prompts. Thin wrapper over `git worktree`;
# it does not call Codex itself. Prints stable "[codex-workspace] event=..."
# lines and keeps one small state file per candidate so callers reference a
# candidate by --name rather than tracking paths by hand.

SUBCOMMAND="${1:-}"

usage() {
  cat >&2 <<'EOF'
Usage: codex-workspace.sh prepare|finalize|cleanup [options]

prepare — mint an isolated candidate worktree (or branch) from a frozen base:
  --name NAME            Candidate name (required); scopes branch/worktree/state.
  --repo PATH            Source repo (default: current directory).
  --base REF             Base ref to branch from (default: HEAD); frozen to a SHA.
  --branch BRANCH        Branch name (default: codex-candidate-<name>).
  --path PATH            Worktree path (default: <repo>-<name> beside the repo).
  --no-worktree          Create the branch in place; do not add a worktree.
  --run-dir-file PATH    Write the prepared worktree path to this file immediately.

finalize — bundle the candidate diff (vs the frozen base) + report for comparison:
  --name NAME            Candidate name (required).
  --repo PATH            Source repo used to locate state (default: current dir).
  --run-dir PATH         codex-run.sh generate run dir; its final.md is copied in.
  --out PATH             Bundle output dir (default: <state>/<key>-bundle).

cleanup — tear down a rejected candidate worktree and its disposable branch:
  --name NAME            Candidate name (required).
  --repo PATH            Source repo used to locate state (default: current dir).
  --force                Remove the worktree even if it has uncommitted changes.
  --keep-branch          Keep the candidate branch (default: delete it).
  --keep-bundle          Keep any finalize bundle (default: delete it).

State lives under ${CODEX_EXEC_WORKSPACES_DIR:-$CODEX_HOME/codex-exec-workspaces}.
This helper never commits, pushes, or calls Codex.
EOF
}

if [[ "$SUBCOMMAND" == "-h" || "$SUBCOMMAND" == "--help" ]]; then
  usage
  exit 0
elif [[ "$SUBCOMMAND" == "prepare" || "$SUBCOMMAND" == "finalize" || "$SUBCOMMAND" == "cleanup" ]]; then
  shift
else
  usage
  exit 2
fi

die() {
  printf '[codex-workspace] event=error message=%q\n' "$1" >&2
  exit "${2:-1}"
}

require_value() {
  # $1 option name, $2 value (may be empty)
  [[ -n "${2:-}" ]] || die "option $1 requires a value" 2
}

absolute_path() {
  local target="$1"
  if [[ -d "$target" ]]; then
    (cd "$target" && pwd -P)
  else
    local dir base
    dir="$(dirname "$target")"
    base="$(basename "$target")"
    if [[ -d "$dir" ]]; then
      printf '%s/%s' "$(cd "$dir" && pwd -P)" "$base"
    else
      printf '%s' "$target"
    fi
  fi
}

repo_toplevel() {
  git -C "$1" rev-parse --show-toplevel 2>/dev/null || return 1
}

# Stable, portable key: cksum of the repo toplevel path + candidate name. cksum
# is POSIX (unlike shasum vs sha1sum), which keeps the key identical across
# macOS and Linux for the same repo/name.
state_key() {
  local repo="$1" name="$2" hash
  hash="$(printf '%s' "$repo" | cksum | cut -d' ' -f1)"
  printf '%s-%s' "$hash" "$name"
}

state_dir() {
  printf '%s' "${CODEX_EXEC_WORKSPACES_DIR:-${CODEX_HOME:-$HOME/.codex}/codex-exec-workspaces}"
}

# Append `git diff --no-index` output for each untracked file so candidate
# diffs include newly created files (mirrors codex-run.sh generate capture).
append_untracked_diff() {
  local repo="$1" mode="$2"
  git -C "$repo" ls-files --others --exclude-standard -z 2>/dev/null |
    while IFS= read -r -d '' file_path; do
      if [[ "$mode" == "stat" ]]; then
        git -C "$repo" diff --no-index --stat -- /dev/null "$file_path" 2>/dev/null || true
      else
        git -C "$repo" diff --no-index -- /dev/null "$file_path" 2>/dev/null || true
      fi
    done
}

cmd_prepare() {
  local name="" repo="$PWD" base="HEAD" branch="" path="" run_dir_file="" worktree=true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name) require_value "$1" "${2:-}"; name="$2"; shift 2 ;;
      --repo) require_value "$1" "${2:-}"; repo="$2"; shift 2 ;;
      --base) require_value "$1" "${2:-}"; base="$2"; shift 2 ;;
      --branch) require_value "$1" "${2:-}"; branch="$2"; shift 2 ;;
      --path) require_value "$1" "${2:-}"; path="$2"; shift 2 ;;
      --run-dir-file) require_value "$1" "${2:-}"; run_dir_file="$2"; shift 2 ;;
      --no-worktree) worktree=false; shift ;;
      *) die "unknown prepare option: $1" 2 ;;
    esac
  done
  [[ -n "$name" ]] || die "prepare requires --name" 2

  repo="$(absolute_path "$repo")"
  local top; top="$(repo_toplevel "$repo")" || die "not a git repo: $repo"
  local base_sha
  base_sha="$(git -C "$top" rev-parse --verify "${base}^{commit}" 2>/dev/null)" \
    || die "cannot resolve base ref: $base"

  [[ -n "$branch" ]] || branch="codex-candidate-$name"
  if git -C "$top" show-ref --verify --quiet "refs/heads/$branch"; then
    die "branch already exists: $branch (choose --branch or clean up first)"
  fi

  local sdir key state_file
  sdir="$(state_dir)"; mkdir -p "$sdir"
  key="$(state_key "$top" "$name")"
  state_file="$sdir/$key.env"
  [[ -e "$state_file" ]] && die "candidate state already exists for name=$name (run cleanup first): $state_file"

  local final_worktree=""
  if [[ "$worktree" == true ]]; then
    if [[ -z "$path" ]]; then
      path="$(dirname "$top")/$(basename "$top")-$name"
    fi
    path="$(absolute_path "$path")"
    [[ -e "$path" ]] && die "worktree path already exists: $path"
    git -C "$top" worktree add -b "$branch" "$path" "$base_sha" >/dev/null 2>&1 \
      || die "git worktree add failed for $path"
    final_worktree="$path"
  else
    git -C "$top" branch "$branch" "$base_sha" >/dev/null 2>&1 \
      || die "git branch create failed for $branch"
    final_worktree="$top"
  fi

  {
    printf 'NAME=%q\n' "$name"
    printf 'REPO=%q\n' "$top"
    printf 'BASE_REF=%q\n' "$base"
    printf 'BASE_SHA=%q\n' "$base_sha"
    printf 'BRANCH=%q\n' "$branch"
    printf 'WORKTREE=%q\n' "$final_worktree"
    printf 'IS_WORKTREE=%q\n' "$worktree"
  } > "$state_file"

  if [[ -n "$run_dir_file" ]]; then
    printf '%s' "$final_worktree" > "$run_dir_file"
  fi

  printf '[codex-workspace] event=prepared name=%q repo=%q base=%q base_sha=%q branch=%q worktree=%q state=%q\n' \
    "$name" "$top" "$base" "$base_sha" "$branch" "$final_worktree" "$state_file"
}

load_state() {
  # $1 repo, $2 name -> sources state into current shell; returns 1 if missing
  local repo="$1" name="$2" top sdir key state_file
  repo="$(absolute_path "$repo")"
  top="$(repo_toplevel "$repo")" || die "not a git repo: $repo"
  sdir="$(state_dir)"
  key="$(state_key "$top" "$name")"
  state_file="$sdir/$key.env"
  [[ -f "$state_file" ]] || die "no candidate state for name=$name under repo=$top (expected $state_file)"
  STATE_FILE="$state_file"
  BUNDLE_DEFAULT="$sdir/$key-bundle"
  # shellcheck disable=SC1090
  . "$state_file"
}

cmd_finalize() {
  local name="" repo="$PWD" run_dir="" out=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name) require_value "$1" "${2:-}"; name="$2"; shift 2 ;;
      --repo) require_value "$1" "${2:-}"; repo="$2"; shift 2 ;;
      --run-dir) require_value "$1" "${2:-}"; run_dir="$2"; shift 2 ;;
      --out) require_value "$1" "${2:-}"; out="$2"; shift 2 ;;
      *) die "unknown finalize option: $1" 2 ;;
    esac
  done
  [[ -n "$name" ]] || die "finalize requires --name" 2

  local STATE_FILE BUNDLE_DEFAULT
  load_state "$repo" "$name"
  [[ -d "$WORKTREE" ]] || die "recorded worktree is gone: $WORKTREE"

  [[ -n "$out" ]] || out="$BUNDLE_DEFAULT"
  out="$(absolute_path "$out")"
  mkdir -p "$out"

  local diff_file="$out/candidate.diff"
  local stat_file="$out/candidate-diff.stat"
  local files_file="$out/changed-files.txt"
  {
    git -C "$WORKTREE" diff "$BASE_SHA" 2>/dev/null || true
    append_untracked_diff "$WORKTREE" diff
  } > "$diff_file"
  {
    git -C "$WORKTREE" diff --stat "$BASE_SHA" 2>/dev/null || true
    append_untracked_diff "$WORKTREE" stat
  } > "$stat_file"
  {
    git -C "$WORKTREE" diff --name-only "$BASE_SHA" 2>/dev/null || true
    git -C "$WORKTREE" ls-files --others --exclude-standard 2>/dev/null || true
  } | awk 'NF && !seen[$0]++' > "$files_file"

  local report_file=""
  if [[ -n "$run_dir" && -s "$run_dir/final.md" ]]; then
    report_file="$out/report.md"
    cp "$run_dir/final.md" "$report_file"
  fi

  {
    printf 'NAME=%q\n' "$NAME"
    printf 'REPO=%q\n' "$REPO"
    printf 'BASE_SHA=%q\n' "$BASE_SHA"
    printf 'BRANCH=%q\n' "$BRANCH"
    printf 'WORKTREE=%q\n' "$WORKTREE"
    printf 'RUN_DIR=%q\n' "$run_dir"
    printf 'DIFF=%q\n' "$diff_file"
    printf 'DIFF_STAT=%q\n' "$stat_file"
    printf 'CHANGED_FILES=%q\n' "$files_file"
    printf 'REPORT=%q\n' "$report_file"
  } > "$out/bundle.env"

  printf '[codex-workspace] event=finalized name=%q bundle=%q diff=%q stat=%q files=%q report=%q\n' \
    "$NAME" "$out" "$diff_file" "$stat_file" "$files_file" "$report_file"
}

cmd_cleanup() {
  local name="" repo="$PWD" force=false keep_branch=false keep_bundle=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name) require_value "$1" "${2:-}"; name="$2"; shift 2 ;;
      --repo) require_value "$1" "${2:-}"; repo="$2"; shift 2 ;;
      --force) force=true; shift ;;
      --keep-branch) keep_branch=true; shift ;;
      --keep-bundle) keep_bundle=true; shift ;;
      *) die "unknown cleanup option: $1" 2 ;;
    esac
  done
  [[ -n "$name" ]] || die "cleanup requires --name" 2

  local STATE_FILE BUNDLE_DEFAULT
  load_state "$repo" "$name"

  local removed_worktree=false removed_branch=false
  if [[ "$IS_WORKTREE" == true && -d "$WORKTREE" ]]; then
    local rm_args=(worktree remove "$WORKTREE")
    [[ "$force" == true ]] && rm_args+=(--force)
    if git -C "$REPO" "${rm_args[@]}" 2>/dev/null; then
      removed_worktree=true
    else
      die "worktree has uncommitted changes; re-run with --force to discard: $WORKTREE"
    fi
  fi

  if [[ "$keep_branch" != true ]]; then
    if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
      git -C "$REPO" branch -D "$BRANCH" >/dev/null 2>&1 && removed_branch=true || true
    fi
  fi

  if [[ "$keep_bundle" != true && -d "$BUNDLE_DEFAULT" ]]; then
    rm -rf "$BUNDLE_DEFAULT"
  fi

  rm -f "$STATE_FILE"

  printf '[codex-workspace] event=cleaned name=%q worktree_removed=%q branch=%q branch_removed=%q\n' \
    "$name" "$removed_worktree" "$BRANCH" "$removed_branch"
}

case "$SUBCOMMAND" in
  prepare) cmd_prepare "$@" ;;
  finalize) cmd_finalize "$@" ;;
  cleanup) cmd_cleanup "$@" ;;
esac
