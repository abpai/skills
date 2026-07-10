#!/usr/bin/env python3
"""Securely capture and inspect local decision-workflow feedback notes."""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "decision_feedback_note/v1"
DEFAULT_ROOT = Path.home() / ".agents" / "decision-worksheet"
LEGACY_ROOT = Path.home() / ".agents" / "capture-feedback"


def feedback_dir() -> Path:
    configured = os.environ.get("DECISION_WORKSHEET_HOME")
    root = Path(configured).expanduser() if configured else DEFAULT_ROOT
    return root / "feedback"


def legacy_dir() -> Path:
    configured = os.environ.get("CAPTURE_FEEDBACK_HOME")
    root = Path(configured).expanduser() if configured else LEGACY_ROOT
    return root / "inbox"


def make_id(now: datetime) -> str:
    return f"df_{now.strftime('%Y%m%dT%H%M%SZ')}_{secrets.token_hex(2)}"


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def feedback_text(parts: list[str]) -> str:
    if parts and parts[0] == "--":
        parts = parts[1:]
    if parts:
        return parts[0] if len(parts) == 1 else " ".join(parts)
    if not sys.stdin.isatty():
        return sys.stdin.read().removesuffix("\n")
    return ""


def write_json_secure(path: Path, payload: dict) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.parent.parent.chmod(0o700)
    path.parent.chmod(0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def cmd_capture(args: argparse.Namespace) -> int:
    user_words = feedback_text(args.text)
    if not user_words:
        print("error: feedback text is required", file=sys.stderr)
        return 2

    now = datetime.now(timezone.utc)
    created_at = now.isoformat(timespec="seconds").replace("+00:00", "Z")
    last_error: OSError | None = None
    for _ in range(8):
        note_id = make_id(now)
        marker = f"decision-feedback:{note_id}"
        payload = {
            "schema_version": SCHEMA_VERSION,
            "id": note_id,
            "created_at": created_at,
            "marker": marker,
            "cwd": os.getcwd(),
            "user_words": user_words,
        }
        path = feedback_dir() / f"{note_id}.json"
        try:
            write_json_secure(path, payload)
        except FileExistsError as error:
            last_error = error
            continue
        print(f"Captured {marker}")
        print(path)
        return 0

    print(f"error: could not allocate a unique note id: {last_error}", file=sys.stderr)
    return 1


def load_notes() -> list[dict]:
    notes: list[dict] = []
    seen: set[str] = set()
    for directory in (feedback_dir(), legacy_dir()):
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            note_id = str(data.get("id", ""))
            if not note_id or note_id in seen:
                continue
            seen.add(note_id)
            data["_path"] = str(path)
            notes.append(data)
    notes.sort(key=lambda note: str(note.get("created_at", "")), reverse=True)
    return notes


def cmd_list(args: argparse.Namespace) -> int:
    notes = load_notes()
    if not notes:
        print("No captured feedback notes.")
        return 0
    for note in notes[: args.limit]:
        cwd_name = Path(str(note.get("cwd") or "")).name or "-"
        words = " ".join(str(note.get("user_words") or "").split())
        if len(words) > 80:
            words = words[:77] + "..."
        print(f"{note.get('created_at', '-')}\t{note.get('id', '-')}\t{cwd_name}\t{words}")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    wanted = args.id.removesuffix(".json").removeprefix("decision-feedback:").removeprefix("capture-feedback:")
    match = next((note for note in load_notes() if note.get("id") == wanted), None)
    if match is None:
        print(f"error: note not found: {args.id}", file=sys.stderr)
        return 1
    note = dict(match)
    note.pop("_path", None)
    print(json.dumps(note, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Capture and inspect local feedback notes.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture = subparsers.add_parser("capture", help="securely write a new feedback note")
    capture.add_argument("text", nargs=argparse.REMAINDER, help="feedback text; pass one quoted argument to preserve it exactly")
    capture.set_defaults(func=cmd_capture)

    list_cmd = subparsers.add_parser("list", help="list new and legacy feedback notes")
    list_cmd.add_argument("--limit", type=positive_int, default=20)
    list_cmd.set_defaults(func=cmd_list)

    show = subparsers.add_parser("show", help="show a new or legacy feedback note as JSON")
    show.add_argument("id")
    show.set_defaults(func=cmd_show)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
