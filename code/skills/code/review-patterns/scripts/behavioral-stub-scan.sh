#!/usr/bin/env bash
# behavioral-stub-scan.sh — find behavioral stubs (fake work, hardcoded metrics,
# 501 routes, caching no-ops, swallowed errors) over the changed surface.
#
# The load-bearing, non-obvious part is the sleep() FALSE-POSITIVE FILTER:
# retry/backoff/rate-limit/throttle/test sleeps are legitimate and MUST be
# excluded, or every retry loop reads as fake work.
#
# Usage:
#   behavioral-stub-scan.sh [path-or-file ...]   (default: . )
#   # restrict to the PR scope:
#   xargs behavioral-stub-scan.sh < .workflow/finish-lane/changed-files.txt
#
# Reports counts + file:line per category. Counts are leads, not findings:
# every hit needs caller tracing (output-dependent => stub; signature-only => maybe
# intentional). See the lens Gotchas.
set -euo pipefail

command -v rg >/dev/null 2>&1 || { echo "rg (ripgrep): not installed" >&2; exit 3; }
TARGETS=("$@"); [ ${#TARGETS[@]} -eq 0 ] && TARGETS=(".")

EXCLUDE='!target/' ; IGN=(-g '!target/' -g '!node_modules/' -g '!.git/' -g '!vendor/' -g '!dist/')

section() { printf '\n== %s ==\n' "$1"; }

section "sleep-as-fake-work (SSH/network/processing) — FP-filtered"
# Exclude legit timing: retry/backoff/rate-limit/throttle, and test/bench files.
rg -n "sleep\(|thread::sleep|time\.sleep|tokio::time::sleep|setTimeout" "${IGN[@]}" "${TARGETS[@]}" \
  | grep -vi "test\|spec\|bench\|retry\|backoff\|rate.limit\|throttle" || echo "  (none)"

section "explicit fake markers (simulat/faking/mocking/pretend)"
rg -n "simulat|faking|mocking|pretend" "${IGN[@]}" "${TARGETS[@]}" || echo "  (none)"

section "hardcoded scores/metrics that should be computed"
rg -n "score\s*[:=]\s*[0-9]|rarity.*[:=]\s*[0-9]|count.*[:=]\s*0[^.]|dau.*[:=]\s*0|mrr.*[:=]\s*0" \
  "${IGN[@]}" "${TARGETS[@]}" || echo "  (none)"

section "501 / Not Implemented route stubs"
rg -n "501|Not Implemented|not.yet.implemented" "${IGN[@]}" "${TARGETS[@]}" || echo "  (none)"

section "caching/storage no-ops & disabled features"
rg -n "cacheToR2.*return false|checkCache.*return null|return false.*//.*cache|warm.*false|enable.*false.*//.*(todo|stub|later|disabled)" \
  "${IGN[@]}" "${TARGETS[@]}" || echo "  (none)"

section "swallowed errors (catch-and-ignore)"
rg -n "catch\s*\([^)]*\)\s*\{\s*\}|except.*:\s*pass|except:\s*pass|\.unwrap_or_default\(\)|Err\(_\)\s*=>\s*\{\}|Err\(_\)\s*=>\s*Ok\(\(\)\)" \
  "${IGN[@]}" "${TARGETS[@]}" || echo "  (none)"

section "language trivial-success returns (no English keyword)"
# Rust Ok(vec![])/Ok(Default), Go return nil, nil, TS return undefined, Python ... ellipsis body
rg -n "Ok\(Default::default\(\)\)|Ok\(vec!\[\]\)|Ok\(String::new\(\)\)|Ok\(HashMap::new\(\)\)|return nil, nil\b|return undefined\b|^\s*\.\.\.\s*$" \
  "${IGN[@]}" "${TARGETS[@]}" || echo "  (none)"
