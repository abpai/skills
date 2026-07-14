#!/usr/bin/env python3
"""Fixture tests for codex-session.py."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("codex-session.py")
SESSION_ID = "11111111-2222-4333-8444-555555555555"


class CodexSessionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name)
        self.rollout = (
            self.home
            / "sessions"
            / "2026"
            / "07"
            / "14"
            / f"rollout-2026-07-14T12-00-00-{SESSION_ID}.jsonl"
        )
        self.rollout.parent.mkdir(parents=True)
        records = [
            {
                "timestamp": "2026-07-14T12:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": SESSION_ID,
                    "cwd": "/repo",
                    "cli_version": "1.2.3",
                    "git": {"branch": "main"},
                    "parent_thread_id": "parent-1",
                },
            },
            {
                "timestamp": "2026-07-14T12:00:01Z",
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "<environment_context>noise"}],
                },
            },
            {
                "timestamp": "2026-07-14T12:00:02Z",
                "type": "turn_context",
                "payload": {
                    "cwd": "/repo/worktree",
                    "model": "gpt-test",
                    "effort": "high",
                },
            },
            {
                "timestamp": "2026-07-14T12:00:03Z",
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "Find the bug"}],
                },
            },
            {
                "timestamp": "2026-07-14T12:00:04Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "name": "exec_command",
                    "arguments": '{"cmd":"rg bug src"}',
                },
            },
            {
                "timestamp": "2026-07-14T12:00:05Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "output": "secret and very large tool result",
                },
            },
            {
                "timestamp": "2026-07-14T12:00:06Z",
                "type": "response_item",
                "payload": {"type": "reasoning", "summary": [{"text": "private"}]},
            },
            {
                "timestamp": "2026-07-14T12:00:07Z",
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": "The fix is bounded."}],
                },
            },
        ]
        self.rollout.write_text("".join(json.dumps(item) + "\n" for item in records))

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_script(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), SESSION_ID, "--codex-home", str(self.home), *args],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_bounded_json_omits_injected_tools_and_reasoning(self) -> None:
        result = self.run_script("--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["cwd"], "/repo/worktree")
        self.assertEqual(payload["git_branch"], "main")
        self.assertEqual(payload["message_count"], 2)
        self.assertEqual([item["text"] for item in payload["messages"]], ["Find the bug", "The fix is bounded."])
        self.assertNotIn("secret", result.stdout)
        self.assertNotIn("private", result.stdout)

    def test_include_tools_adds_call_but_never_result(self) -> None:
        result = self.run_script("--json", "--include-tools", "--max-chars", "8")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["message_count"], 3)
        self.assertEqual(payload["messages"][1]["tools"][0]["name"], "exec_command")
        self.assertIn("chars omitted", payload["messages"][1]["tools"][0]["input"])
        self.assertNotIn("secret", result.stdout)

    def test_path_resolves_by_filename(self) -> None:
        result = self.run_script("--path")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(result.stdout.strip()), self.rollout)

    def write_rollout(self, session_id: str, records: list[dict]) -> Path:
        rollout = self.rollout.with_name(
            f"rollout-2026-07-14T12-00-00-{session_id}.jsonl"
        )
        rollout.write_text("".join(json.dumps(item) + "\n" for item in records))
        return rollout

    def test_injected_block_does_not_discard_real_text_in_same_message(self) -> None:
        session = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
        self.write_rollout(
            session,
            [
                {
                    "timestamp": "2026-07-14T12:00:00Z",
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": "<environment_context>cwd=/x"},
                            {"type": "input_text", "text": "Find the bug in auth.py"},
                        ],
                    },
                }
            ],
        )
        result = subprocess.run(
            [str(SCRIPT), session, "--codex-home", str(self.home), "--json"],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual([m["text"] for m in payload["messages"]], ["Find the bug in auth.py"])
        self.assertNotIn("environment_context", result.stdout)

    def test_legacy_rollout_without_response_item_envelope_renders(self) -> None:
        session = "cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa"
        self.write_rollout(
            session,
            [
                {"id": session, "timestamp": "2025-09-04T16:02:29Z", "git": {"branch": "main"}},
                {"record_type": "state"},
                {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "legacy request"}],
                },
                {
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": "legacy reply"}],
                },
            ],
        )
        result = subprocess.run(
            [str(SCRIPT), session, "--codex-home", str(self.home), "--json"],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(
            [m["text"] for m in payload["messages"]], ["legacy request", "legacy reply"]
        )
        self.assertEqual(payload["git_branch"], "main")

    def test_unknown_dialect_fails_instead_of_rendering_empty(self) -> None:
        session = "dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb"
        self.write_rollout(session, [{"type": "some_future_shape", "data": {"text": "hi"}}])
        result = subprocess.run(
            [str(SCRIPT), session, "--codex-home", str(self.home), "--json"],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unrecognized rollout format", result.stderr)

    def test_uppercase_uuid_finds_lowercase_rollout(self) -> None:
        result = subprocess.run(
            [str(SCRIPT), SESSION_ID.upper(), "--codex-home", str(self.home), "--path"],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(result.stdout.strip()), self.rollout)

    def test_missing_session_does_not_fallback_to_content_search(self) -> None:
        missing = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        result = subprocess.run(
            [str(SCRIPT), missing, "--codex-home", str(self.home)],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not found", result.stderr)


if __name__ == "__main__":
    unittest.main()
