#!/bin/bash
set -euo pipefail

REVIEW_GATE="on"

usage() {
  cat <<'EOF'
Usage: merge-settings.sh [--review-gate on|off] [template] [target]

Defaults:
  template = dev-squad/templates/settings.json
  target   = .claude/settings.json
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --review-gate)
      REVIEW_GATE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

TEMPLATE="${1:-dev-squad/templates/settings.json}"
TARGET="${2:-.claude/settings.json}"

if [[ "$REVIEW_GATE" != "on" && "$REVIEW_GATE" != "off" ]]; then
  echo "Expected --review-gate on|off" >&2
  exit 2
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

python3 - "$TEMPLATE" "$TARGET" "$REVIEW_GATE" <<'PY'
from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

template_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])
review_gate = sys.argv[3] == "on"
review_gate_command = "./.claude/hooks/review-gate.sh"

def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"Failed to parse {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"{path} must contain a JSON object")
    return value

def normalize_hook_block(block: dict) -> dict | None:
    hooks = block.get("hooks")
    if not isinstance(hooks, list):
        return deepcopy(block)
    filtered = []
    for hook in hooks:
        if not isinstance(hook, dict):
            filtered.append(hook)
            continue
        if not review_gate and hook.get("command") == review_gate_command:
            continue
        filtered.append(hook)
    if not filtered:
        return None
    new_block = deepcopy(block)
    new_block["hooks"] = filtered
    return new_block

def strip_review_gate(settings: dict) -> dict:
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return settings

    cleaned = deepcopy(settings)
    cleaned_hooks = {}
    for event_name, blocks in hooks.items():
        if not isinstance(blocks, list):
            cleaned_hooks[event_name] = deepcopy(blocks)
            continue

        filtered_blocks = []
        for block in blocks:
            if isinstance(block, dict):
                normalized = normalize_hook_block(block)
                if normalized is not None:
                    filtered_blocks.append(normalized)
            else:
                filtered_blocks.append(deepcopy(block))

        if filtered_blocks:
            cleaned_hooks[event_name] = filtered_blocks

    cleaned["hooks"] = cleaned_hooks
    return cleaned

def merge_lists(existing: list, incoming: list) -> list:
    out = deepcopy(existing)
    seen = {json.dumps(item, sort_keys=True) for item in out}
    for item in incoming:
        key = json.dumps(item, sort_keys=True)
        if key not in seen:
            out.append(deepcopy(item))
            seen.add(key)
    return out

def merge(existing, incoming):
    if isinstance(existing, dict) and isinstance(incoming, dict):
        out = deepcopy(existing)
        for key, value in incoming.items():
            if key not in out:
                out[key] = deepcopy(value)
                continue
            out[key] = merge(out[key], value)
        return out
    if isinstance(existing, list) and isinstance(incoming, list):
        return merge_lists(existing, incoming)
    return deepcopy(existing)

template = load_json(template_path)
target = load_json(target_path)

template_hooks = template.get("hooks")
if not isinstance(template_hooks, dict):
    raise SystemExit(f"{template_path} must contain a top-level 'hooks' object")

if not review_gate:
    template_hooks = strip_review_gate({"hooks": deepcopy(template_hooks)})["hooks"]
    target = strip_review_gate(target)

merged = merge(target, {**template, "hooks": template_hooks})

target_path.parent.mkdir(parents=True, exist_ok=True)
tmp_path = target_path.with_suffix(target_path.suffix + ".tmp")
tmp_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
tmp_path.replace(target_path)
PY
