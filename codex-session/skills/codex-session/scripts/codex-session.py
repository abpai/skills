#!/usr/bin/env python3
"""Resolve a Codex session UUID and render bounded semantic context."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any


UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
INJECTED_PREFIXES = (
    "# AGENTS.md instructions",
    "<app-context>",
    "<collaboration_mode>",
    "<environment_context>",
    "<permissions instructions>",
    "<skills_instructions>",
    "<user_instructions>",
)
TOOL_TYPES = {
    "custom_tool_call",
    "function_call",
    "image_generation_call",
    "tool_search_call",
    "web_search_call",
}
# Record shapes this parser understands, across both rollout dialects. A
# non-empty rollout containing none of these is an unknown format: report that
# rather than rendering an empty session, which reads as "nothing happened".
KNOWN_RECORD_TYPES = {
    "message",
    "response_item",
    "session_meta",
    "turn_context",
    *TOOL_TYPES,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find a Codex rollout by session UUID without scanning transcript contents."
    )
    parser.add_argument("session_id", help="Codex session or rollout UUID")
    parser.add_argument(
        "--codex-home",
        type=Path,
        default=Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")),
        help="Codex state root (default: CODEX_HOME or ~/.codex)",
    )
    parser.add_argument("--path", action="store_true", help="Print only the rollout path")
    parser.add_argument(
        "--last",
        type=int,
        default=8,
        metavar="N",
        help="Render the last N semantic messages (default: 8; 0 means all)",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=2000,
        metavar="N",
        help="Cap each rendered message or tool input (default: 2000; 0 means unlimited)",
    )
    parser.add_argument(
        "--include-tools",
        action="store_true",
        help="Include compact tool-call summaries; tool results stay omitted",
    )
    parser.add_argument("--json", action="store_true", help="Emit structured JSON")
    return parser.parse_args()


def read_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise SystemExit(f"{path}:{line_number}: invalid JSONL: {error}") from error
            if isinstance(value, dict):
                records.append(value)
    return records


def resolve_rollout(codex_home: Path, session_id: str) -> Path:
    candidates: list[Path] = []
    pattern = f"rollout-*-{session_id}.jsonl"
    for root_name in ("sessions", "archived_sessions"):
        root = codex_home / root_name
        if root.is_dir():
            candidates.extend(root.rglob(pattern))
    candidates = sorted(set(candidates))
    if not candidates:
        raise SystemExit(f"Codex rollout not found for {session_id} under {codex_home}")
    if len(candidates) != 1:
        choices = "\n".join(f"  {path}" for path in candidates)
        raise SystemExit(f"multiple rollouts found for {session_id}:\n{choices}")
    return candidates[0]


def truncate(value: str, limit: int) -> str:
    if limit <= 0 or len(value) <= limit:
        return value
    omitted = len(value) - limit
    return f"{value[:limit]}\n… [{omitted} chars omitted]"


def is_injected(text: str) -> bool:
    return text.lstrip().startswith(INJECTED_PREFIXES)


def content_text(content: Any) -> str:
    """Join a message's real text, dropping injected blocks individually.

    Injected context and a genuine request can share one record, so the
    injected test has to run per block: judging the joined string would
    discard the user's actual words along with the wrapper.
    """
    if not isinstance(content, list):
        return ""
    parts = [
        block["text"].strip()
        for block in content
        if isinstance(block, dict)
        and block.get("type") in {"input_text", "output_text"}
        and isinstance(block.get("text"), str)
        and block["text"].strip()
        and not is_injected(block["text"])
    ]
    return "\n".join(parts)


def tool_summary(payload: dict[str, Any], limit: int) -> dict[str, Any]:
    tool: dict[str, Any] = {
        "name": payload.get("name") or payload.get("type") or "unknown"
    }
    value = payload.get("arguments")
    if value is None:
        value = payload.get("input")
    if value is None:
        value = payload.get("action")
    if value is not None:
        rendered = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        tool["input"] = truncate(rendered, limit)
    return tool


def message_payload(record: dict[str, Any]) -> dict[str, Any] | None:
    """Return a record's message/tool payload across both rollout dialects.

    Current rollouts wrap payloads in a `response_item` envelope; rollouts
    written before that envelope store the same shapes at the top level.
    """
    if record.get("type") == "response_item":
        payload = record.get("payload")
        return payload if isinstance(payload, dict) else None
    if record.get("type") in {"message", *TOOL_TYPES}:
        return record
    return None


def semantic_messages(
    records: list[dict[str, Any]], include_tools: bool, limit: int
) -> tuple[list[dict[str, Any]], int]:
    messages: list[dict[str, Any]] = []
    recognized = 0
    for record in records:
        if record.get("type") in KNOWN_RECORD_TYPES:
            recognized += 1
        payload = message_payload(record)
        if payload is None:
            continue
        payload_type = payload.get("type")
        if payload_type == "message" and payload.get("role") in {"user", "assistant"}:
            text = content_text(payload.get("content"))
            if not text:
                continue
            messages.append(
                {
                    "role": payload["role"],
                    "timestamp": record.get("timestamp"),
                    "text": truncate(text, limit),
                }
            )
        elif include_tools and payload_type in TOOL_TYPES:
            messages.append(
                {
                    "role": "assistant",
                    "timestamp": record.get("timestamp"),
                    "tools": [tool_summary(payload, limit)],
                }
            )
    return messages, recognized


def session_header(records: list[dict[str, Any]]) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    turn: dict[str, Any] = {}
    for record in records:
        payload = record.get("payload")
        if not isinstance(payload, dict):
            # Pre-envelope rollouts carry session metadata bare on the first record.
            if not meta and record.get("type") is None and "git" in record:
                meta = record
            continue
        if record.get("type") == "session_meta" and not meta:
            meta = payload
        elif record.get("type") == "turn_context":
            turn = payload
    git = meta.get("git") if isinstance(meta.get("git"), dict) else {}
    return {
        "cwd": turn.get("cwd") or meta.get("cwd"),
        "git_branch": git.get("branch"),
        "model": turn.get("model"),
        "effort": turn.get("effort"),
        "cli_version": meta.get("cli_version"),
        "parent_thread_id": meta.get("parent_thread_id"),
    }


def main() -> int:
    args = parse_args()
    if not UUID_RE.fullmatch(args.session_id):
        raise SystemExit("session_id must be a UUID")
    if args.last < 0 or args.max_chars < 0:
        raise SystemExit("--last and --max-chars must be non-negative")

    session_id = args.session_id.lower()
    rollout = resolve_rollout(args.codex_home.expanduser(), session_id)
    if args.path:
        print(rollout)
        return 0

    records = read_records(rollout)
    all_messages, recognized = semantic_messages(
        records, args.include_tools, args.max_chars
    )
    if records and not recognized:
        raise SystemExit(
            f"{rollout}: unrecognized rollout format ({len(records)} records, none understood); "
            "refusing to render this session as empty"
        )
    shown = all_messages[-args.last :] if args.last else all_messages
    result = {
        "session_id": session_id,
        "rollout": str(rollout),
        **session_header(records),
        "message_count": len(all_messages),
        "showing": len(shown),
        "messages": shown,
    }
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    print(f"session: {result['session_id']}")
    print(f"rollout: {result['rollout']}")
    for key in ("cwd", "git_branch", "model", "effort", "cli_version", "parent_thread_id"):
        if result.get(key):
            print(f"{key}: {result[key]}")
    print(f"messages: {result['message_count']} (showing {result['showing']})")
    for item in shown:
        timestamp = item.get("timestamp") or "unknown time"
        if item.get("text"):
            print(f"\n[{timestamp}] {item['role']}\n{item['text']}")
        for tool in item.get("tools", []):
            print(f"\n[{timestamp}] assistant tool={tool['name']}")
            if tool.get("input"):
                print(tool["input"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
