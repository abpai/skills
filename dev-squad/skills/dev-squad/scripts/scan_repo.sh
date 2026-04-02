#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"

if [[ ! -d "$repo_root" ]]; then
  echo "ERROR: repo path not found: $repo_root" >&2
  exit 1
fi

cd "$repo_root"

has_file() {
  [[ -e "$1" ]] && echo "yes" || echo "no"
}

join_csv() {
  local first="yes"
  for item in "$@"; do
    [[ -z "$item" ]] && continue
    if [[ "$first" == "yes" ]]; then
      printf '%s' "$item"
      first="no"
    else
      printf ',%s' "$item"
    fi
  done
  printf '\n'
}

languages=()
[[ -f package.json ]] && languages+=("javascript-or-typescript")
[[ -f requirements.txt || -f pyproject.toml ]] && languages+=("python")
[[ -f go.mod ]] && languages+=("go")
[[ -f Cargo.toml ]] && languages+=("rust")
[[ -f Gemfile ]] && languages+=("ruby")

frontend="no"
if rg -q --glob 'package.json' '"(react|next|vue|svelte|nuxt|solid-js)"' . 2>/dev/null; then
  frontend="yes"
fi

test_runner="unknown"
if [[ -f vitest.config.ts || -f vitest.config.js || -f vitest.workspace.ts ]]; then
  test_runner="vitest"
elif [[ -f jest.config.js || -f jest.config.ts || -f jest.config.cjs ]]; then
  test_runner="jest"
elif [[ -f pytest.ini || -f tox.ini ]] || rg -q 'pytest' pyproject.toml requirements.txt 2>/dev/null; then
  test_runner="pytest"
elif [[ -f go.mod ]]; then
  test_runner="go test"
elif [[ -f Cargo.toml ]]; then
  test_runner="cargo test"
fi

ci="none"
if [[ -d .github/workflows ]]; then
  ci="github-actions"
elif [[ -f .gitlab-ci.yml ]]; then
  ci="gitlab-ci"
fi

claude_config="$(has_file .claude/settings.json)"
claude_hooks="no"
claude_agents="no"
[[ -d .claude/hooks ]] && claude_hooks="yes"
[[ -d .claude/agents ]] && claude_agents="yes"

languages_csv="$(join_csv "${languages[@]}")"
if [[ -z "$languages_csv" ]]; then
  languages_csv="unknown"
fi

printf 'repo_root=%s\n' "$PWD"
printf 'languages=%s\n' "$languages_csv"
printf 'test_runner=%s\n' "$test_runner"
printf 'ci=%s\n' "$ci"
printf 'frontend=%s\n' "$frontend"
printf 'has_claude_settings=%s\n' "$claude_config"
printf 'has_claude_hooks=%s\n' "$claude_hooks"
printf 'has_claude_agents=%s\n' "$claude_agents"
