#!/usr/bin/env bash
# Build a multi-repo context pack for architecture review.
# Extracts structure, dependencies, API surface, and auth patterns
# from each repo into a single markdown file.

set -euo pipefail

# Defaults.
repos=""
output=""
max_lines=150

usage() {
  cat <<'USAGE'
Usage:
  build-context.sh [options]

Options:
  --repos "dir1,dir2,..."  Comma-separated repo paths (required)
  --output PATH             Output markdown file path (required)
  --max-lines N             Max tree lines per repo (default: 150)
  --help                    Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repos)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --repos requires a value" >&2; exit 2; }
      repos="$1"
      ;;
    --output)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --output requires a value" >&2; exit 2; }
      output="$1"
      ;;
    --max-lines)
      shift
      [[ $# -gt 0 ]] || { echo "Error: --max-lines requires a value" >&2; exit 2; }
      [[ "$1" =~ ^[1-9][0-9]*$ ]] || { echo "Error: --max-lines must be a positive integer" >&2; exit 2; }
      max_lines="$1"
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
[[ -n "${repos}" ]] || { echo "Error: --repos is required" >&2; exit 2; }
[[ -n "${output}" ]] || { echo "Error: --output is required" >&2; exit 2; }

# Validate required binaries.
command -v git >/dev/null 2>&1 || { echo "Error: git is required" >&2; exit 1; }

# Prefer ripgrep when available so pattern scans stay fast and boundary-aware.
scan_code_patterns() {
  local repo_dir="$1"
  local pattern="$2"
  local limit="$3"
  local empty_message="$4"
  local matches=""

  if command -v rg >/dev/null 2>&1; then
    matches="$(
      rg -n -i --pcre2 \
        -g '*.ts' -g '*.js' -g '*.py' -g '*.go' -g '*.rs' \
        -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!build/**' -g '!.next/**' \
        "${pattern}" "${repo_dir}" 2>/dev/null || true
    )"
  else
    matches="$(
      grep -rn --include='*.ts' --include='*.js' --include='*.py' --include='*.go' --include='*.rs' \
        -iE "${pattern}" "${repo_dir}" 2>/dev/null \
        | grep -v 'node_modules' \
        | grep -v '.git/' \
        | grep -v '/dist/' \
        | grep -v '/build/' \
        | grep -v '/.next/' || true
    )"
  fi

  if [[ -n "${matches}" ]]; then
    printf '%s\n' "${matches}" | sed -n "1,${limit}p"
  else
    echo "${empty_message}"
  fi
}

# Ensure output directory exists.
mkdir -p "$(dirname "${output}")"

# Clear output file.
: > "${output}"

IFS=',' read -ra repo_list <<< "${repos}"
packed_repos=0

for repo_dir in "${repo_list[@]}"; do
  # Trim whitespace.
  repo_dir="$(echo "${repo_dir}" | xargs)"

  [[ -d "${repo_dir}" ]] || {
    echo "Warning: skipping non-existent directory: ${repo_dir}" >&2
    continue
  }

  repo_name="$(basename "${repo_dir}")"

  {
    echo "## Repo: ${repo_name}"
    echo ""
    echo "**Path:** \`${repo_dir}\`"
    echo ""

    # Git info.
    if git -C "${repo_dir}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      branch="$(git -C "${repo_dir}" branch --show-current 2>/dev/null || echo "detached")"
      echo "**Branch:** \`${branch}\`"
      echo ""
      echo "### Recent commits"
      echo '```'
      git -C "${repo_dir}" log --oneline -5 2>/dev/null || echo "(no commits)"
      echo '```'
      echo ""
    fi

    # Top-level files.
    echo "### Top-level files"
    echo '```'
    ls -1 "${repo_dir}" 2>/dev/null | sed -n '1,40p'
    echo '```'
    echo ""

    # Directory tree (excluding common noise).
    echo "### Directory tree"
    echo '```'
    (cd "${repo_dir}" && find . \
      \( -type d \( -name .git -o -name node_modules -o -name dist -o -name build -o -name __pycache__ -o -name .next \) -prune \) \
      -o -type f -print \
      2>/dev/null | awk -F/ 'NF <= 4' | sort | sed -n "1,${max_lines}p")
    echo '```'
    echo ""

    # Dependency manifests.
    echo "### Dependencies"
    for manifest in package.json pyproject.toml go.mod Cargo.toml; do
      manifest_path="${repo_dir}/${manifest}"
      if [[ -f "${manifest_path}" ]]; then
        echo "#### ${manifest}"
        echo '```'
        head -30 "${manifest_path}"
        echo '```'
        echo ""
      fi
    done

    # API surface patterns.
    echo "### API surface"
    echo '```'
    scan_code_patterns "${repo_dir}" \
      '(\b(router|express|fastapi|gin|grpc|openapi|graphql|endpoint)s?\b|\b(app|router)\.(get|post|put|delete|patch)\b|@app\.route\b|\bhandlers?\b)' \
      50 \
      "(no API patterns found)"
    echo '```'
    echo ""

    # Auth patterns.
    echo "### Auth patterns"
    echo '```'
    scan_code_patterns "${repo_dir}" \
      '(\b(auth|jwt|session|oauth|token|bearer|passport|clerk|nextauth)\b|\bmiddleware\b.{0,40}\bauth\b|\bsupabase\b.{0,20}\bauth\b)' \
      30 \
      "(no auth patterns found)"
    echo '```'
    echo ""
    echo "---"
    echo ""
  } >> "${output}"

  packed_repos=$((packed_repos + 1))
  echo "Packed: ${repo_name}" >&2
done

if [[ "${packed_repos}" -eq 0 ]]; then
  echo "Error: no valid repository directories were packed into the context" >&2
  exit 1
fi

line_count="$(wc -l < "${output}" | xargs)"
echo "Context pack written to ${output} (${line_count} lines)" >&2
