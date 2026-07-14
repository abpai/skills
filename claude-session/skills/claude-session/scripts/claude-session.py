#!/usr/bin/env python3
"""Resolve a Claude session UUID and render bounded semantic context."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find a Claude transcript by session UUID without scanning transcript contents."
    )
    parser.add_argument("session_id", help="Claude session UUID")
    parser.add_argument(
        "--claude-home",
        type=Path,
        default=Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude")),
        help="Claude state root (default: CLAUDE_CONFIG_DIR or ~/.claude)",
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        help="Disambiguate duplicate UUIDs using the transcript cwd",
    )
    parser.add_argument("--path", action="store_true", help="Print only the transcript path")
    parser.add_argument(
        "--children", action="store_true", help="List named-subagent transcript paths"
    )
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
        help="Cap each rendered message (default: 2000; 0 means unlimited)",
    )
    parser.add_argument(
        "--include-tools",
        action="store_true",
        help="Include compact assistant tool-use summaries; tool results stay omitted",
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


def transcript_cwd(records: list[dict[str, Any]]) -> str | None:
    for record in records:
        cwd = record.get("cwd")
        if isinstance(cwd, str) and cwd:
            return cwd
    return None


def resolve_transcript(
    claude_home: Path, session_id: str, workspace: Path | None
) -> tuple[Path, list[dict[str, Any]]]:
    candidates = sorted((claude_home / "projects").glob(f"*/{session_id}.jsonl"))
    if not candidates:
        raise SystemExit(
            f"Claude transcript not found for {session_id} under {claude_home / 'projects'}"
        )

    loaded = [(path, read_records(path)) for path in candidates]
    if workspace is not None:
        expected = str(workspace.expanduser().resolve())
        loaded = [item for item in loaded if transcript_cwd(item[1]) == expected]
        if not loaded:
            raise SystemExit(f"no transcript for {session_id} has cwd {expected}")

    if len(loaded) != 1:
        choices = "\n".join(
            f"  {path} (cwd={transcript_cwd(records) or 'unknown'})"
            for path, records in loaded
        )
        raise SystemExit(
            f"multiple transcripts found for {session_id}; pass --workspace:\n{choices}"
        )
    return loaded[0]


def text_blocks(content: Any) -> list[str]:
    if isinstance(content, str):
        return [content]
    if not isinstance(content, list):
        return []
    return [
        block["text"]
        for block in content
        if isinstance(block, dict)
        and block.get("type") == "text"
        and isinstance(block.get("text"), str)
    ]


def tool_blocks(content: Any) -> list[dict[str, Any]]:
    if not isinstance(content, list):
        return []
    tools: list[dict[str, Any]] = []
    for block in content:
        if not isinstance(block, dict) or block.get("type") != "tool_use":
            continue
        item: dict[str, Any] = {"name": block.get("name", "unknown")}
        if isinstance(block.get("input"), dict):
            item["input"] = block["input"]
        tools.append(item)
    return tools


def semantic_messages(
    records: list[dict[str, Any]], include_tools: bool
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for record in records:
        role = record.get("type")
        if role not in {"user", "assistant"}:
            continue
        if record.get("isMeta") is True:
            continue
        message = record.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        text = "\n".join(part.strip() for part in text_blocks(content) if part.strip())
        tools = tool_blocks(content) if include_tools and role == "assistant" else []
        if not text and not tools:
            continue
        item: dict[str, Any] = {
            "role": role,
            "timestamp": record.get("timestamp"),
        }
        if text:
            item["text"] = text
        if tools:
            item["tools"] = tools
        messages.append(item)
    return messages


def truncate(value: str, limit: int) -> str:
    if limit <= 0 or len(value) <= limit:
        return value
    omitted = len(value) - limit
    return f"{value[:limit]}\n… [{omitted} chars omitted]"


def child_paths(parent: Path, session_id: str) -> list[Path]:
    return sorted((parent.parent / session_id / "subagents").glob("*.jsonl"))


def main() -> int:
    args = parse_args()
    if not UUID_RE.fullmatch(args.session_id):
        raise SystemExit("session_id must be a UUID")
    if args.last < 0 or args.max_chars < 0:
        raise SystemExit("--last and --max-chars must be non-negative")

    transcript, records = resolve_transcript(args.claude_home, args.session_id, args.workspace)
    children = child_paths(transcript, args.session_id)

    if args.path:
        print(transcript)
        return 0
    if args.children:
        for path in children:
            print(path)
        return 0

    all_messages = semantic_messages(records, args.include_tools)
    shown = all_messages[-args.last :] if args.last else all_messages
    for item in shown:
        if "text" in item:
            item["text"] = truncate(item["text"], args.max_chars)
        tool_limit = 0 if args.max_chars == 0 else min(args.max_chars, 500)
        for tool in item.get("tools", []):
            payload = json.dumps(
                tool.get("input", {}), ensure_ascii=False, separators=(",", ":")
            )
            tool["input"] = truncate(payload, tool_limit)

    result = {
        "session_id": args.session_id,
        "transcript": str(transcript),
        "cwd": transcript_cwd(records),
        "message_count": len(all_messages),
        "showing": len(shown),
        "child_transcripts": len(children),
        "messages": shown,
    }
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    print(f"session: {result['session_id']}")
    print(f"transcript: {result['transcript']}")
    print(f"cwd: {result['cwd'] or 'unknown'}")
    print(
        f"messages: showing {result['showing']} of {result['message_count']}"
        f"; child transcripts: {result['child_transcripts']}"
    )
    for item in shown:
        print(f"\n[{item['timestamp'] or 'unknown time'}] {item['role'].upper()}")
        if "text" in item:
            print(item["text"])
        for tool in item.get("tools", []):
            print(f"[tool] {tool['name']} {tool.get('input', '')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
