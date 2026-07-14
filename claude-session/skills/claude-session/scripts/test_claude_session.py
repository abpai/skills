#!/usr/bin/env python3

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("claude-session.py")
SESSION_ID = "11111111-2222-4333-8444-555555555555"


class ClaudeSessionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name)
        project = self.home / "projects" / "-tmp-project"
        project.mkdir(parents=True)
        self.transcript = project / f"{SESSION_ID}.jsonl"
        records = [
            {
                "type": "user",
                "cwd": "/tmp/project",
                "timestamp": "2026-01-01T00:00:00Z",
                "message": {"role": "user", "content": "first question"},
            },
            {
                "type": "assistant",
                "cwd": "/tmp/project",
                "timestamp": "2026-01-01T00:00:01Z",
                "message": {
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": "answer"},
                        {
                            "type": "tool_use",
                            "name": "Read",
                            "input": {"file_path": "/tmp/" + "a" * 80},
                        },
                    ],
                },
            },
            {
                "type": "user",
                "cwd": "/tmp/project",
                "timestamp": "2026-01-01T00:00:02Z",
                "toolUseResult": {"stdout": "large output"},
                "message": {
                    "role": "user",
                    "content": [{"type": "tool_result", "content": "large output"}],
                },
            },
            {
                "type": "assistant",
                "cwd": "/tmp/project",
                "timestamp": "2026-01-01T00:00:03Z",
                "message": {"role": "assistant", "content": "final answer"},
            },
            {
                "type": "user",
                "isMeta": True,
                "cwd": "/tmp/project",
                "timestamp": "2026-01-01T00:00:04Z",
                "message": {"role": "user", "content": "large injected skill body"},
            },
        ]
        self.transcript.write_text("".join(json.dumps(record) + "\n" for record in records))

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_script(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), SESSION_ID, "--claude-home", str(self.home), *args],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_path_resolves_without_content_search(self) -> None:
        result = self.run_script("--path")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(self.transcript))

    def test_context_omits_tool_results_and_is_bounded(self) -> None:
        result = self.run_script("--json", "--last", "2")
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual([item["text"] for item in output["messages"]], ["answer", "final answer"])
        self.assertNotIn("large output", result.stdout)
        self.assertNotIn("large injected skill body", result.stdout)

    def test_tools_are_opt_in(self) -> None:
        without = self.run_script("--json", "--last", "0")
        with_tools = self.run_script(
            "--json", "--last", "0", "--include-tools", "--max-chars", "20"
        )
        self.assertEqual(without.returncode, 0, without.stderr)
        self.assertEqual(with_tools.returncode, 0, with_tools.stderr)
        self.assertNotIn('"tools"', without.stdout)
        self.assertIn('"name": "Read"', with_tools.stdout)
        self.assertIn("chars omitted", with_tools.stdout)

    def test_max_chars_governs_tool_input(self) -> None:
        result = self.run_script(
            "--json", "--last", "0", "--include-tools", "--max-chars", "5000"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("chars omitted", result.stdout)
        self.assertIn("a" * 80, result.stdout)

    def test_corrupt_line_does_not_break_path_lookup(self) -> None:
        with self.transcript.open("a") as handle:
            handle.write('{"type":"assistant","message":{"role":"assis\n')
        path = self.run_script("--path")
        self.assertEqual(path.returncode, 0, path.stderr)
        self.assertEqual(path.stdout.strip(), str(self.transcript))
        children = self.run_script("--children")
        self.assertEqual(children.returncode, 0, children.stderr)
        render = self.run_script("--json")
        self.assertNotEqual(render.returncode, 0)
        self.assertIn("invalid JSONL", render.stderr)

    def test_tilde_home_is_expanded(self) -> None:
        with tempfile.TemporaryDirectory() as fake_home:
            Path(fake_home, ".claude").symlink_to(self.home, target_is_directory=True)
            result = subprocess.run(
                [str(SCRIPT), SESSION_ID, "--claude-home", "~/.claude", "--path"],
                text=True,
                capture_output=True,
                check=False,
                env={**os.environ, "HOME": fake_home},
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                Path(result.stdout.strip()).resolve(), self.transcript.resolve()
            )

    def test_uppercase_uuid_finds_lowercase_transcript(self) -> None:
        result = subprocess.run(
            [
                str(SCRIPT),
                SESSION_ID.upper(),
                "--claude-home",
                str(self.home),
                "--path",
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(self.transcript))


if __name__ == "__main__":
    unittest.main()
