#!/usr/bin/env python3
"""Capture small local notes about agent behavior corrections."""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "capture_feedback_note/v1"
DEFAULT_ROOT = Path.home() / ".agents" / "capture-feedback"


def feedback_root() -> Path:
    configured = os.environ.get("CAPTURE_FEEDBACK_HOME")
    return Path(configured).expanduser() if configured else DEFAULT_ROOT


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def make_id(now: datetime) -> str:
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    return f"cf_{stamp}_{secrets.token_hex(2)}"


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def normalize_text(parts: list[str]) -> str:
    if parts and parts[0] == "--":
        parts = parts[1:]
    text = " ".join(parts).strip()
    if not text and not sys.stdin.isatty():
        text = sys.stdin.read().strip()
    return text


def write_json_secure(path: Path, payload: dict) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def cmd_capture(args: argparse.Namespace) -> int:
    user_words = normalize_text(args.text)
    if not user_words:
        print("error: feedback text is required", file=sys.stderr)
        return 2

    now = utc_now()
    created_at = now.isoformat(timespec="seconds").replace("+00:00", "Z")

    # Retry on the rare chance that two captures land in the same second with
    # the same random token: O_EXCL would otherwise raise an uncaught
    # FileExistsError. Each attempt draws a fresh token from make_id.
    last_error: OSError | None = None
    for _ in range(8):
        note_id = make_id(now)
        marker = f"capture-feedback:{note_id}"
        payload = {
            "schema_version": SCHEMA_VERSION,
            "id": note_id,
            "created_at": created_at,
            "marker": marker,
            "cwd": os.getcwd(),
            "user_words": user_words,
        }
        note_path = feedback_root() / "inbox" / f"{note_id}.json"
        try:
            write_json_secure(note_path, payload)
        except FileExistsError as error:
            last_error = error
            continue
        print(f"Captured {marker}")
        print(note_path)
        return 0

    print(f"error: could not allocate a unique note id: {last_error}", file=sys.stderr)
    return 1


def load_notes() -> list[dict]:
    inbox = feedback_root() / "inbox"
    notes: list[dict] = []
    if not inbox.exists():
        return notes
    for path in sorted(inbox.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        data["_path"] = str(path)
        notes.append(data)
    notes.sort(key=lambda note: note.get("created_at", ""), reverse=True)
    return notes


def cmd_list(args: argparse.Namespace) -> int:
    notes = load_notes()
    if not notes:
        print("No captured feedback notes.")
        return 0

    limit = args.limit
    for note in notes[:limit]:
        cwd_name = Path(note.get("cwd") or "").name or "-"
        words = " ".join((note.get("user_words") or "").split())
        if len(words) > 80:
            words = words[:77] + "..."
        print(f"{note.get('created_at', '-')}\t{note.get('id', '-')}\t{cwd_name}\t{words}")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    wanted = args.id.removesuffix(".json")
    matches = [note for note in load_notes() if note.get("id") == wanted]
    if not matches:
        print(f"error: note not found: {args.id}", file=sys.stderr)
        return 1
    note = dict(matches[0])
    note.pop("_path", None)
    print(json.dumps(note, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Capture local agent feedback notes.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture = subparsers.add_parser("capture", help="write a new feedback note")
    capture.add_argument("text", nargs=argparse.REMAINDER, help="feedback text")
    capture.set_defaults(func=cmd_capture)

    list_cmd = subparsers.add_parser("list", help="list recent feedback notes")
    list_cmd.add_argument("--limit", type=positive_int, default=20)
    list_cmd.set_defaults(func=cmd_list)

    show = subparsers.add_parser("show", help="show a feedback note as JSON")
    show.add_argument("id")
    show.set_defaults(func=cmd_show)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
